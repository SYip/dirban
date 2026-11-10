import * as vscode from "vscode"
import * as path from "node:path"
import type { BoardTask } from "@dirban/core/board/types.ts"
import type { DirbanConfig } from "@dirban/core/config/types.ts"

export type FocusTreeItem =
  | FocusHeaderTreeItem
  | FocusMetaTreeItem
  | FocusCriterionTreeItem
  | FocusDocumentTreeItem
  | FocusEmptyTreeItem

export class FocusHeaderTreeItem extends vscode.TreeItem {
  constructor(task: BoardTask) {
    const id = task.document.id ?? task.document.frontmatter.id ?? task.filename
    const title = task.document.title ?? task.document.frontmatter.title ?? "Untitled"
    const priority = task.document.priority ?? task.document.frontmatter.priority ?? "p2"

    super(`${id}: ${title}`, vscode.TreeItemCollapsibleState.None)
    this.description = `[${priority}]`
    this.tooltip = `${title} (${id})\nPriority: ${priority}`
    this.iconPath = new vscode.ThemeIcon("flame")
    this.contextValue = "focusHeader"
  }
}

export class FocusMetaTreeItem extends vscode.TreeItem {
  constructor(label: string, value: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.description = value
    this.tooltip = `${label}: ${value}`
    this.iconPath = new vscode.ThemeIcon(icon)
    this.contextValue = "focusMeta"
  }
}

export class FocusCriterionTreeItem extends vscode.TreeItem {
  public readonly contextValue = "focusCriterion"

  constructor(
    public readonly task: BoardTask,
    public readonly index: number,
    public readonly text: string,
    public readonly checked: boolean,
  ) {
    super(text, vscode.TreeItemCollapsibleState.None)
    this.tooltip = `${checked ? "Completed" : "Pending"}: ${text}`
    this.iconPath = new vscode.ThemeIcon(
      checked ? "pass-filled" : "circle-large-outline"
    )
    this.command = {
      command: "dirban.toggleCriterion",
      title: "Toggle Criterion",
      arguments: [task, index, !checked],
    }
  }
}

export class FocusDocumentTreeItem extends vscode.TreeItem {
  public readonly contextValue = "focusDocument"

  constructor(public readonly task: BoardTask) {
    const basename = path.basename(task.filePath)
    super(basename, vscode.TreeItemCollapsibleState.None)
    this.description = "Task Document"
    this.tooltip = `Open ${basename}`
    this.iconPath = new vscode.ThemeIcon("markdown")
    this.command = {
      command: "markdown.showPreviewToSide",
      title: "Preview Task",
      arguments: [vscode.Uri.file(task.filePath)],
    }
  }
}

export class FocusEmptyTreeItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None)
    this.iconPath = new vscode.ThemeIcon("info")
    this.contextValue = "focusEmpty"
  }
}

export class DirbanFocusViewProvider implements vscode.TreeDataProvider<FocusTreeItem> {
  private readonly _onDidChangeTreeData: vscode.EventEmitter<FocusTreeItem | undefined | null | void> =
    new vscode.EventEmitter<FocusTreeItem | undefined | null | void>()
  public readonly onDidChangeTreeData: vscode.Event<FocusTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event

  private currentTask: BoardTask | null = null
  private currentConfig?: DirbanConfig
  private vcsBranch?: string
  private emptyMessage: string = "No active task in progress"

  public updateFocus(
    task: BoardTask | null,
    config?: DirbanConfig,
    vcsBranch?: string,
    emptyNotice?: string,
  ): void {
    this.currentTask = task
    this.currentConfig = config
    this.vcsBranch = vcsBranch
    if (emptyNotice) {
      this.emptyMessage = emptyNotice
    } else {
      this.emptyMessage = "No active task in progress"
    }
    this.refresh()
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  public getTreeItem(element: FocusTreeItem): vscode.TreeItem {
    return element
  }

  public getChildren(element?: FocusTreeItem): vscode.ProviderResult<FocusTreeItem[]> {
    if (element) {
      return []
    }

    if (!this.currentTask) {
      return [new FocusEmptyTreeItem(this.emptyMessage)]
    }

    const task = this.currentTask
    const items: FocusTreeItem[] = []

    // 1. Task Title & ID Node
    items.push(new FocusHeaderTreeItem(task))

    // 2. VCS Branch / Strategy Meta Node
    const strategy = this.currentConfig?.branchStrategy ?? "checkout"
    const branchLabel = this.vcsBranch ? `branch: ${this.vcsBranch}` : `strategy: ${strategy}`
    items.push(new FocusMetaTreeItem("Context", branchLabel, "git-branch"))

    // 3. Document Link Node (Click opens Preview)
    items.push(new FocusDocumentTreeItem(task))

    // 4. Acceptance Criteria Items
    const criteria = task.document.acceptanceCriteria
    if (criteria.length > 0) {
      for (const item of criteria) {
        items.push(
          new FocusCriterionTreeItem(task, item.index, item.text, item.checked)
        )
      }
    }

    return items
  }
}
