import { describe, expect, it } from "bun:test"
import * as path from "node:path"
import type { BoardTask } from "../board/types.ts"
import {
  formatCurrentTaskView,
  formatPlanView,
  formatTaskDetail,
  formatTaskPathLink,
  formatTerminalLink,
  toRelativePath,
} from "./formatters.ts"

const createMockTask = (overrides?: Partial<BoardTask>): BoardTask => {
  const defaultTask: BoardTask = {
    filename: "26-006-improve-cli-view.md",
    filePath: path.resolve(process.cwd(), "docs/tasks/02-doing/26-006-improve-cli-view.md"),
    column: "02-doing",
    document: {
      id: "26-006",
      title: "Improve CLI view formatting",
      priority: "p2",
      owner: "developer",
      assigned_to: "unassigned",
      created_date: "2026-11-07",
      last_updated: "2026-11-08",
      tags: ["cli", "view"],
      frontmatter: {
        id: "26-006",
        title: "Improve CLI view formatting",
        status: "doing",
        priority: "p2",
      },
      titleHeader: "Improve CLI view formatting",
      objectiveScope: "Objective details here",
      acceptanceCriteria: [
        {
          index: 1,
          checked: false,
          text: "First criteria item",
          rawLine: "- [ ] First criteria item",
        },
        {
          index: 2,
          checked: true,
          text: "Second criteria item",
          rawLine: "- [x] Second criteria item",
        },
      ],
      verificationPlan: "",
      executionJournal: [],
      otherSections: [],
      rawBody: "",
    },
  }
  return { ...defaultTask, ...overrides }
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g
const stripAnsi = (str: string): string => str.replace(ANSI_REGEX, "")

describe("CLI Formatters Tests", () => {
  it("Vector 1 (Standard Baseline Case): Formats current task and detail views with relative paths and criteria line breaks", () => {
    const task = createMockTask()
    const currentView = formatCurrentTaskView(task)

    // Checks relative path rendering in the visible text
    expect(currentView).toContain("docs/tasks/02-doing/26-006-improve-cli-view.md\u001b]8;;")
    expect(currentView).toContain(
      "Path: \u001b]8;;file://"
        + task.filePath
        + "\u0007docs/tasks/02-doing/26-006-improve-cli-view.md",
    )

    // Checks empty line between consecutive acceptance criteria items
    expect(stripAnsi(currentView)).toContain(
      "  [ ] #1: First criteria item\n\n  [x] #2: Second criteria item",
    )

    // Checks current task formatting with branch and worktree info
    const branchView = formatCurrentTaskView(task, {
      branch: "task/26-006-improve-cli",
      isWorktree: false,
    })
    expect(branchView).toContain("Column: 02-doing | Branch: task/26-006-improve-cli | Path:")

    const worktreeView = formatCurrentTaskView(task, {
      branch: "task/26-006-improve-cli",
      isWorktree: true,
    })
    expect(worktreeView).toContain(
      "Column: 02-doing | Branch: task/26-006-improve-cli (worktree) | Path:",
    )

    const detailView = formatTaskDetail(task)
    expect(detailView).toContain("docs/tasks/02-doing/26-006-improve-cli-view.md")
    expect(stripAnsi(detailView)).toContain(
      "  [ ] #1: First criteria item\n\n  [x] #2: Second criteria item",
    )
  })

  it("Vector 2 (Plan View & Header Simplification): Renders simplified headers and OSC 8 links", () => {
    const readyTask = createMockTask({
      filename: "26-001-setup.md",
      filePath: path.resolve(process.cwd(), "docs/tasks/backlog/26-001-setup.md"),
      column: "backlog",
      document: {
        ...createMockTask().document,
        id: "26-001",
        title: "Setup task",
      },
    })
    const blockedTask = createMockTask({
      filename: "26-002-blocked.md",
      filePath: path.resolve(process.cwd(), "docs/tasks/backlog/26-002-blocked.md"),
      column: "backlog",
      document: {
        ...createMockTask().document,
        id: "26-002",
        title: "Blocked task",
      },
    })

    const planOutput = formatPlanView({
      ready: [{ task: readyTask, evaluation: { resolved: [] } }],
      blocked: [{ task: blockedTask, evaluation: { unresolved: ["Waiting on 26-001"] } }],
      totalBacklog: 2,
    })

    // Assert simplified section headers
    expect(planOutput).toContain("✔ Ready (1):")
    expect(planOutput).not.toContain("✔ Ready to Promote")
    expect(planOutput).toContain("⛔ Blocked (1):")
    expect(planOutput).not.toContain("⛔ Blocked / In Limbo")

    // Assert OSC 8 hyperlink escape sequence is present
    expect(planOutput).toContain("\u001b]8;;file://")
    expect(stripAnsi(planOutput)).toContain("26-001 - Setup task")
    expect(stripAnsi(planOutput)).toContain("26-002 - Blocked task")
  })

  it("Vector 3 (Boundary / Empty Criteria & URL Support): Handles empty criteria and link generator formatting", () => {
    const taskEmptyCriteria = createMockTask({
      document: {
        ...createMockTask().document,
        acceptanceCriteria: [],
      },
    })

    const currentEmpty = formatCurrentTaskView(taskEmptyCriteria)
    expect(currentEmpty).toContain("(none defined)")
    expect(currentEmpty).not.toContain("Progress:")

    // Verify formatTerminalLink with absolute path, relative path, and web URL
    const fileLink = formatTerminalLink("Task Title", "/tmp/sample.md")
    expect(fileLink).toBe("\u001b]8;;file:///tmp/sample.md\u0007Task Title\u001b]8;;\u0007")

    const httpLink = formatTerminalLink("Docs", "https://example.com/docs")
    expect(httpLink).toBe("\u001b]8;;https://example.com/docs\u0007Docs\u001b]8;;\u0007")

    // Verify toRelativePath and formatTaskPathLink
    const cwd = process.cwd()
    expect(toRelativePath(path.join(cwd, "docs/task.md"))).toBe("docs/task.md")
    expect(toRelativePath("already/relative.md")).toBe("already/relative.md")
    expect(toRelativePath("docs\\nested\\task.md")).toBe("docs/nested/task.md")
    expect(formatTaskPathLink(path.join(cwd, "docs/task.md"))).toBe(
      `\u001b]8;;file://${path.join(cwd, "docs/task.md")}\u0007docs/task.md\u001b]8;;\u0007`,
    )
  })
})
