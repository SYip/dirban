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
import { startTask } from "./start.ts"

describe("Start Task Operations (startTask)", () => {
  it("Vector 1: Transitions task to focus column ('02-doing') in non-git filesystem", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-start-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const created = createTask(board, {
        title: "Lifecycle Feature",
        priority: "p1",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardWithTask = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const startRes = startTask(boardWithTask, DEFAULT_CONFIG, created.id, { cwd: tempDir })
      expect(startRes.isOk()).toBe(true)
      if (startRes.isOk()) {
        expect(startRes.value.task.column).toBe("02-doing")
        expect(startRes.value.gitSkipped).toBe(true)
        expect(startRes.value.branchName).toBe(`task/${created.id}-lifecycle-feature`)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 2: ALREADY_STARTED guard: fails when already on task branch", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-start-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const created = createTask(board, {
        title: "Active Branch Feature",
        priority: "p1",
        column: "01-todo",
      })._unsafeUnwrap()

      const baseNoop = new NoopVcsProvider()
      const mockGitVcs: VersionControlProvider = Object.assign(Object.create(baseNoop), {
        getContext: () => ({
          isAvailable: true,
          currentBranch: `task/${created.id}-active-branch-feature`,
          repoRoot: tempDir,
          isWorktree: false,
        }),
      })

      const boardWithTask = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const restartRes = startTask(boardWithTask, DEFAULT_CONFIG, created.id, {
        cwd: tempDir,
        vcsProvider: mockGitVcs,
      })
      expect(restartRes.isErr()).toBe(true)
      if (restartRes.isErr()) {
        expect(restartRes.error.kind).toBe("ALREADY_STARTED")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 3: ALREADY_STARTED guard: fails when worktree already exists for task", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-start-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const created = createTask(board, {
        title: "Active Worktree Feature",
        priority: "p1",
        column: "01-todo",
      })._unsafeUnwrap()

      const baseNoop = new NoopVcsProvider()
      const mockWorktreeVcs: VersionControlProvider = Object.assign(Object.create(baseNoop), {
        getContext: () => ({
          isAvailable: true,
          currentBranch: "main",
          repoRoot: tempDir,
          isWorktree: false,
        }),
        resolveWorktreePath: () => ok(path.join(tempDir, "existing-worktree")),
      })

      const boardWithTask = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const startWorktreeRes = startTask(boardWithTask, DEFAULT_CONFIG, created.id, {
        cwd: tempDir,
        strategy: "worktree",
        vcsProvider: mockWorktreeVcs,
      })
      expect(startWorktreeRes.isErr()).toBe(true)
      if (startWorktreeRes.isErr()) {
        expect(startWorktreeRes.error.kind).toBe("ALREADY_STARTED")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 4: Transitions task to custom focusColumn ('develop')", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-start-"))
    try {
      const customWorkflowConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        columns: ["todo", "develop", "test", "production"],
        focusColumn: "develop",
      }
      for (const col of customWorkflowConfig.columns) {
        fs.mkdirSync(path.join(tempDir, "docs/tasks", col), { recursive: true })
      }
      const boardCustom = discoverBoard(customWorkflowConfig, tempDir)._unsafeUnwrap()
      const customTask = createTask(boardCustom, {
        title: "Custom Flow Feature",
        column: "todo",
      })._unsafeUnwrap()

      const boardWithCustom = discoverBoard(customWorkflowConfig, tempDir)._unsafeUnwrap()
      const startCustomRes = startTask(boardWithCustom, customWorkflowConfig, customTask.id, { cwd: tempDir })
      expect(startCustomRes.isOk()).toBe(true)
      if (startCustomRes.isOk()) {
        expect(startCustomRes.value.task.column).toBe("develop")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 5: Custom workspace strategy delegation in startTask", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-start-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const task = createTask(board, {
        title: "Strategy Task",
        column: "01-todo",
      })._unsafeUnwrap()

      let startHookCalled = false
      const trackingStrategy = {
        name: "directory-only" as const,
        onStart: () => {
          startHookCalled = true
          return ok({
            branchName: "custom/branch",
            strategy: "directory-only" as const,
            gitSkipped: true,
          })
        },
        onDone: () => ok({ gitSkipped: true }),
      }

      const refreshedBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const res = startTask(refreshedBoard, DEFAULT_CONFIG, task.id, {
        cwd: tempDir,
        workspaceStrategy: trackingStrategy,
      })
      expect(res.isOk()).toBe(true)
      expect(startHookCalled).toBe(true)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 6: Supports strategy 'none' / CurrentBranchStrategy", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-start-"))
    try {
      const noneConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        branchStrategy: "none",
        autoMerge: false,
      }
      initializeBoard(noneConfig, tempDir)
      const board = discoverBoard(noneConfig, tempDir)._unsafeUnwrap()
      const task = createTask(board, {
        title: "Current Branch Task",
        column: "01-todo",
      })._unsafeUnwrap()

      const refreshed = discoverBoard(noneConfig, tempDir)._unsafeUnwrap()
      const res = startTask(refreshed, noneConfig, task.id, { cwd: tempDir })
      expect(res.isOk()).toBe(true)
      if (res.isOk()) {
        expect(res.value.strategy).toBe("none")
        expect(res.value.gitSkipped).toBe(true)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 7: Strict workflow transition guards: rejects start from backlog or completed", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-start-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // 1. Task in backlog
      const backlogTask = createTask(board, {
        title: "Backlog Item",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithBacklog = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const startBacklogRes = startTask(boardWithBacklog, DEFAULT_CONFIG, backlogTask.id, { cwd: tempDir })
      expect(startBacklogRes.isErr()).toBe(true)
      if (startBacklogRes.isErr()) {
        expect(startBacklogRes.error.kind).toBe("INVALID_COLUMN_TRANSITION")
        expect(startBacklogRes.error.message).toContain("Run 'dirban plan promote")
        if (startBacklogRes.error.kind === "INVALID_COLUMN_TRANSITION") {
          expect(startBacklogRes.error.currentColumn).toBe("backlog")
          expect(startBacklogRes.error.expectedColumn).toBe("01-todo")
          expect(startBacklogRes.error.suggestion).toBe(`dirban plan promote ${backlogTask.id}`)
        }
      }

      // 2. Task already in 02-doing
      const doingTask = createTask(boardWithBacklog, {
        title: "Doing Item",
        column: "02-doing",
      })._unsafeUnwrap()

      const boardWithDoing = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const startDoingRes = startTask(boardWithDoing, DEFAULT_CONFIG, doingTask.id, { cwd: tempDir })
      expect(startDoingRes.isErr()).toBe(true)
      if (startDoingRes.isErr()) {
        expect(startDoingRes.error.kind).toBe("ALREADY_STARTED")
        expect(startDoingRes.error.message).toBe(`Task ${doingTask.id} is already in '02-doing'.`)
      }

      // 3. Task in 03-done (completed)
      const doneTask = createTask(boardWithDoing, {
        title: "Done Item",
        column: "03-done",
      })._unsafeUnwrap()

      const boardWithDone = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const startDoneRes = startTask(boardWithDone, DEFAULT_CONFIG, doneTask.id, { cwd: tempDir })
      expect(startDoneRes.isErr()).toBe(true)
      if (startDoneRes.isErr()) {
        expect(startDoneRes.error.kind).toBe("INVALID_COLUMN_TRANSITION")
        expect(startDoneRes.error.message).toContain("already completed in '03-done'")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
