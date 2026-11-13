import { describe, expect, test } from "bun:test"
import { err, ok } from "neverthrow"
import type { Board, BoardTask } from "../../board/types.ts"
import { parseTaskDocument } from "../../okf/parser.ts"
import { NoopVcsProvider } from "../../vcs/noop.ts"
import type { VersionControlProvider, WorktreeEntry } from "../../vcs/types.ts"
import { auditWorktrees, pruneWorktrees } from "./worktree.ts"

const makeTask = (id: string, column: string): BoardTask => {
  const filename = `${id}-task.md`
  const parsed = parseTaskDocument(
    `---\nid: ${id}\ntitle: Task ${id}\nstatus: ${column}\n---\n# Task ${id}\n`,
    filename,
  )
  if (parsed.isErr()) {
    throw new Error(`Failed to parse test task ${id}`)
  }
  return {
    filePath: `/tmp/repo/docs/tasks/${column}/${filename}`,
    filename,
    column,
    document: parsed.value,
  }
}

const makeBoard = (tasksByCol: Record<string, BoardTask[]>): Board => {
  const columns = Object.entries(tasksByCol).map(([name, tasks], index) => ({
    name,
    path: `/tmp/repo/docs/tasks/${name}`,
    orderIndex: index,
    tasks,
  }))
  const totalTasks = columns.reduce((sum, col) => sum + col.tasks.length, 0)
  return {
    rootDir: "/tmp/repo",
    columns,
    totalTasks,
  }
}

const createMockVcs = (
  entries: readonly WorktreeEntry[],
  dirtyPaths: ReadonlySet<string> = new Set(),
  removedPaths: string[] = [],
): VersionControlProvider => {
  const base = new NoopVcsProvider()
  base.getContext = () => ({
    isAvailable: true,
    repoRoot: "/tmp/repo",
    currentBranch: "main",
  })
  base.checkWorkingTreeClean = (opts) => {
    if (opts?.cwd != null && dirtyPaths.has(opts.cwd)) {
      return err({ kind: "DIRTY_WORKING_TREE", message: "Dirty worktree", dirtyFiles: ["file.ts"] })
    }
    return ok(undefined)
  }
  base.removeWorktree = (wtPath) => {
    removedPaths.push(wtPath)
    return ok(undefined)
  }
  base.listWorktrees = () => ok(entries)
  return base
}

describe("Worktree Audit & Prune Tests", () => {
  test("Vector 1: auditWorktrees classifies active, blocked, completed, and orphan worktrees", () => {
    const board = makeBoard({
      "02-doing": [makeTask("26-001", "02-doing")],
      backlog: [makeTask("26-002", "backlog")],
      "03-done": [makeTask("26-003", "03-done")],
    })

    const vcs = createMockVcs(
      [
        { path: "/tmp/repo", branchRef: "refs/heads/main", taskId: null },
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
        {
          path: "/tmp/repo/.worktrees/26-003",
          branchRef: "refs/heads/task/26-003",
          taskId: "26-003",
        },
        {
          path: "/tmp/repo/.worktrees/26-999",
          branchRef: "refs/heads/task/26-999",
          taskId: "26-999",
        },
      ],
      new Set(["/tmp/repo/.worktrees/26-003"]),
    )

    const res = auditWorktrees(board, vcs, "/tmp/repo")
    expect(res.isOk()).toBe(true)
    if (res.isErr()) return

    expect(res.value.length).toBe(4)
    expect(res.value[0]?.status).toBe("active")
    expect(res.value[0]?.isDirty).toBe(false)
    expect(res.value[1]?.status).toBe("blocked")
    expect(res.value[2]?.status).toBe("completed")
    expect(res.value[2]?.isDirty).toBe(true)
    expect(res.value[3]?.status).toBe("orphan")
  })

  test("Vector 2: pruneWorktrees removes clean completed/orphan worktrees and skips dirty ones without --force", () => {
    const board = makeBoard({
      "02-doing": [makeTask("26-001", "02-doing")],
      "03-done": [makeTask("26-003", "03-done")],
    })

    const removedPaths: string[] = []
    const vcs = createMockVcs(
      [
        { path: "/tmp/repo", branchRef: "refs/heads/main", taskId: null },
        {
          path: "/tmp/repo/.worktrees/26-001",
          branchRef: "refs/heads/task/26-001",
          taskId: "26-001",
        },
        {
          path: "/tmp/repo/.worktrees/26-003",
          branchRef: "refs/heads/task/26-003",
          taskId: "26-003",
        },
        {
          path: "/tmp/repo/.worktrees/26-999",
          branchRef: "refs/heads/task/26-999",
          taskId: "26-999",
        },
      ],
      new Set(["/tmp/repo/.worktrees/26-003"]),
      removedPaths,
    )

    const res = pruneWorktrees(board, vcs, { cwd: "/tmp/repo", force: false })
    expect(res.isOk()).toBe(true)
    if (res.isErr()) return

    expect(res.value.removed.map((w) => w.taskId)).toEqual(["26-999"])
    expect(res.value.skippedDirty.map((w) => w.taskId)).toEqual(["26-003"])
    expect(res.value.failed.length).toBe(0)
    expect(removedPaths).toEqual(["/tmp/repo/.worktrees/26-999"])
  })

  test("Vector 3: pruneWorktrees with force=true removes dirty completed/orphan worktrees", () => {
    const board = makeBoard({
      "03-done": [makeTask("26-003", "03-done")],
    })

    const removedPaths: string[] = []
    const vcs = createMockVcs(
      [
        { path: "/tmp/repo", branchRef: "refs/heads/main", taskId: null },
        {
          path: "/tmp/repo/.worktrees/26-003",
          branchRef: "refs/heads/task/26-003",
          taskId: "26-003",
        },
      ],
      new Set(["/tmp/repo/.worktrees/26-003"]),
      removedPaths,
    )

    const res = pruneWorktrees(board, vcs, { cwd: "/tmp/repo", force: true })
    expect(res.isOk()).toBe(true)
    if (res.isErr()) return

    expect(res.value.removed.map((w) => w.taskId)).toEqual(["26-003"])
    expect(res.value.skippedDirty.length).toBe(0)
    expect(removedPaths).toEqual(["/tmp/repo/.worktrees/26-003"])
  })
})
