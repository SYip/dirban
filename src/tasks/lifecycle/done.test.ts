import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { ok } from "neverthrow"
import { discoverBoard } from "../../board/discovery.ts"
import { DEFAULT_CONFIG } from "../../config/config.ts"
import type { DirbanConfig } from "../../config/types.ts"
import { NoopVcsProvider, type VersionControlProvider } from "../../vcs/index.ts"
import { createTask } from "../mutation/create.ts"
import { initializeBoard } from "../project/init.ts"
import { doneTask } from "./done.ts"

describe("Done Task Operations (doneTask)", () => {
  it("Vector 1: Completes single doing task in non-git filesystem without explicit ID", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-done-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      createTask(board, {
        title: "Doing Feature",
        priority: "p1",
        column: "02-doing",
      })._unsafeUnwrap()

      const boardInDoing = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const doneRes = doneTask(boardInDoing, DEFAULT_CONFIG, undefined, { cwd: tempDir })
      expect(doneRes.isOk()).toBe(true)
      if (doneRes.isOk()) {
        expect(doneRes.value.task.column).toBe("03-done")
        expect(doneRes.value.gitSkipped).toBe(true)
        expect(doneRes.value.uncheckedCount).toBe(1)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 2: Transitions task to focus + 1 in custom workflow ('develop' -> 'test')", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-done-"))
    try {
      const customWorkflowConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        columns: ["todo", "develop", "test", "production"],
        focusColumn: "develop",
      }
      for (const col of customWorkflowConfig.columns) {
        fs.mkdirSync(path.join(tempDir, "docs/tasks", col), { recursive: true })
      }
      const board = discoverBoard(customWorkflowConfig, tempDir)._unsafeUnwrap()
      const customTask = createTask(board, {
        title: "In-Progress Feature",
        column: "develop",
      })._unsafeUnwrap()

      const boardInDevelop = discoverBoard(customWorkflowConfig, tempDir)._unsafeUnwrap()
      const doneRes = doneTask(boardInDevelop, customWorkflowConfig, customTask.id, { cwd: tempDir })
      expect(doneRes.isOk()).toBe(true)
      if (doneRes.isOk()) {
        expect(doneRes.value.task.column).toBe("test")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 3: Transitions backlog task to archive in zero-column workflow (columns: [])", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-done-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const zeroColConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        columns: [],
        focusColumn: undefined,
      }
      const board = discoverBoard(zeroColConfig, tempDir)._unsafeUnwrap()
      const zeroTask = createTask(board, {
        title: "Zero Column Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithZero = discoverBoard(zeroColConfig, tempDir)._unsafeUnwrap()
      const doneZeroRes = doneTask(boardWithZero, zeroColConfig, zeroTask.id, { cwd: tempDir })
      expect(doneZeroRes.isOk()).toBe(true)
      if (doneZeroRes.isOk()) {
        expect(doneZeroRes.value.task.column).toContain("archive")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 4: Custom workspace strategy delegation in doneTask", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-done-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const task = createTask(board, {
        title: "Strategy Done Task",
        column: "02-doing",
      })._unsafeUnwrap()

      let doneHookCalled = false
      const trackingStrategy = {
        name: "directory-only" as const,
        onStart: () => ok({ branchName: "b", strategy: "directory-only" as const, gitSkipped: true }),
        onDone: () => {
          doneHookCalled = true
          return ok({ gitSkipped: true })
        },
      }

      const refreshed = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const res = doneTask(refreshed, DEFAULT_CONFIG, task.id, {
        cwd: tempDir,
        workspaceStrategy: trackingStrategy,
      })
      expect(res.isOk()).toBe(true)
      expect(doneHookCalled).toBe(true)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 5: Supports noMerge option with strategy 'none' / CurrentBranchStrategy", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-done-"))
    try {
      const noneConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        branchStrategy: "none",
        autoMerge: false,
      }
      initializeBoard(noneConfig, tempDir)
      const board = discoverBoard(noneConfig, tempDir)._unsafeUnwrap()
      const task = createTask(board, {
        title: "Current Branch Done Task",
        column: "02-doing",
      })._unsafeUnwrap()

      const refreshed = discoverBoard(noneConfig, tempDir)._unsafeUnwrap()
      const res = doneTask(refreshed, noneConfig, task.id, {
        cwd: tempDir,
        noMerge: true,
      })
      expect(res.isOk()).toBe(true)
      if (res.isOk()) {
        expect(res.value.gitSkipped).toBe(true)
        expect(res.value.task.column).toBe("03-done")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 6: Forced merge override (noMerge: false) triggers autoMerge even when autoMerge: false in config", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-done-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const task = createTask(board, {
        title: "Forced Merge Task",
        column: "02-doing",
      })._unsafeUnwrap()

      let forcedMergeExecuted = false
      const baseNoop = new NoopVcsProvider()
      const mockVcs: VersionControlProvider = Object.assign(Object.create(baseNoop), {
        getContext: () => ({
          isAvailable: true,
          currentBranch: `task/${task.id}-forced-merge-task`,
          repoRoot: tempDir,
          isWorktree: false,
        }),
        extractTaskId: (branch: string) => (branch.includes(task.id) ? task.id : null),
        autoMergeAndCleanup: () => {
          forcedMergeExecuted = true
          return ok({ worktreeRemoved: false })
        },
      })

      const refreshed = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const res = doneTask(
        refreshed,
        { ...DEFAULT_CONFIG, autoMerge: false },
        task.id,
        {
          cwd: tempDir,
          vcsProvider: mockVcs,
          noMerge: false,
        },
      )
      expect(res.isOk()).toBe(true)
      expect(forcedMergeExecuted).toBe(true)
      if (res.isOk()) {
        expect(res.value.gitSkipped).toBe(false)
        expect(res.value.task.column).toBe("03-done")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 7: Strict workflow transition guards: rejects done for tasks in backlog or todo", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-done-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // 1. Task in backlog
      const backlogTask = createTask(board, {
        title: "Backlog Item",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithBacklog = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const doneBacklogRes = doneTask(boardWithBacklog, DEFAULT_CONFIG, backlogTask.id, { cwd: tempDir })
      expect(doneBacklogRes.isErr()).toBe(true)
      if (doneBacklogRes.isErr()) {
        expect(doneBacklogRes.error.kind).toBe("INVALID_COLUMN_TRANSITION")
        expect(doneBacklogRes.error.message).toContain("Run 'dirban plan promote")
        if (doneBacklogRes.error.kind === "INVALID_COLUMN_TRANSITION") {
          expect(doneBacklogRes.error.currentColumn).toBe("backlog")
          expect(doneBacklogRes.error.expectedColumn).toBe("02-doing")
          expect(doneBacklogRes.error.suggestion).toBe(`dirban plan promote ${backlogTask.id}`)
        }
      }

      // 2. Task in 01-todo
      const todoTask = createTask(boardWithBacklog, {
        title: "Todo Item",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardWithTodo = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const doneTodoRes = doneTask(boardWithTodo, DEFAULT_CONFIG, todoTask.id, { cwd: tempDir })
      expect(doneTodoRes.isErr()).toBe(true)
      if (doneTodoRes.isErr()) {
        expect(doneTodoRes.error.kind).toBe("INVALID_COLUMN_TRANSITION")
        expect(doneTodoRes.error.message).toContain("Run 'dirban start")
        if (doneTodoRes.error.kind === "INVALID_COLUMN_TRANSITION") {
          expect(doneTodoRes.error.currentColumn).toBe("01-todo")
          expect(doneTodoRes.error.expectedColumn).toBe("02-doing")
          expect(doneTodoRes.error.suggestion).toBe(`dirban start ${todoTask.id}`)
        }
      }

      // 3. Task already in 03-done
      const doneTaskItem = createTask(boardWithTodo, {
        title: "Completed Item",
        column: "03-done",
      })._unsafeUnwrap()

      const boardWithDone = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const reDoneRes = doneTask(boardWithDone, DEFAULT_CONFIG, doneTaskItem.id, { cwd: tempDir })
      expect(reDoneRes.isErr()).toBe(true)
      if (reDoneRes.isErr()) {
        expect(reDoneRes.error.kind).toBe("ALREADY_COMPLETED")
        expect(reDoneRes.error.message).toContain("already completed in '03-done'")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
