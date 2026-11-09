import * as vscode from "vscode"
import * as path from "node:path"
import * as fs from "node:fs"
import type { Board, BoardTask } from "@dirban/core/board/types.ts"
import type { DirbanConfig } from "@dirban/core/config/types.ts"
import { moveTask } from "@dirban/core/tasks/mutation/move.ts"
import { checkTaskItem } from "@dirban/core/tasks/mutation/check.ts"
import { createTask } from "@dirban/core/tasks/mutation/create.ts"
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
      this._disposables
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
      }
    )

    panel.iconPath = vscode.Uri.joinPath(extensionUri, "resources", "dirban-icon.svg")

    DirbanBoardWebviewPanel.currentPanel = new DirbanBoardWebviewPanel(
      panel,
      extensionUri,
      getBoard,
      getConfig,
      onBoardMutation
    )
    DirbanBoardWebviewPanel.currentPanel.sendState()
    return DirbanBoardWebviewPanel.currentPanel
  }

  public sendState(): void {
    const board = this._getBoard()
    if (!board) return

    const columns: WebviewColumn[] = board.columns.map((c) => ({
      name: c.name,
      title: c.name,
      tasks: c.tasks,
    }))

    const state: WebviewBoardState = {
      workspaceRoot: board.rootDir,
      columns,
    }

    const message: ExtensionMessageToWebview = {
      type: "boardState",
      state,
    }

    this._panel.webview.postMessage(message)
  }

  private _handleWebviewMessage(message: WebviewMessageToExtension): void {
    const board = this._getBoard()
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
          priority: message.priority as any,
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
