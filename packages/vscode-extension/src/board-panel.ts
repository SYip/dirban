import * as fs from "node:fs"
import * as path from "node:path"
import type { Board, } from "@dirban/core/board/types.ts"
import {
  resolveFocusColumn,
  resolveNextColumn,
  resolvePreviousColumn,
} from "@dirban/core/config/config.ts"
import type { DirbanConfig } from "@dirban/core/config/types.ts"
import { resolveCurrentTask } from "@dirban/core/tasks/lifecycle/current.ts"
import { doneTask } from "@dirban/core/tasks/lifecycle/done.ts"
import { resumeTask } from "@dirban/core/tasks/lifecycle/resume.ts"
import { startTask } from "@dirban/core/tasks/lifecycle/start.ts"
import { archiveTasks } from "@dirban/core/tasks/mutation/archive.ts"
import { checkTaskItem } from "@dirban/core/tasks/mutation/check.ts"
import { createTask } from "@dirban/core/tasks/mutation/create.ts"
import { moveTask } from "@dirban/core/tasks/mutation/move.ts"
import { blockTask } from "@dirban/core/tasks/planning/block.ts"
import { promoteTasks } from "@dirban/core/tasks/planning/plan.ts"
import * as vscode from "vscode"
import type {
  ExtensionMessageToWebview,
  WebviewBoardState,
  WebviewColumn,
  WebviewMessageToExtension,
} from "./webview/types.ts"

export class DirbanBoardWebviewPanel {
  public static currentPanel: DirbanBoardWebviewPanel | undefined
  public static readonly viewType = "dirban.boardWebview"

