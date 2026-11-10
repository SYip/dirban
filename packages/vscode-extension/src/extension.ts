import * as vscode from "vscode"
import { resolveCurrentTask } from "@dirban/core/tasks/lifecycle/current.ts"
import { doneTask } from "@dirban/core/tasks/lifecycle/done.ts"
import { checkTaskItem } from "@dirban/core/tasks/mutation/check.ts"
import { createTask } from "@dirban/core/tasks/mutation/create.ts"
import type { BoardTask } from "@dirban/core/board/types.ts"
import { DirbanTreeDataProvider } from "./tree-provider.ts"
import { DirbanFocusViewProvider } from "./focus-provider.ts"
import { DirbanStatusBarController } from "./status-bar.ts"
import { DirbanBoardWebviewPanel } from "./board-panel.ts"
import { BoardStateManager } from "./board-state-manager.ts"

function getWorkspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
}

export function activate(context: vscode.ExtensionContext): void {
  const root = getWorkspaceRoot()

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

  // 4. Board State Manager (Facade & Coalescing Refresh Controller)
  const stateManager = new BoardStateManager(
    root,
    treeDataProvider,
    focusDataProvider,
    statusBar
  )
  context.subscriptions.push(stateManager)

  // Initial load
  stateManager.refreshImmediate()

  // 5. Watchers for live reactivity (debounced to coalesce file bursts)
  const currentConfig = stateManager.getConfig()
  const tasksGlob = `${currentConfig.tasksDir || "docs/tasks"}/**/*.md`
  const watcher = vscode.workspace.createFileSystemWatcher(tasksGlob)
  watcher.onDidCreate(() => stateManager.scheduleRefresh())
  watcher.onDidChange(() => stateManager.scheduleRefresh())
  watcher.onDidDelete(() => stateManager.scheduleRefresh())
  context.subscriptions.push(watcher)

  // Also watch .dirban.json, settings.json, and git HEAD/index
  const configWatcher = vscode.workspace.createFileSystemWatcher("**/{.dirban.json,settings.json}")
  configWatcher.onDidChange(() => stateManager.scheduleRefresh())
  context.subscriptions.push(configWatcher)

  const gitWatcher = vscode.workspace.createFileSystemWatcher("**/.git/{HEAD,index}")
  gitWatcher.onDidChange(() => stateManager.scheduleRefresh())
  context.subscriptions.push(gitWatcher)

  // 6. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.openBoard", () => {
      DirbanBoardWebviewPanel.createOrShow(
        context.extensionUri,
        () => stateManager.getBoard(),
        () => stateManager.getConfig(),
        () => stateManager.refreshImmediate()
      )
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.refreshBoard", () => {
      stateManager.refreshImmediate()
      vscode.window.showInformationMessage("Dirban board refreshed.")
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.createTask", async () => {
      let board = stateManager.getBoard()
      if (!board) {
        stateManager.refreshImmediate()
        board = stateManager.getBoard()
      }
      if (!board) {
        vscode.window.showErrorMessage("Dirban: Board not available. Please initialize board first.")
        return
      }

      const config = stateManager.getConfig()
      const title = await vscode.window.showInputBox({
        prompt: "Enter task title",
        placeHolder: "e.g. Implement user authentication",
      })

      if (!title || title.trim() === "") return

      const priorityPick = await vscode.window.showQuickPick(
        (config.priorities || ["p0", "p1", "p2", "p3"]).map((priority) => ({
          label: priority,
          description: priority === config.defaultPriority ? "(Default)" : "",
        })),
        { placeHolder: "Select task priority" }
      )

      const selectedPriority = priorityPick ? priorityPick.label : config.defaultPriority

      const createRes = createTask(board, {
        title: title.trim(),
        priority: selectedPriority as any,
        column: "backlog",
      })

      if (createRes.isErr()) {
        vscode.window.showErrorMessage(`Failed to create task: ${createRes.error.message}`)
        return
      }

      stateManager.refreshImmediate()
      vscode.window.showInformationMessage(`Created task ${createRes.value.id}: ${createRes.value.filename}`)
      const doc = await vscode.workspace.openTextDocument(createRes.value.filePath)
      await vscode.window.showTextDocument(doc)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.focusCurrentTask", async () => {
      let board = stateManager.getBoard()
      if (!board) {
        stateManager.refreshImmediate()
        board = stateManager.getBoard()
      }
      if (!board) return

      const config = stateManager.getConfig()
      const currentRes = resolveCurrentTask(board, config, undefined, root)
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
      let board = stateManager.getBoard()
      if (!board) {
        stateManager.refreshImmediate()
      }
      const activeTask = stateManager.getActiveFocusedTask()
      if (!activeTask) {
        vscode.window.showInformationMessage("Dirban: No active task to preview.")
        return
      }
      const docUri = vscode.Uri.file(activeTask.filePath)
      await vscode.commands.executeCommand("markdown.showPreviewToSide", docUri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.editCurrentTask", async () => {
      let board = stateManager.getBoard()
      if (!board) {
        stateManager.refreshImmediate()
      }
      const activeTask = stateManager.getActiveFocusedTask()
      if (!activeTask) {
        vscode.window.showInformationMessage("Dirban: No active task to edit.")
        return
      }
      const doc = await vscode.workspace.openTextDocument(activeTask.filePath)
      await vscode.window.showTextDocument(doc)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.doneCurrentTask", async () => {
      let board = stateManager.getBoard()
      if (!board) {
        stateManager.refreshImmediate()
        board = stateManager.getBoard()
      }
      if (!board) return

      const config = stateManager.getConfig()
      const doneRes = doneTask(board, config, undefined, { cwd: root })
      if (doneRes.isErr()) {
        vscode.window.showErrorMessage(`Failed to complete task: ${doneRes.error.message}`)
        return
      }

      const completed = doneRes.value
      stateManager.refreshImmediate()
      const id = completed.task.document.id ?? completed.task.filename
      vscode.window.showInformationMessage(`Task ${id} completed and moved to done.`)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dirban.toggleCriterion",
      async (task: BoardTask, index: number, newChecked: boolean) => {
        let board = stateManager.getBoard()
        if (!board) {
          stateManager.refreshImmediate()
          board = stateManager.getBoard()
        }
        if (!board) return

        const taskId = task.document.id ?? task.filename
        const res = checkTaskItem(board, taskId, index, newChecked)
        if (res.isErr()) {
          vscode.window.showErrorMessage(`Failed to toggle criterion: ${res.error.message}`)
          return
        }

        stateManager.refreshImmediate()
      }
    )
  )
}

export function deactivate(): void {
  if (DirbanBoardWebviewPanel.currentPanel) {
    DirbanBoardWebviewPanel.currentPanel.dispose()
  }
}
