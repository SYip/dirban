import * as vscode from "vscode"
import { loadConfig } from "@dirban/core/config/config.ts"
import { discoverBoard } from "@dirban/core/board/discovery.ts"
import { resolveCurrentTask } from "@dirban/core/tasks/lifecycle/current.ts"
import { getVcsProvider } from "@dirban/core/vcs/index.ts"
import type { Board, BoardTask } from "@dirban/core/board/types.ts"
import type { DirbanConfig } from "@dirban/core/config/types.ts"
import type { DirbanTreeDataProvider } from "./tree-provider.ts"
import type { DirbanFocusViewProvider } from "./focus-provider.ts"
import type { DirbanStatusBarController } from "./status-bar.ts"
import { DirbanBoardWebviewPanel } from "./board-panel.ts"

const REFRESH_DEBOUNCE_MS = 100

export class BoardStateManager implements vscode.Disposable {
  private board: Board | null = null
  private config: DirbanConfig
  private activeFocusedTask: BoardTask | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly workspaceRoot: string,
    private readonly treeProvider: DirbanTreeDataProvider,
    private readonly focusProvider: DirbanFocusViewProvider,
    private readonly statusBar: DirbanStatusBarController
  ) {
    const configRes = loadConfig(workspaceRoot)
    this.config = configRes.isOk() ? configRes.value : ({} as DirbanConfig)
  }

  public getBoard(): Board | null {
    return this.board
  }

  public getConfig(): DirbanConfig {
    return this.config
  }

  public getActiveFocusedTask(): BoardTask | null {
    return this.activeFocusedTask
  }

  /**
   * Refreshes the board state immediately.
   */
  public refreshImmediate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    const configRes = loadConfig(this.workspaceRoot)
    this.config = configRes.isOk() ? configRes.value : this.config

    const boardRes = discoverBoard(this.config, this.workspaceRoot)
    if (boardRes.isOk()) {
      this.board = boardRes.value
      this.treeProvider.updateBoard(
        boardRes.value.columns.map((c) => ({
          name: c.name,
          tasks: c.tasks,
        })),
        this.config
      )

      // Resolve current active task
      const vcs = getVcsProvider(this.workspaceRoot)
      const vcsContext = vcs.getContext(this.workspaceRoot)
      const currentRes = resolveCurrentTask(this.board, this.config, undefined, this.workspaceRoot)

      if (currentRes.isOk()) {
        this.activeFocusedTask = currentRes.value.task
        this.focusProvider.updateFocus(
          this.activeFocusedTask,
          this.config,
          vcsContext.currentBranch,
          undefined
        )
        this.statusBar.update(this.activeFocusedTask)
      } else {
        this.activeFocusedTask = null
        this.focusProvider.updateFocus(
          null,
          this.config,
          vcsContext.currentBranch,
          currentRes.error.message
        )
        this.statusBar.update(null)
      }

      if (DirbanBoardWebviewPanel.currentPanel) {
        DirbanBoardWebviewPanel.currentPanel.sendState()
      }
    }
  }

  /**
   * Triggers a debounced refresh, coalescing multiple rapid filesystem watcher events.
   */
  public scheduleRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.refreshImmediate()
    }, REFRESH_DEBOUNCE_MS)
  }

  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }
}
