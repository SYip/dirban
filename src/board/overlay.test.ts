import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { ok } from "neverthrow"
import { parseTaskDocument } from "../okf/parser.ts"
import { NoopVcsProvider } from "../vcs/noop.ts"
import type { VersionControlProvider, WorktreeEntry } from "../vcs/types.ts"
import { buildWorktreeTaskMap, overlayWorktreeTask } from "./overlay.ts"
import type { BoardTask } from "./types.ts"

const createTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "dirban-overlay-test-"))

const createMockVcs = (
  entries: readonly WorktreeEntry[],
  repoRoot: string,
  isAvailable = true,
): VersionControlProvider => {
  const base = new NoopVcsProvider()
  base.getContext = () => ({
    isAvailable,
    repoRoot,
    currentBranch: "main",
  })
  base.listWorktrees = () => ok(entries)
  return base
}

describe("Board Worktree Overlay Tests", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  test("Vector 1: buildWorktreeTaskMap indexes active worktrees by lowercase taskId and excludes main repoRoot", () => {
    const repoRoot = "/tmp/repo"
    const vcs = createMockVcs(
      [
        { path: repoRoot, branchRef: "refs/heads/main", taskId: null },
        {
          path: "/tmp/repo/.worktrees/26-001",
          branchRef: "refs/heads/task/26-001",
          taskId: "26-001",
        },
        {
          path: "/tmp/repo/.worktrees/26-002",
          branchRef: "refs/heads/task/26-002",
          taskId: "26-002",
        },
      ],
      repoRoot,
    )

    const map = buildWorktreeTaskMap(vcs, repoRoot)
    expect(map.size).toBe(2)
    expect(map.get("26-001")).toBe("/tmp/repo/.worktrees/26-001")
    expect(map.get("26-002")).toBe("/tmp/repo/.worktrees/26-002")
  })

  test("Vector 2: overlayWorktreeTask overlays live checked-off criteria from worktree while preserving board column", () => {
    const worktreeRoot = createTempDir()
    tempDirs.push(worktreeRoot)

    const tasksDir = "docs/tasks"
    const wtTaskDir = path.join(worktreeRoot, tasksDir, "02-doing")
    fs.mkdirSync(wtTaskDir, { recursive: true })

    const filename = "26-001-sample.md"
    const wtContent = `---
id: 26-001
title: Sample Task
status: 02-doing
priority: high
---
# Sample Task

## Acceptance Criteria
- [x] Criterion A
- [ ] Criterion B
`
    fs.writeFileSync(path.join(wtTaskDir, filename), wtContent, "utf-8")

    const baseContent = `---
id: 26-001
title: Sample Task
status: 02-doing
priority: high
---
# Sample Task

## Acceptance Criteria
- [ ] Criterion A
- [ ] Criterion B
`
    const parsed = parseTaskDocument(baseContent, filename)
    expect(parsed.isOk()).toBe(true)
    if (parsed.isErr()) return

    const baseTask: BoardTask = {
      filePath: path.join("/tmp/main", tasksDir, "02-doing", filename),
      filename,
      column: "02-doing",
      document: parsed.value,
    }

    const worktreeMap = new Map<string, string>([["26-001", worktreeRoot]])
    const overlaid = overlayWorktreeTask(baseTask, worktreeMap, tasksDir)

    expect(overlaid.column).toBe("02-doing")
    expect(overlaid.document.acceptanceCriteria.filter((c) => c.checked).length).toBe(1)
    expect(overlaid.document.acceptanceCriteria[0]?.text).toBe("Criterion A")
  })

  test("Vector 3: overlayWorktreeTask returns original task when worktreeMap is empty or task has no active worktree", () => {
    const parsed = parseTaskDocument(
      "---\nid: 26-005\ntitle: No WT\nstatus: 01-todo\n---\n# No WT\n",
      "26-005-no-wt.md",
    )
    expect(parsed.isOk()).toBe(true)
    if (parsed.isErr()) return

    const baseTask: BoardTask = {
      filePath: "/tmp/main/docs/tasks/01-todo/26-005-no-wt.md",
      filename: "26-005-no-wt.md",
      column: "01-todo",
      document: parsed.value,
    }

    expect(overlayWorktreeTask(baseTask, new Map(), "docs/tasks")).toBe(baseTask)
    expect(overlayWorktreeTask(baseTask, new Map([["26-999", "/tmp/wt"]]), "docs/tasks")).toBe(
      baseTask,
    )
  })
})
