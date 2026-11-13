import { describe, expect, it, mock } from "bun:test"

// Mock the 'vscode' ambient API before importing extension modules
mock.module("vscode", () => {
  enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2,
  }

  enum StatusBarAlignment {
    Left = 1,
    Right = 2,
  }

  class TreeItem {
    public label?: string
    public collapsibleState?: TreeItemCollapsibleState
    public description?: string
    public tooltip?: unknown
    public iconPath?: unknown
    public contextValue?: string
    public command?: { command: string }

    constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
      this.label = label
      this.collapsibleState = collapsibleState ?? TreeItemCollapsibleState.None
    }
  }

  class ThemeIcon {
    constructor(public readonly id: string) {}
  }

  class EventEmitter {
    public event = (_listener: unknown) => {}
    public fire = (_data?: unknown) => {}
  }

  class MarkdownString {
    constructor(public readonly value: string) {}
  }

  class ThemeColor {
    constructor(public readonly id: string) {}
  }

  return {
    TreeItemCollapsibleState,
    StatusBarAlignment,
    TreeItem,
    ThemeIcon,
    ThemeColor,
    EventEmitter,
    MarkdownString,
    Uri: {
      file: (p: string) => ({ fsPath: p, path: p }),
    },
    window: {
      createStatusBarItem: () => ({
        alignment: 1,
        priority: 100,
        text: "",
        tooltip: "",
        command: "",
        color: undefined,
        show: () => {},
        hide: () => {},
        dispose: () => {},
      }),
    },
  }
})

// Dynamic imports so mock.module takes effect before module evaluation
const { DirbanFocusViewProvider, FocusHeaderTreeItem, FocusCriterionTreeItem, FocusEmptyTreeItem } =
  await import("./focus-provider.ts")

const { ColumnTreeItem } = await import("./tree-provider.ts")
const { DirbanStatusBarController } = await import("./status-bar.ts")

import type { BoardTask } from "@dirban/core/board/types.ts"
import type { DirbanConfig } from "@dirban/core/config/types.ts"

describe("VS Code Extension Focus and Tree Items", () => {
  const dummyTask: BoardTask = {
    filePath: "/workspace/docs/tasks/02-doing/26-009-test.md",
    filename: "26-009-test.md",
    column: "02-doing",
    document: {
      id: "26-009",
      title: "Focus View Integration",
      priority: "p1",
      tags: [],
      titleHeader: "Focus View Integration",
      objectiveScope: "Scope",
      verificationPlan: "Plan",
      executionJournal: [],
      otherSections: [],
      frontmatter: {
        id: "26-009",
        title: "Focus View Integration",
        priority: "p1",
      },
      acceptanceCriteria: [
        { index: 0, text: "First criterion", checked: true, rawLine: "- [x] First criterion" },
        { index: 1, text: "Second criterion", checked: false, rawLine: "- [ ] Second criterion" },
      ],
      rawBody: "Body text",
    },
  }

  const dummyConfig: DirbanConfig = {
    tasksDir: "docs/tasks",
    archiveDir: "docs/tasks/archive",
    columns: ["01-todo", "02-doing", "03-done"],
    focusColumn: "02-doing",
    priorities: ["p0", "p1", "p2", "p3"],
    defaultPriority: "p2",
    branchStrategy: "checkout",
  }

  it("ColumnTreeItem selectively expands only focus and pre-focus columns", () => {
    // 02-doing (focus column) -> Expanded (2)
    const doingItem = new ColumnTreeItem("02-doing", 3, dummyConfig)
    expect(doingItem.collapsibleState).toBe(2)

    // 01-todo (pre-focus column) -> Expanded (2)
    const todoItem = new ColumnTreeItem("01-todo", 5, dummyConfig)
    expect(todoItem.collapsibleState).toBe(2)

    // 03-done (post-focus / other column) -> Collapsed (1)
    const doneItem = new ColumnTreeItem("03-done", 12, dummyConfig)
    expect(doneItem.collapsibleState).toBe(1)

    // backlog -> Collapsed (1)
    const backlogItem = new ColumnTreeItem("backlog", 20, dummyConfig)
    expect(backlogItem.collapsibleState).toBe(1)
  })

  it("DirbanFocusViewProvider builds correct tree nodes when task is active", async () => {
    const provider = new DirbanFocusViewProvider()
    provider.updateFocus(dummyTask, dummyConfig, "task/26-009-test", undefined)

    const children = (await provider.getChildren()) ?? []
    // 1 header node + 2 criteria nodes = 3 nodes
    expect(children).toHaveLength(3)

    // 1. Header node with branch info and preview command
    expect(children[0]).toBeInstanceOf(FocusHeaderTreeItem)
    expect(children[0].label).toBe("26-009: Focus View Integration")
    expect(children[0].description).toBe("[p1] (task/26-009-test)")
    expect(children[0].command?.command).toBe("dirban.previewCurrentTask")

    // Worktree focus
    provider.updateFocus(dummyTask, dummyConfig, undefined, undefined, true)
    const worktreeChildren = (await provider.getChildren()) ?? []
    expect(worktreeChildren[0].description).toBe("[p1] [worktree]")

    // 2 & 3. Acceptance criteria nodes
    expect(children[1]).toBeInstanceOf(FocusCriterionTreeItem)
    if (children[1] instanceof FocusCriterionTreeItem) {
      expect(children[1].text).toBe("First criterion")
      expect(children[1].checked).toBe(true)
    }

    expect(children[2]).toBeInstanceOf(FocusCriterionTreeItem)
    if (children[2] instanceof FocusCriterionTreeItem) {
      expect(children[2].text).toBe("Second criterion")
      expect(children[2].checked).toBe(false)
    }
  })

  it("DirbanFocusViewProvider shows empty node when no active task", async () => {
    const provider = new DirbanFocusViewProvider()
    provider.updateFocus(null, dummyConfig, undefined, "No tasks in progress")

    const children = (await provider.getChildren()) ?? []
    expect(children).toHaveLength(1)
    expect(children[0]).toBeInstanceOf(FocusEmptyTreeItem)
    expect(children[0].label).toBe("No tasks in progress")
  })

  it("DirbanStatusBarController formats active task text with criteria tally", () => {
    const controller = new DirbanStatusBarController()
    controller.update(dummyTask)
    const item = (controller as unknown as { statusBarItem: { text: string } }).statusBarItem
    expect(item.text).toBe("$(checklist) 26-009 Focus View Integration [1/2]")

    controller.update(null)
  })
})
