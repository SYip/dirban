import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { ok } from "neverthrow"
import { discoverBoard } from "../board/discovery.ts"
import { DEFAULT_CONFIG } from "../config/config.ts"
import type { DirbanConfig } from "../config/types.ts"
import { NoopVcsProvider, type VersionControlProvider } from "../vcs/index.ts"
import { createTask } from "./create.ts"
import { initializeBoard } from "./init.ts"
import { moveTask } from "./move.ts"
import { resolveCurrentTask } from "./current.ts"
import { startTask } from "./start.ts"
import { doneTask } from "./done.ts"

describe("Task Lifecycle Operations Tests", () => {
  it("Vector 10 (Current task resolution): Explicit ID, Doing column, and priority fallback", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-current-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isErr()) return

      // Non-git directory: 0 tasks in doing -> NO_ACTIVE_TASK
      const res0 = resolveCurrentTask(boardRes.value, DEFAULT_CONFIG, undefined, tempDir)
      expect(res0.isErr()).toBe(true)
      if (res0.isErr()) {
        expect(res0.error.message).toBe("No task currently in progress.")
      }

      // Create a task in 01-todo and an explicit lookup
      const create1 = createTask(boardRes.value, {
        title: "Task One",
        priority: "p2",
        column: "01-todo",
      })
      expect(create1.isOk()).toBe(true)
      if (create1.isErr()) return

      const boardAfter1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const explicitRes = resolveCurrentTask(boardAfter1, DEFAULT_CONFIG, create1.value.id, tempDir)
      expect(explicitRes.isOk()).toBe(true)
      if (explicitRes.isOk()) {
        expect(explicitRes.value.source).toBe("explicit")
        expect(explicitRes.value.task.document.id).toBe(create1.value.id)
      }

      // Move Task 1 to 02-doing -> single doing task
      moveTask(boardAfter1, create1.value.id, "02-doing")
      const boardAfterMove = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const res1 = resolveCurrentTask(boardAfterMove, DEFAULT_CONFIG, undefined, tempDir)
      expect(res1.isOk()).toBe(true)
      if (res1.isOk()) {
        expect(res1.value.source).toBe("doing-column")
        expect(res1.value.multipleInDoing).toBe(false)
        expect(res1.value.task.document.id).toBe(create1.value.id)
      }

      // Add higher priority task to 02-doing -> picks highest priority (p0 over p2)
      createTask(boardAfterMove, {
        title: "High Priority Task",
        priority: "p0",
        column: "02-doing",
      })
      const boardAfter2 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const resMulti = resolveCurrentTask(boardAfter2, DEFAULT_CONFIG, undefined, tempDir)
      expect(resMulti.isOk()).toBe(true)
      if (resMulti.isOk()) {
        expect(resMulti.value.source).toBe("doing-column")
        expect(resMulti.value.multipleInDoing).toBe(true)
        expect(resMulti.value.doingCount).toBe(2)
        expect(resMulti.value.task.document.priority).toBe("p0")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 11 (Start and Done lifecycle - non-git filesystem fallback): Transitions tasks cleanly", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-lifecycle-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isErr()) return

      const created = createTask(boardRes.value, {
        title: "Lifecycle Feature",
        priority: "p1",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardWithTask = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // 1. dirban start <id> in non-git directory
      const startRes = startTask(boardWithTask, DEFAULT_CONFIG, created.id, { cwd: tempDir })
      expect(startRes.isOk()).toBe(true)
      if (startRes.isOk()) {
        expect(startRes.value.task.column).toBe("02-doing")
        expect(startRes.value.gitSkipped).toBe(true)
        expect(startRes.value.branchName).toBe(`task/${created.id}-lifecycle-feature`)
      }

      // 1b. Guard check: starting a task when already on that branch fails with ALREADY_STARTED
      const baseNoop = new NoopVcsProvider()
      const mockGitVcs: VersionControlProvider = Object.assign(Object.create(baseNoop), {
        getContext: () => ({
          isAvailable: true,
          currentBranch: `task/${created.id}-lifecycle-feature`,
          repoRoot: tempDir,
          isWorktree: false,
        }),
      })
      const restartRes = startTask(boardWithTask, DEFAULT_CONFIG, created.id, {
        cwd: tempDir,
        vcsProvider: mockGitVcs,
      })
      expect(restartRes.isErr()).toBe(true)
      if (restartRes.isErr()) {
        expect(restartRes.error.kind).toBe("ALREADY_STARTED")
      }

      // 1c. Worktree guard check: starting with worktree strategy when worktree already exists fails
      const mockWorktreeVcs: VersionControlProvider = Object.assign(Object.create(baseNoop), {
        getContext: () => ({
          isAvailable: true,
          currentBranch: "main",
          repoRoot: tempDir,
          isWorktree: false,
        }),
        resolveWorktreePath: () => ok(path.join(tempDir, "existing-worktree")),
      })
      const startWorktreeRes = startTask(boardWithTask, DEFAULT_CONFIG, created.id, {
        cwd: tempDir,
        strategy: "worktree",
        vcsProvider: mockWorktreeVcs,
      })
      expect(startWorktreeRes.isErr()).toBe(true)
      if (startWorktreeRes.isErr()) {
        expect(startWorktreeRes.error.kind).toBe("ALREADY_STARTED")
      }

      // 2. dirban done in non-git directory without explicit ID (picks single doing task)
      const boardInDoing = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const doneRes = doneTask(boardInDoing, DEFAULT_CONFIG, undefined, { cwd: tempDir })
      expect(doneRes.isOk()).toBe(true)
      if (doneRes.isOk()) {
        expect(doneRes.value.task.column).toBe("03-done")
        expect(doneRes.value.gitSkipped).toBe(true)
        expect(doneRes.value.uncheckedCount).toBe(1)
      }

      // 3. Custom workflow with explicit focusColumn ("develop") and relative focus + 1 ("test")
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

      // Verify current picks active task in "develop"
      const boardInDevelop = discoverBoard(customWorkflowConfig, tempDir)._unsafeUnwrap()
      const currentCustomRes = resolveCurrentTask(boardInDevelop, customWorkflowConfig, undefined, tempDir)
      expect(currentCustomRes.isOk()).toBe(true)
      if (currentCustomRes.isOk()) {
        expect(currentCustomRes.value.task.column).toBe("develop")
        expect(currentCustomRes.value.task.document.id).toBe(customTask.id)
      }

      // Verify done transitions task from "develop" to "test" (focus + 1)
      const doneCustomRes = doneTask(boardInDevelop, customWorkflowConfig, undefined, { cwd: tempDir })
      expect(doneCustomRes.isOk()).toBe(true)
      if (doneCustomRes.isOk()) {
        expect(doneCustomRes.value.task.column).toBe("test")
      }

      // 4. Zero-column workflow (columns: []): backlog -> archive transition
      const zeroColConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        columns: [],
        focusColumn: undefined,
      }
      const boardZero = discoverBoard(zeroColConfig, tempDir)._unsafeUnwrap()
      const zeroTask = createTask(boardZero, {
        title: "Zero Column Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithZero = discoverBoard(zeroColConfig, tempDir)._unsafeUnwrap()
      const currentZeroRes = resolveCurrentTask(boardWithZero, zeroColConfig, undefined, tempDir)
      expect(currentZeroRes.isErr()).toBe(true)

      const doneZeroRes = doneTask(boardWithZero, zeroColConfig, zeroTask.id, { cwd: tempDir })
      expect(doneZeroRes.isOk()).toBe(true)
      if (doneZeroRes.isOk()) {
        expect(doneZeroRes.value.task.column).toContain("archive")
      }

      // 5. Strategy delegation verification in startTask and doneTask
      const customStrategyTrack: string[] = []
      const trackingStrategy = {
        name: "directory-only" as const,
        onStart: () => {
          customStrategyTrack.push("onStart")
          return ok({
            branchName: "custom/branch",
            strategy: "directory-only" as const,
            gitSkipped: true,
          })
        },
        onDone: () => {
          customStrategyTrack.push("onDone")
          return ok({
            gitSkipped: true,
          })
        },
      }

      const boardForTracking = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const taskForTracking = createTask(boardForTracking, {
        title: "Tracking Task",
        column: "01-todo",
      })._unsafeUnwrap()
      const refreshedBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      const startWithStrategyRes = startTask(refreshedBoard, DEFAULT_CONFIG, taskForTracking.id, {
        cwd: tempDir,
        workspaceStrategy: trackingStrategy,
      })
      expect(startWithStrategyRes.isOk()).toBe(true)
      expect(customStrategyTrack).toContain("onStart")

      const boardForDoneTracking = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const doneWithStrategyRes = doneTask(boardForDoneTracking, DEFAULT_CONFIG, taskForTracking.id, {
        cwd: tempDir,
        workspaceStrategy: trackingStrategy,
      })
      expect(doneWithStrategyRes.isOk()).toBe(true)
      expect(customStrategyTrack).toContain("onDone")

      // 6. Support strategy 'none' / CurrentBranchStrategy across startTask and doneTask
      const noneConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        branchStrategy: "none",
        autoMerge: false,
      }
      const boardForNone = discoverBoard(noneConfig, tempDir)._unsafeUnwrap()
      const taskForNone = createTask(boardForNone, {
        title: "Current Branch Task",
        column: "01-todo",
      })._unsafeUnwrap()
      const refreshedNoneBoard = discoverBoard(noneConfig, tempDir)._unsafeUnwrap()

      const startNoneRes = startTask(refreshedNoneBoard, noneConfig, taskForNone.id, {
        cwd: tempDir,
      })
      expect(startNoneRes.isOk()).toBe(true)
      if (startNoneRes.isOk()) {
        expect(startNoneRes.value.strategy).toBe("none")
        expect(startNoneRes.value.gitSkipped).toBe(true)
      }

      const boardForDoneNone = discoverBoard(noneConfig, tempDir)._unsafeUnwrap()
      const doneNoneRes = doneTask(boardForDoneNone, noneConfig, taskForNone.id, {
        cwd: tempDir,
        noMerge: true,
      })
      expect(doneNoneRes.isOk()).toBe(true)
      if (doneNoneRes.isOk()) {
        expect(doneNoneRes.value.gitSkipped).toBe(true)
        expect(doneNoneRes.value.task.column).toBe("03-done")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