  private readonly _panel: vscode.WebviewPanel
  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private _getBoard: () => Board | null,
    private _getConfig: () => DirbanConfig,
    private _onBoardMutation: () => void,
  ) {
    this._panel = panel
    this._extensionUri = extensionUri

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    }

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview)

    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessageToExtension) => this._handleWebviewMessage(message),
      null,
      this._disposables,
    )
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    getBoard: () => Board | null,
    getConfig: () => DirbanConfig,
    onBoardMutation: () => void,
  ): DirbanBoardWebviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined

    if (DirbanBoardWebviewPanel.currentPanel) {
      DirbanBoardWebviewPanel.currentPanel._panel.reveal(column)
      DirbanBoardWebviewPanel.currentPanel.sendState()
      return DirbanBoardWebviewPanel.currentPanel
    }

    const panel = vscode.window.createWebviewPanel(
      DirbanBoardWebviewPanel.viewType,
      "Dirban Kanban Board",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    )

    panel.iconPath = vscode.Uri.joinPath(extensionUri, "resources", "dirban-icon.svg")

    DirbanBoardWebviewPanel.currentPanel = new DirbanBoardWebviewPanel(
      panel,
      extensionUri,
      getBoard,
      getConfig,
      onBoardMutation,
    )
    DirbanBoardWebviewPanel.currentPanel.sendState()
    return DirbanBoardWebviewPanel.currentPanel
  }

  public sendState(): void {
    const board = this._getBoard()
    const config = this._getConfig()
    if (!board) return

    const columns: WebviewColumn[] = board.columns.map((c) => ({
      name: c.name,
      title: c.name,
      tasks: c.tasks,
    }))

    const focusCol = resolveFocusColumn(config) ?? undefined
    const preFocusCol = focusCol
      ? (resolvePreviousColumn(config, focusCol) ?? config.columns[0])
      : undefined
    const postFocusCol = focusCol ? resolveNextColumn(config, focusCol) : undefined

    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
    const currentRes = resolveCurrentTask(board, config, undefined, root)
    const currentTaskId = currentRes.isOk()
      ? (currentRes.value.task.document.id ?? currentRes.value.task.filename)
      : undefined

    const doingCol = focusCol
      ? board.columns.find((c) => c.name.toLowerCase() === focusCol.toLowerCase())
      : undefined
    const activeTasksInDoingCount = doingCol ? doingCol.tasks.length : 0

    const state: WebviewBoardState = {
      workspaceRoot: board.rootDir,
      columns,
      currentTaskId,
      activeTasksInDoingCount,
      config: {
        focusColumn: focusCol,
        preFocusColumn: preFocusCol,
        postFocusColumn: postFocusCol,
        branchStrategy: config.branchStrategy,
      },
    }

    const message: ExtensionMessageToWebview = {
      type: "boardState",
      state,
    }

    this._panel.webview.postMessage(message)
  }

  private _handleWebviewMessage(message: WebviewMessageToExtension): void {
    const board = this._getBoard()
    const config = this._getConfig()
    if (!board) return

    switch (message.type) {
      case "requestBoardState": {
        this.sendState()
        break
      }

      case "moveTask": {
        const moveRes = moveTask(board, message.taskId, message.targetColumn)
        if (moveRes.isErr()) {
          vscode.window.showErrorMessage(`Dirban move failed: ${moveRes.error.message}`)
        } else {
          this._onBoardMutation()
        }
        break
      }

      case "lifecycleAction": {
        this._handleLifecycleAction(board, config, message.action, message.taskId)
        break
      }

      case "toggleCriterion": {
        const checkRes = checkTaskItem(board, message.taskId, message.itemIndex, message.checked)
        if (checkRes.isErr()) {
          vscode.window.showErrorMessage(`Dirban check item failed: ${checkRes.error.message}`)
        } else {
          this._onBoardMutation()
        }
        break
      }

      case "openFile": {
        const fileUri = vscode.Uri.file(message.filePath)
        vscode.workspace.openTextDocument(fileUri).then((doc) => {
          vscode.window.showTextDocument(doc)
        })
        break
      }

      case "createTask": {
        const createRes = createTask(board, {
          title: message.title,
          column: message.column,
          priority: message.priority as DirbanConfig["defaultPriority"],
        })
        if (createRes.isErr()) {
          vscode.window.showErrorMessage(`Dirban task creation failed: ${createRes.error.message}`)
        } else {
          vscode.window.showInformationMessage(`Dirban: Created task ${createRes.value.id}`)
          this._onBoardMutation()
        }
        break
      }
    }
  }

  private _promptOpenWorktree(worktreePath?: string): void {
    if (worktreePath == null) {
      return
    }
    vscode.window
      .showInformationMessage(`Worktree ready at ${worktreePath}`, "Open Worktree in VS Code")
      .then((choice) => {
        if (choice === "Open Worktree in VS Code") {
          vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(worktreePath), true)
        }
      })
  }

  private async _handleLifecycleAction(
    board: Board,
    config: DirbanConfig,
    action: "ready" | "start" | "done" | "archive" | "block" | "resume",
    taskId: string,
  ): Promise<void> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()

    switch (action) {
      case "ready": {
        const result = promoteTasks(board, config, [taskId])
        if (result.failed.length > 0) {
          const firstFail = result.failed[0]!
          vscode.window.showErrorMessage(`Dirban Ready Failed: ${firstFail.error.message}`)
        } else {
          const promoted = result.promoted[0]
          vscode.window.showInformationMessage(
            `Dirban: Task ${taskId} readied to ${promoted?.targetColumn ?? "todo"}`,
          )
          this._onBoardMutation()
        }
        break
      }

      case "start": {
        const startRes = startTask(board, config, taskId, { cwd: root })
        if (startRes.isErr()) {
          vscode.window.showErrorMessage(`Dirban Start Failed: ${startRes.error.message}`)
        } else {
          const val = startRes.value
          const branchMsg = val.branchName ? ` (branch: ${val.branchName})` : ""
          vscode.window.showInformationMessage(`Dirban: Started task ${taskId}${branchMsg}`)
          this._promptOpenWorktree(val.worktreePath)
          this._onBoardMutation()
        }
        break
      }

      case "resume": {
        const resumeRes = resumeTask(board, config, taskId, { cwd: root })
        if (resumeRes.isErr()) {
          vscode.window.showErrorMessage(`Dirban Resume Failed: ${resumeRes.error.message}`)
        } else {
          const val = resumeRes.value
          const branchMsg = val.branchName ? ` (branch: ${val.branchName})` : ""
          vscode.window.showInformationMessage(`Dirban: Resumed task ${taskId}${branchMsg}`)
          this._promptOpenWorktree(val.worktreePath)
          this._onBoardMutation()
        }
        break
      }

      case "block": {
        const reason = await vscode.window.showInputBox({
          prompt: `Block reason for task ${taskId} (optional)`,
          placeHolder: "e.g. Waiting on API spec",
        })
        if (reason === undefined) {
          break
        }
        const trimmedReason = reason.trim()
        const blockRes = blockTask(board, taskId, trimmedReason ? [trimmedReason] : [], {
          cwd: root,
        })
        if (blockRes.isErr()) {
          vscode.window.showErrorMessage(`Dirban Block Failed: ${blockRes.error.message}`)
        } else {
          vscode.window.showInformationMessage(`Dirban: Blocked task ${taskId}`)
          this._onBoardMutation()
        }
        break
      }

      case "done": {
        const doneRes = doneTask(board, config, taskId, { cwd: root })
        if (doneRes.isErr()) {
          vscode.window.showErrorMessage(`Dirban Done Failed: ${doneRes.error.message}`)
        } else {
          const val = doneRes.value
          const mergeMsg = val.mergedBranch ? ` (merged ${val.mergedBranch})` : ""
          vscode.window.showInformationMessage(`Dirban: Completed task ${taskId}${mergeMsg}`)
          this._onBoardMutation()
        }
        break
      }

      case "archive": {
        const archiveRes = archiveTasks(board, config, taskId, root)
        if (archiveRes.isErr()) {
          vscode.window.showErrorMessage(`Dirban Archive Failed: ${archiveRes.error.message}`)
        } else {
          vscode.window.showInformationMessage(`Dirban: Archived task ${taskId}`)
          this._onBoardMutation()
        }
        break
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const webviewDistPath = path.join(this._extensionUri.fsPath, "dist", "webview")
    const indexPath = path.join(webviewDistPath, "index.html")

    if (!fs.existsSync(indexPath)) {
      return `<!DOCTYPE html>
<html lang="en">
<body>
  <p>Webview assets not built yet. Run <code>bun run build:webview</code>.</p>
</body>
</html>`
    }

    let html = fs.readFileSync(indexPath, "utf-8")

    // Rewrite relative assets to VS Code Webview URIs
    html = html.replace(/(href|src)="(?:\.\/|\/)?(assets\/[^"]+)"/g, (_, attr, assetPath) => {
      const uri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDistPath, assetPath)))
      return `${attr}="${uri.toString()}"`
    })

    return html
  }

  public dispose(): void {
    DirbanBoardWebviewPanel.currentPanel = undefined
    this._panel.dispose()
    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) x.dispose()
    }
  }
}
