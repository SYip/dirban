import * as vscode from "vscode"
import { loadConfig } from "@dirban/core/config/config.ts"
import { discoverBoard } from "@dirban/core/board/discovery.ts"
import { resolveCurrentTask } from "@dirban/core/tasks/lifecycle/current.ts"
import { doneTask } from "@dirban/core/tasks/lifecycle/done.ts"
import { checkTaskItem } from "@dirban/core/tasks/mutation/check.ts"
import { createTask } from "@dirban/core/tasks/mutation/create.ts"
import { getVcsProvider } from "@dirban/core/vcs/index.ts"
import type { Board, BoardTask } from "@dirban/core/board/types.ts"
import type { DirbanConfig } from "@dirban/core/config/types.ts"
import { DirbanTreeDataProvider } from "./tree-provider.ts"
import { DirbanFocusViewProvider } from "./focus-provider.ts"
import { DirbanStatusBarController } from "./status-bar.ts"
import { DirbanBoardWebviewPanel } from "./board-panel.ts"

let currentBoard: Board | null = null
let currentConfig: DirbanConfig
let activeFocusedTask: BoardTask | null = null

function getWorkspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
}

function refreshBoardState(
  treeProvider: DirbanTreeDataProvider,
  focusProvider: DirbanFocusViewProvider,
  statusBar: DirbanStatusBarController
): void {
  const root = getWorkspaceRoot()
  const configRes = loadConfig(root)
  currentConfig = configRes.isOk() ? configRes.value : currentConfig

  const boardRes = discoverBoard(currentConfig, root)
  if (boardRes.isOk()) {
    currentBoard = boardRes.value
    treeProvider.updateBoard(
      boardRes.value.columns.map((c) => ({
        name: c.name,
        tasks: c.tasks,
      })),
      currentConfig
    )

    // Resolve current active task
    const vcs = getVcsProvider(root)
    const vcsContext = vcs.getContext(root)
    const currentRes = resolveCurrentTask(currentBoard, currentConfig, undefined, root)

    if (currentRes.isOk()) {
      activeFocusedTask = currentRes.value.task
      focusProvider.updateFocus(
        activeFocusedTask,
        currentConfig,
        vcsContext.currentBranch,
        undefined
      )
      statusBar.update(activeFocusedTask)
    } else {
      activeFocusedTask = null
      focusProvider.updateFocus(
        null,
        currentConfig,
        vcsContext.currentBranch,
        currentRes.error.message
      )
      statusBar.update(null)
    }

    if (DirbanBoardWebviewPanel.currentPanel) {
      DirbanBoardWebviewPanel.currentPanel.sendState()
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const root = getWorkspaceRoot()
  const configRes = loadConfig(root)
  currentConfig = configRes.isOk() ? configRes.value : ({} as DirbanConfig)

  // 1. Sidebar Focus View Provider (Top Pane)
  const focusDataProvider = new DirbanFocusViewProvider()
  const focusView = vscode.window.createTreeView("dirban.focusView", {
    treeDataProvider: focusDataProvider,
    showCollapseAll: false,
  })
  context.subscriptions.push(focusView)

  // 2. Sidebar TreeView Provider (Bottom Pane)
  const treeDataProvider = new DirbanTreeDataProvider()
  const treeView = vscode.window.createTreeView("dirban.treeView", {
    treeDataProvider,
    showCollapseAll: true,
  })
  context.subscriptions.push(treeView)

  // 3. Status Bar Controller
  const statusBar = new DirbanStatusBarController()
  context.subscriptions.push(statusBar)

  // Initial load
  refreshBoardState(treeDataProvider, focusDataProvider, statusBar)

  // 4. Watcher for live reactivity
  const tasksGlob = `${currentConfig.tasksDir || "docs/tasks"}/**/*.md`
  const watcher = vscode.workspace.createFileSystemWatcher(tasksGlob)
  watcher.onDidCreate(() => refreshBoardState(treeDataProvider, focusDataProvider, statusBar))
  watcher.onDidChange(() => refreshBoardState(treeDataProvider, focusDataProvider, statusBar))
  watcher.onDidDelete(() => refreshBoardState(treeDataProvider, focusDataProvider, statusBar))
  context.subscriptions.push(watcher)

  // Also watch .dirban.json, settings.json, and git HEAD/index
  const configWatcher = vscode.workspace.createFileSystemWatcher("**/{.dirban.json,settings.json}")
  configWatcher.onDidChange(() => refreshBoardState(treeDataProvider, focusDataProvider, statusBar))
  context.subscriptions.push(configWatcher)

  const gitWatcher = vscode.workspace.createFileSystemWatcher("**/.git/{HEAD,index}")
  gitWatcher.onDidChange(() => refreshBoardState(treeDataProvider, focusDataProvider, statusBar))
  context.subscriptions.push(gitWatcher)

  // 5. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.openBoard", () => {
      DirbanBoardWebviewPanel.createOrShow(
        context.extensionUri,
        () => currentBoard,
        () => currentConfig,
        () => refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
      )
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.refreshBoard", () => {
      refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
      vscode.window.showInformationMessage("Dirban board refreshed.")
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.createTask", async () => {
      if (!currentBoard) {
        refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
      }
      if (!currentBoard) {
        vscode.window.showErrorMessage("Dirban: Board not available. Please initialize board first.")
        return
      }

      const title = await vscode.window.showInputBox({
        prompt: "Enter task title",
        placeHolder: "e.g. Implement user authentication",
      })

      if (!title || title.trim() === "") return

      const priorityPick = await vscode.window.showQuickPick(
        (currentConfig.priorities || ["p0", "p1", "p2", "p3"]).map((p) => ({
          label: p,
          description: p === currentConfig.defaultPriority ? "(Default)" : "",
        })),
        { placeHolder: "Select task priority" }
      )

      const selectedPriority = priorityPick ? priorityPick.label : currentConfig.defaultPriority

      const createRes = createTask(currentBoard, {
        title: title.trim(),
        priority: selectedPriority as any,
        column: "backlog",
      })

      if (createRes.isErr()) {
        vscode.window.showErrorMessage(`Failed to create task: ${createRes.error.message}`)
      } else {
        refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
        vscode.window.showInformationMessage(`Created task ${createRes.value.id}: ${createRes.value.filename}`)
        const doc = await vscode.workspace.openTextDocument(createRes.value.filePath)
        await vscode.window.showTextDocument(doc)
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.focusCurrentTask", async () => {
      if (!currentBoard) {
        refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
      }
      if (!currentBoard) return

      const currentRes = resolveCurrentTask(currentBoard, currentConfig, undefined, root)
      if (currentRes.isErr()) {
        vscode.window.showInformationMessage(`Dirban Current: ${currentRes.error.message}`)
        return
      }

      const task = currentRes.value.task
      const docUri = vscode.Uri.file(task.filePath)
      await vscode.commands.executeCommand("markdown.showPreviewToSide", docUri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.previewCurrentTask", async () => {
      if (!currentBoard) {
        refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
      }
      if (!activeFocusedTask) {
        vscode.window.showInformationMessage("Dirban: No active task to preview.")
        return
      }
      const docUri = vscode.Uri.file(activeFocusedTask.filePath)
      await vscode.commands.executeCommand("markdown.showPreviewToSide", docUri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.editCurrentTask", async () => {
      if (!currentBoard) {
        refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
      }
      if (!activeFocusedTask) {
        vscode.window.showInformationMessage("Dirban: No active task to edit.")
        return
      }
      const doc = await vscode.workspace.openTextDocument(activeFocusedTask.filePath)
      await vscode.window.showTextDocument(doc)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.doneCurrentTask", async () => {
      if (!currentBoard) {
        refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
      }
      if (!currentBoard) return

      const doneRes = doneTask(currentBoard, currentConfig, undefined, { cwd: root })
      if (doneRes.isErr()) {
        vscode.window.showErrorMessage(`Failed to complete task: ${doneRes.error.message}`)
      } else {
        const completed = doneRes.value
        refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
        const id = completed.task.document.id ?? completed.task.filename
        vscode.window.showInformationMessage(`Task ${id} completed and moved to done.`)
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dirban.toggleCriterion",
      async (task: BoardTask, index: number, newChecked: boolean) => {
        if (!currentBoard) {
          refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
        }
        if (!currentBoard) return

        const taskId = task.document.id ?? task.filename
        const res = checkTaskItem(currentBoard, taskId, index, newChecked)
        if (res.isErr()) {
          vscode.window.showErrorMessage(`Failed to toggle criterion: ${res.error.message}`)
        } else {
          refreshBoardState(treeDataProvider, focusDataProvider, statusBar)
        }
      }
    )
  )
}

export function deactivate(): void {
  if (DirbanBoardWebviewPanel.currentPanel) {
    DirbanBoardWebviewPanel.currentPanel.dispose()
  }
}
