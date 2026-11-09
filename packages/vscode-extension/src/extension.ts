import * as vscode from "vscode"
import * as path from "node:path"
import * as fs from "node:fs"
import { DEFAULT_CONFIG } from "@dirban/core/config/config.ts"
import { discoverBoard } from "@dirban/core/board/discovery.ts"

class DirbanWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "dirban.kanbanView"

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview)
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const webviewDistPath = path.join(this.extensionUri.fsPath, "dist", "webview")
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

    // Rewrite relative assets (./assets/...) to VS Code Webview URIs
    html = html.replace(/(href|src)="(?:\.\/|\/)?(assets\/[^"]+)"/g, (_, attr, assetPath) => {
      const uri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDistPath, assetPath)))
      return `${attr}="${uri.toString()}"`
    })

    return html
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new DirbanWebviewViewProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DirbanWebviewViewProvider.viewType,
      provider
    )
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("dirban.openBoard", () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
      const boardRes = discoverBoard(DEFAULT_CONFIG, workspaceFolder)
      if (boardRes.isOk()) {
        vscode.window.showInformationMessage(
          `Dirban: loaded ${boardRes.value.columns.length} columns`,
        )
      }
      vscode.commands.executeCommand("dirban.kanbanView.focus")
    })
  )
}

export function deactivate(): void {}
