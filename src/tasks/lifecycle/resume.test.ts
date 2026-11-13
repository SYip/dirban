import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { err, ok } from "neverthrow"
import { discoverBoard } from "../../board/discovery.ts"
import { DEFAULT_CONFIG } from "../../config/config.ts"
import type { VersionControlProvider } from "../../vcs/types.ts"
import { createTask } from "../mutation/create.ts"
import { blockTask } from "../planning/block.ts"
import { resumeTask } from "./resume.ts"

const createMockVcs = (
  tempDir: string,
  overrides?: Partial<VersionControlProvider>,
): VersionControlProvider => ({
  name: "mock-vcs",
  getContext: () => ({ isAvailable: true, repoRoot: tempDir, currentBranch: "main" }),
  extractTaskId: () => null,
  deriveBranchName: (p, id) => `${p}${id}`,
  deriveWorktreePath: (r, _t, id) => path.join(r, ".worktrees", id),
  resolveWorktreePath: () => err({ kind: "WORKTREE_ERROR", message: "None" }),
  listWorktrees: () => ok([]),
  removeWorktree: () => ok(undefined),
  switchOrCreateBranch: () => ok({ alreadyOnBranch: false }),
  createWorktree: () => ok(undefined),
  checkWorkingTreeClean: () => ok(undefined),
  commitFile: () => ok(undefined),
  autoMergeAndCleanup: () => ok({ worktreeRemoved: true }),
  ...overrides,
})

describe("Resume Task Operations (resumeTask)", () => {
  it("Vector 1: Resumes blocked task from backlog back into focus column (02-doing)", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-resume-test-"))
    for (const col of ["backlog", "01-todo", "02-doing", "03-done", "archive"]) {
      fs.mkdirSync(path.join(tempDir, "docs/tasks", col), { recursive: true })
    }

    const initialBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
    const task = createTask(initialBoard, {
      title: "Task to Resume",
      priority: "p1",
      column: "01-todo",
    })._unsafeUnwrap()

    const boardWithTask = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
    // Block it first
    blockTask(boardWithTask, task.id, ["Waiting on API"])._unsafeUnwrap()

    const boardBlocked = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
    const allBlockedTasks = boardBlocked.columns.flatMap((c) => c.tasks)
    const blockedTask = allBlockedTasks.find((t) => t.document.id === task.id)!
    expect(blockedTask.column).toBe("backlog")

    // Resume it with --force (clears blocker)
    const resumeRes = resumeTask(boardBlocked, DEFAULT_CONFIG, task.id, {
      cwd: tempDir,
      vcsProvider: createMockVcs(tempDir),
      force: true,
    })

    expect(resumeRes.isOk()).toBe(true)
    const val = resumeRes._unsafeUnwrap()
    expect(val.task.column).toBe("02-doing")

    // Check disk
    const boardResumed = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
    const allResumedTasks = boardResumed.columns.flatMap((c) => c.tasks)
    const resumedTask = allResumedTasks.find((t) => t.document.id === task.id)!
    expect(resumedTask.column).toBe("02-doing")
  })

  it("Vector 2: Fails when task still has unresolved blockers without --force", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-resume-blockers-"))
    for (const col of ["backlog", "01-todo", "02-doing", "03-done", "archive"]) {
      fs.mkdirSync(path.join(tempDir, "docs/tasks", col), { recursive: true })
    }

    const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
    const task = createTask(board, {
      title: "Blocked Task",
      priority: "p2",
      column: "01-todo",
    })._unsafeUnwrap()

    const boardWithTask = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
    blockTask(boardWithTask, task.id, ["External PR"])._unsafeUnwrap()

    const boardBlocked = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
    const resumeRes = resumeTask(boardBlocked, DEFAULT_CONFIG, task.id, {
      cwd: tempDir,
      vcsProvider: createMockVcs(tempDir),
      force: false,
    })

    expect(resumeRes.isErr()).toBe(true)
    expect(resumeRes._unsafeUnwrapErr().kind).toBe("HAS_ACTIVE_BLOCKERS")
  })

  it("Vector 3: Dirty Working Tree Guard: halts if target branch has uncommitted code files", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-resume-dirty-"))
    for (const col of ["backlog", "01-todo", "02-doing", "03-done", "archive"]) {
      fs.mkdirSync(path.join(tempDir, "docs/tasks", col), { recursive: true })
    }

    const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
    const task = createTask(board, {
      title: "Task With Dirty Repo",
      priority: "p1",
      column: "backlog",
    })._unsafeUnwrap()

    const boardWithTask = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

    const dirtyVcs = createMockVcs(tempDir, {
      checkWorkingTreeClean: () =>
        err({
          kind: "DIRTY_WORKING_TREE",
          message: "Working directory has dirty files",
          dirtyFiles: ["src/index.ts"],
        }),
    })

    const resumeRes = resumeTask(boardWithTask, DEFAULT_CONFIG, task.id, {
      cwd: tempDir,
      vcsProvider: dirtyVcs,
      force: true,
    })

    expect(resumeRes.isErr()).toBe(true)
    expect(resumeRes._unsafeUnwrapErr().kind).toBe("DIRTY_WORKING_TREE")
  })
})
