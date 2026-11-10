import * as vscode from "vscode"
import * as path from "node:path"
import type { BoardTask } from "@dirban/core/board/types.ts"
import type { DirbanConfig } from "@dirban/core/config/types.ts"

export type FocusTreeItem =
  | FocusHeaderTreeItem
  | FocusCriterionTreeItem
  | FocusEmptyTreeItem

export class FocusHeaderTreeItem extends vscode.TreeItem {
  constructor(
    task: BoardTask,
    vcsBranch?: string,
    branchStrategy?: string
  ) {
    const id = task.document.id || task.filename
    const title = task.document.title || "Untitled"
    const priority = task.document.priority || "p2"

    super(`${id}: ${title}`, vscode.TreeItemCollapsibleState.None)

    // Check branch match
    const isGit = Boolean(vcsBranch)
    const strategy = branchStrategy ?? "checkout"
    const isGitStrategy = strategy === "checkout" || strategy === "worktree"
    const isBranchMatched = isGit && vcsBranch?.toLowerCase().includes(id.toLowerCase())

    let branchText = ""
    let iconId = "flame"
    let iconColor: vscode.ThemeColor | undefined

    if (isGit && isGitStrategy) {
      branchText = ` (${vcsBranch})`
      if (isBranchMatched) {
        iconColor = new vscode.ThemeColor("charts.green")
      } else {
        iconColor = new vscode.ThemeColor("charts.yellow")
      }
    }

    this.description = `[${priority}]${branchText}`
    this.tooltip = `${title} (${id})\nPriority: ${priority}${branchText ? `\nBranch: ${vcsBranch} ${isBranchMatched ? "(matched)" : "(mismatched)"}` : ""}\n\nClick to open preview to side`

    this.iconPath = iconColor
      ? new vscode.ThemeIcon(iconId, iconColor)
      : new vscode.ThemeIcon(iconId)

    this.command = {
      command: "dirban.previewCurrentTask",
      title: "Preview Task",
    }
    this.contextValue = "focusHeader"
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

    // 1. Unified Task Header Node (click opens side preview directly)
    items.push(
      new FocusHeaderTreeItem(
        task,
        this.vcsBranch,
        this.currentConfig?.branchStrategy
      )
    )

    // 2. Acceptance Criteria Items
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
