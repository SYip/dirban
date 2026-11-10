import * as vscode from "vscode"
import type { BoardTask } from "@dirban/core/board/types.ts"

const MAX_STATUS_BAR_TITLE_LENGTH = 25
const TRUNCATION_SLICE_LENGTH = 22

export class DirbanStatusBarController implements vscode.Disposable {
  private readonly statusBarItem: vscode.StatusBarItem

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    )
    this.statusBarItem.command = "dirban.focusCurrentTask"
  }

  public update(task: BoardTask | null): void {
    if (!task) {
      this.statusBarItem.hide()
      return
    }

    const id = task.document.id ?? task.document.frontmatter.id ?? task.filename
    const criteria = task.document.acceptanceCriteria
    const checked = criteria.filter((c) => c.checked).length
    const total = criteria.length

    const countPart = total > 0 ? `[${checked}/${total}]` : ""
    const title = task.document.title ?? "Current Task"
    const truncatedTitle =
      title.length > MAX_STATUS_BAR_TITLE_LENGTH
        ? `${title.slice(0, TRUNCATION_SLICE_LENGTH)}...`
        : title

    this.statusBarItem.text = `$(checklist) ${id} ${truncatedTitle} ${countPart}`.trim()
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `**Dirban Active Task: ${id}**\n\n${title}\n\nStatus: \`${task.column}\` | Priority: \`${task.document.priority ?? "p2"}\`\n\n*Click to focus task / open preview*`
    )
    this.statusBarItem.show()
  }

  public dispose(): void {
    this.statusBarItem.dispose()
  }
}
