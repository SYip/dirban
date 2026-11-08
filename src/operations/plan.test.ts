import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { discoverBoard } from "../board/discovery.ts"
import { DEFAULT_CONFIG } from "../config/config.ts"
import { evaluateTaskBlockers, isDependencyResolved } from "../board/dependencies.ts"
import { blockTask, unblockTask } from "./block.ts"
import { createTask } from "./create.ts"
import { initializeBoard } from "./init.ts"
import { moveTask } from "./move.ts"
import { partitionBacklog, promoteTask, promoteTasks } from "./plan.ts"

describe("Planning and Dependency Operations Tests", () => {
  it("Vector 12 (Block & Demotion): Appends blockers, normalizes IDs/paths/strings, and demotes to backlog", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-block-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create prerequisite task 26-001 in 01-todo
      const task1 = createTask(board, {
        title: "Database Schema",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardWithTask1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create dependent task 26-002 in 02-doing
      const task2 = createTask(boardWithTask1, {
        title: "API Endpoint",
        column: "02-doing",
      })._unsafeUnwrap()

      const boardWithBoth = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Block 26-002 with:
      // 1. Direct task ID "26-001"
      // 2. File path to task 1: "docs/tasks/01-todo/26-001-database-schema.md"
      // 3. Freeform text: "Waiting for external credentials"
      const blockRes = blockTask(boardWithBoth, task2.id, [
        task1.id,
        "docs/tasks/01-todo/26-001-database-schema.md",
        "Waiting for external credentials",
      ])

      expect(blockRes.isOk()).toBe(true)
      if (blockRes.isOk()) {
        const val = blockRes.value
        expect(val.demotedToBacklog).toBe(true)
        expect(val.task.column).toBe("backlog")
        // Normalized and deduplicated: 26-001 added only once + freeform text
        expect(val.task.document.frontmatter.relationships?.depends_on).toEqual([
          task1.id,
          "Waiting for external credentials",
        ])
      }

      // Verify file physically moved to backlog
      const reDiscovered = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const blockedTask = reDiscovered.columns
        .find((c) => c.name === "backlog")
        ?.tasks.find((t) => t.document.id === task2.id)

      expect(blockedTask != null).toBe(true)
      expect(blockedTask?.column).toBe("backlog")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 13 (Unblock & Dependency Resolution): Resolves task ID dependencies in done/archive, unblocks reasons one by one", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-unblock-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create task 26-001 in 01-todo
      const task1 = createTask(board, {
        title: "Prerequisite Task",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardWithTask1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create task 26-002 in backlog
      const task2 = createTask(boardWithTask1, {
        title: "Dependent Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithBoth = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Add two blockers to task 2: task 1 ID and external API key string
      blockTask(boardWithBoth, task2.id, [task1.id, "Waiting on API token"])._unsafeUnwrap()

      let currentBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      let depTask = currentBoard.columns
        .find((c) => c.name === "backlog")
        ?.tasks.find((t) => t.document.id === task2.id)!

      // Initially: both 26-001 (still in 01-todo) and "Waiting on API token" are unresolved
      let evaluation = evaluateTaskBlockers(depTask, currentBoard)
      expect(evaluation.isBlocked).toBe(true)
      expect(evaluation.unresolved.length).toBe(2)
      expect(isDependencyResolved(task1.id, currentBoard)).toBe(false)

      // Move prerequisite task 1 to 03-done
      moveTask(currentBoard, task1.id, "03-done")._unsafeUnwrap()

      currentBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      depTask = currentBoard.columns
        .find((c) => c.name === "backlog")
        ?.tasks.find((t) => t.document.id === task2.id)!

      // Now: task 1 is in 03-done so it is automatically resolved!
      expect(isDependencyResolved(task1.id, currentBoard)).toBe(true)
      evaluation = evaluateTaskBlockers(depTask, currentBoard)
      expect(evaluation.resolved).toEqual([task1.id])
      expect(evaluation.unresolved).toEqual(["Waiting on API token"])
      expect(evaluation.isBlocked).toBe(true) // Still blocked by external string

      // Try unblocking without specifying when multiple blockers exist -> fails with error
      const multiUnblockErr = unblockTask(currentBoard, task2.id)
      expect(multiUnblockErr.isErr()).toBe(true)

      // Unblock the specific external string
      const unblockRes = unblockTask(currentBoard, task2.id, "Waiting on API token")
      expect(unblockRes.isOk()).toBe(true)
      if (unblockRes.isOk()) {
        expect(unblockRes.value.removedBlockers).toEqual(["Waiting on API token"])
        expect(unblockRes.value.remainingBlockers).toEqual([task1.id])
      }

      // Check final evaluation: only task1 remains in depends_on, and task1 is in done column
      currentBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      depTask = currentBoard.columns
        .find((c) => c.name === "backlog")
        ?.tasks.find((t) => t.document.id === task2.id)!

      evaluation = evaluateTaskBlockers(depTask, currentBoard)
      expect(evaluation.isBlocked).toBe(false)
      expect(evaluation.unresolved.length).toBe(0)
      expect(evaluation.resolved).toEqual([task1.id])

      // Clear the remaining resolved dependency as well (single item remaining -> auto-cleared)
      const clearLastRes = unblockTask(currentBoard, task2.id)
      expect(clearLastRes.isOk()).toBe(true)
      if (clearLastRes.isOk()) {
        expect(clearLastRes.value.remainingBlockers.length).toBe(0)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 14 (Plan & Promote): Partitions backlog into ready/blocked and promotes to config.columns[0]", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-plan-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create ready task 1 in backlog
      const readyTask = createTask(board, {
        title: "Ready Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWith1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create blocked task 2 in backlog
      const blockedTask = createTask(boardWith1, {
        title: "Blocked Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWith2 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      blockTask(boardWith2, blockedTask.id, ["Waiting on human review"])._unsafeUnwrap()

      const boardPartitioned = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const plan = partitionBacklog(boardPartitioned)

      expect(plan.totalBacklog).toBe(2)
      expect(plan.ready.length).toBe(1)
      expect(plan.ready[0]?.task.document.id).toBe(readyTask.id)
      expect(plan.blocked.length).toBe(1)
      expect(plan.blocked[0]?.task.document.id).toBe(blockedTask.id)

      // Promote blocked task fails cleanly with error
      const promoteBlockedRes = promoteTask(boardPartitioned, DEFAULT_CONFIG, blockedTask.id)
      expect(promoteBlockedRes.isErr()).toBe(true)

      // Promote unblocked task succeeds and moves it to config.columns[0] ("01-todo")
      const promoteReadyRes = promoteTask(boardPartitioned, DEFAULT_CONFIG, readyTask.id)
      expect(promoteReadyRes.isOk()).toBe(true)
      if (promoteReadyRes.isOk()) {
        expect(promoteReadyRes.value.targetColumn).toBe("01-todo")
        expect(promoteReadyRes.value.task.column).toBe("01-todo")
      }

      // Verify on disk
      const finalBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const promotedInTodo = finalBoard.columns
        .find((c) => c.name === "01-todo")
        ?.tasks.find((t) => t.document.id === readyTask.id)

      expect(promotedInTodo != null).toBe(true)

      // Test batch promotion: promote multiple tasks and handle blocked tasks
      const batchTask1 = createTask(finalBoard, {
        title: "Batch Task 1",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithBatch1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const batchTask2 = createTask(boardWithBatch1, {
        title: "Batch Task 2",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithBothBatch = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Batch promote both unblocked tasks + the still-blocked task
      const batchRes = promoteTasks(
        boardWithBothBatch,
        DEFAULT_CONFIG,
        [batchTask1.id, blockedTask.id, batchTask2.id],
      )

      expect(batchRes.promoted.length).toBe(2)
      expect(batchRes.failed.length).toBe(1)
      expect(batchRes.failed[0]?.taskId).toBe(blockedTask.id)
      expect(batchRes.promoted.map((p) => p.task.document.id)).toEqual([
        batchTask1.id,
        batchTask2.id,
      ])
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
