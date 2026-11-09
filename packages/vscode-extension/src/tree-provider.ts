import * as vscode from "vscode"
import * as path from "node:path"
import type { BoardTask } from "@dirban/core/board/types.ts"
import type { DirbanConfig } from "@dirban/core/config/types.ts"
import { resolveFocusColumn, resolvePreviousColumn, resolveNextColumn } from "@dirban/core/config/config.ts"

export type DirbanTreeItem = ColumnTreeItem | TaskTreeItem

export class ColumnTreeItem extends vscode.TreeItem {
  public readonly contextValue = "dirbanColumn"

  constructor(
    public readonly columnName: string,
    public readonly taskCount: number,
    config?: DirbanConfig,
  ) {
    super(columnName, vscode.TreeItemCollapsibleState.Expanded)
    this.description = `(${taskCount})`
    this.tooltip = `Column: ${columnName} — ${taskCount} tasks`
    this.iconPath = new vscode.ThemeIcon(this.resolveIcon(columnName, config))
  }

  private resolveIcon(columnName: string, config?: DirbanConfig): string {
    if (columnName.toLowerCase() === "backlog") {
      return "inbox"
    }
    if (columnName.toLowerCase() === "archive") {
      return "archive"
    }

    if (!config) {
      return "list-unordered"
    }

    const activeColumn = resolveFocusColumn(config)
    if (!activeColumn) {
      return "list-unordered"
    }

    const lowerCol = columnName.toLowerCase()
    const lowerActive = activeColumn.toLowerCase()

    // 1. Active column (focus column)
    if (lowerCol === lowerActive) {
      return "play-circle"
    }

    // 2. Pre-focus column (activeColumn - 1, e.g. todo/queue)
    const prevCol = resolvePreviousColumn(config, activeColumn)
    if (prevCol && lowerCol === prevCol.toLowerCase()) {
      return "list-ordered"
    }

    // 3. Post-focus column (activeColumn + 1, e.g. done/review/test)
    const nextCol = resolveNextColumn(config, activeColumn)
    if (nextCol && lowerCol === nextCol.toLowerCase()) {
      return "check-all"
    }

    return "list-unordered"
  }
}

export class TaskTreeItem extends vscode.TreeItem {
  public readonly contextValue = "dirbanTask"

  constructor(public readonly task: BoardTask) {
    const id = task.document.id ?? task.document.frontmatter.id ?? task.filename
    const title = task.document.title ?? task.document.frontmatter.title ?? "Untitled"
    const priority = task.document.priority ?? task.document.frontmatter.priority ?? "p2"
    const checkedCount = task.document.acceptanceCriteria.filter((c) => c.checked).length
    const totalCount = task.document.acceptanceCriteria.length

    super(`${id}: ${title}`, vscode.TreeItemCollapsibleState.None)

    this.description = totalCount > 0 ? `[${priority}] ${checkedCount}/${totalCount}` : `[${priority}]`
    this.tooltip = `${title}\nFile: ${path.basename(task.filePath)}\nPriority: ${priority}`
    this.command = {
      command: "vscode.open",
      title: "Open Task",
      arguments: [vscode.Uri.file(task.filePath)],
    }
    this.iconPath = new vscode.ThemeIcon(
      totalCount > 0 && checkedCount === totalCount ? "pass-filled" : "tasklist"
    )
  }
}

export class DirbanTreeDataProvider implements vscode.TreeDataProvider<DirbanTreeItem> {
  private readonly _onDidChangeTreeData: vscode.EventEmitter<DirbanTreeItem | undefined | null | void> =
    new vscode.EventEmitter<DirbanTreeItem | undefined | null | void>()
  public readonly onDidChangeTreeData: vscode.Event<DirbanTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event

  private columnsData: ReadonlyArray<{ readonly name: string; readonly tasks: readonly BoardTask[] }> = []
  private currentConfig?: DirbanConfig

  public updateBoard(
    columns: ReadonlyArray<{ readonly name: string; readonly tasks: readonly BoardTask[] }>,
    config?: DirbanConfig,
  ): void {
    this.columnsData = columns
    this.currentConfig = config
    this.refresh()
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  public getTreeItem(element: DirbanTreeItem): vscode.TreeItem {
    return element
  }

  public getChildren(element?: DirbanTreeItem): vscode.ProviderResult<DirbanTreeItem[]> {
    if (!element) {
      // Root level: return columns
      return this.columnsData.map(
        (col) => new ColumnTreeItem(col.name, col.tasks.length, this.currentConfig)
      )
    }

    if (element instanceof ColumnTreeItem) {
      // Column level: return task items
      const col = this.columnsData.find((c) => c.name === element.columnName)
      if (!col) return []
      return col.tasks.map((task) => new TaskTreeItem(task))
    }

    return []
  }
}
