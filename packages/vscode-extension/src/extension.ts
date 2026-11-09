import * as vscode from "vscode"
import { loadConfig } from "@dirban/core/config/config.ts"
import { discoverBoard } from "@dirban/core/board/discovery.ts"
import { resolveCurrentTask } from "@dirban/core/tasks/lifecycle/current.ts"
import { createTask } from "@dirban/core/tasks/mutation/create.ts"
import type { Board } from "@dirban/core/board/types.ts"
import type { DirbanConfig } from "@dirban/core/config/types.ts"
import { DirbanTreeDataProvider } from "./tree-provider.ts"
import { DirbanBoardWebviewPanel } from "./board-panel.ts"

let currentBoard: Board | null = null
let currentConfig: DirbanConfig

function getWorkspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
}

function refreshBoardState(treeProvider: DirbanTreeDataProvider): void {
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

    if (DirbanBoardWebviewPanel.currentPanel) {
      DirbanBoardWebviewPanel.currentPanel.sendState()
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const root = getWorkspaceRoot()
  const configRes = loadConfig(root)
  currentConfig = configRes.isOk() ? configRes.value : ({} as DirbanConfig)

  // 1. Sidebar TreeView Provider
  const treeDataProvider = new DirbanTreeDataProvider()
  const treeView = vscode.window.createTreeView("dirban.treeView", {
    treeDataProvider,
    showCollapseAll: true,
  })
  context.subscriptions.push(treeView)

  // Initial load
  refreshBoardState(treeDataProvider)

  // 2. Watcher for live reactivity
  const tasksGlob = `${currentConfig.tasksDir || "docs/tasks"}/**/*.md`
  const watcher = vscode.workspace.createFileSystemWatcher(tasksGlob)
  watcher.onDidCreate(() => refreshBoardState(treeDataProvider))
  watcher.onDidChange(() => refreshBoardState(treeDataProvider))
  watcher.onDidDelete(() => refreshBoardState(treeDataProvider))
  context.subscriptions.push(watcher)

  // Also watch .dirban.json and settings.json
  const configWatcher = vscode.workspace.createFileSystemWatcher("**/{.dirban.json,settings.json}")
  configWatcher.onDidChange(() => refreshBoardState(treeDataProvider))
  context.subscriptions.push(configWatcher)

  // 3. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.openBoard", () => {
      DirbanBoardWebviewPanel.createOrShow(
        context.extensionUri,
        () => currentBoard,
        () => currentConfig,
        () => refreshBoardState(treeDataProvider)
      )
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.refreshBoard", () => {
      refreshBoardState(treeDataProvider)
      vscode.window.showInformationMessage("Dirban board refreshed.")
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.createTask", async () => {
      if (!currentBoard) {
        refreshBoardState(treeDataProvider)
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
        refreshBoardState(treeDataProvider)
        vscode.window.showInformationMessage(`Created task ${createRes.value.id}: ${createRes.value.filename}`)
        const doc = await vscode.workspace.openTextDocument(createRes.value.filePath)
        await vscode.window.showTextDocument(doc)
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.focusCurrentTask", async () => {
      if (!currentBoard) {
        refreshBoardState(treeDataProvider)
      }
      if (!currentBoard) return

      const currentRes = resolveCurrentTask(currentBoard, currentConfig, undefined, root)
      if (currentRes.isErr()) {
        vscode.window.showInformationMessage(`Dirban Current: ${currentRes.error.message}`)
        return
      }

      const task = currentRes.value.task
      const doc = await vscode.workspace.openTextDocument(task.filePath)
      await vscode.window.showTextDocument(doc)
    })
  )
}

export function deactivate(): void {
  if (DirbanBoardWebviewPanel.currentPanel) {
    DirbanBoardWebviewPanel.currentPanel.dispose()
  }
}
