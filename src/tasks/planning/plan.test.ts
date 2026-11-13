import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { evaluateTaskBlockers, isDependencyResolved } from "../../board/dependencies.ts"
import { discoverBoard } from "../../board/discovery.ts"
import { DEFAULT_CONFIG } from "../../config/config.ts"
import { createTask } from "../mutation/create.ts"
import { moveTask } from "../mutation/move.ts"
import { initializeBoard } from "../project/init.ts"
import { blockTask, unblockTask } from "./block.ts"
import { partitionBacklog, promoteTask, promoteTasks, resolveBacklogTaskId } from "./plan.ts"

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
        expect(val.task.column).toBe("00-backlog")
        // Normalized and deduplicated: 26-001 added only once + freeform text
        expect(val.task.document.frontmatter.relationships?.depends_on).toEqual([
          task1.id,
          "Waiting for external credentials",
        ])
      }

      // Verify file physically moved to backlog
      const reDiscovered = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const blockedTask = reDiscovered.columns
        .find((c) => c.name === "00-backlog")
        ?.tasks.find((t) => t.document.id === task2.id)

      expect(blockedTask != null).toBe(true)
      expect(blockedTask?.column).toBe("00-backlog")
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
        column: "00-backlog",
      })._unsafeUnwrap()

      const boardWithBoth = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Add two blockers to task 2: task 1 ID and external API key string
      blockTask(boardWithBoth, task2.id, [task1.id, "Waiting on API token"])._unsafeUnwrap()

      let currentBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      let depTask = currentBoard.columns
        .find((c) => c.name === "00-backlog")
        ?.tasks.find((t) => t.document.id === task2.id)
      if (!depTask) throw new Error("depTask not found")

      // Initially: both 26-001 (still in 01-todo) and "Waiting on API token" are unresolved
      let evaluation = evaluateTaskBlockers(depTask, currentBoard)
      expect(evaluation.isBlocked).toBe(true)
      expect(evaluation.unresolved.length).toBe(2)
      expect(isDependencyResolved(task1.id, currentBoard)).toBe(false)

      // Move prerequisite task 1 to 03-done
      moveTask(currentBoard, task1.id, "03-done")._unsafeUnwrap()

      currentBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      depTask = currentBoard.columns
        .find((c) => c.name === "00-backlog")
        ?.tasks.find((t) => t.document.id === task2.id)
      if (!depTask) throw new Error("depTask not found")

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
        .find((c) => c.name === "00-backlog")
        ?.tasks.find((t) => t.document.id === task2.id)
      if (!depTask) throw new Error("depTask not found")

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
        column: "00-backlog",
      })._unsafeUnwrap()

      const boardWith1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create blocked task 2 in backlog
      const blockedTask = createTask(boardWith1, {
        title: "Blocked Task",
        column: "00-backlog",
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
        column: "00-backlog",
      })._unsafeUnwrap()

      const boardWithBatch1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const batchTask2 = createTask(boardWithBatch1, {
        title: "Batch Task 2",
        column: "00-backlog",
      })._unsafeUnwrap()

      const boardWithBothBatch = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Atomic batch promotion: if any task is blocked, 0 tasks are moved
      const batchRes = promoteTasks(boardWithBothBatch, DEFAULT_CONFIG, [
        batchTask1.id,
        blockedTask.id,
        batchTask2.id,
      ])

      expect(batchRes.promoted.length).toBe(0)
      expect(batchRes.failed.length).toBe(1)
      expect(batchRes.failed[0]?.taskId).toBe(blockedTask.id)

      // When all tasks are valid, all are promoted
      const validBatchRes = promoteTasks(boardWithBothBatch, DEFAULT_CONFIG, [
        batchTask1.id,
        batchTask2.id,
      ])

      expect(validBatchRes.promoted.length).toBe(2)
      expect(validBatchRes.failed.length).toBe(0)
      expect(validBatchRes.promoted.map((p) => p.task.document.id)).toEqual([
        batchTask1.id,
        batchTask2.id,
      ])
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 15 (Short Task ID & Ambiguity Resolution): Resolves numeric suffix and detects ambiguities", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-short-id-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create task 26-001 in backlog
      const task1 = createTask(board, {
        title: "Unique Suffix Task",
        column: "00-backlog",
      })._unsafeUnwrap()

      const boardWithTask1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const backlogCol = boardWithTask1.columns.find((c) => c.name === "00-backlog")
      expect(backlogCol != null).toBe(true)
      if (backlogCol == null) return

      // 1. Short ID "001" and "1" resolves to 26-001
      const res001 = resolveBacklogTaskId(backlogCol.tasks, "001")
      expect(res001.isOk()).toBe(true)
      expect(res001._unsafeUnwrap().document.id).toBe(task1.id)

      const res1 = resolveBacklogTaskId(backlogCol.tasks, "1")
      expect(res1.isOk()).toBe(true)
      expect(res1._unsafeUnwrap().document.id).toBe(task1.id)

      // Promote using short ID "001"
      const promoteRes = promoteTask(boardWithTask1, DEFAULT_CONFIG, "001")
      expect(promoteRes.isOk()).toBe(true)
      expect(promoteRes._unsafeUnwrap().task.document.id).toBe(task1.id)

      // Move task back to backlog to test ambiguity
      const boardMoved = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      moveTask(boardMoved, task1.id, "00-backlog")._unsafeUnwrap()

      // Manually create another task in backlog with the same numeric suffix: "25-001"
      const taskPath25 = path.join(tempDir, "docs/tasks/00-backlog/25-001-legacy-task.md")
      fs.writeFileSync(
        taskPath25,
        `---
okf_version: "1.0"
id: "25-001"
title: "Legacy Task"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2025-10-10"
last_updated: "2025-10-10"
tags: []
relationships:
  depends_on: []
  blocks: []
  related_to: []
---

# Legacy Task
`,
        "utf-8",
      )

      const boardWithAmbiguity = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const backlogAmbiguous =
        boardWithAmbiguity.columns.find((c) => c.name === "00-backlog")?.tasks ?? []

      // 2. Querying "001" or "1" now returns AMBIGUOUS_TASK_ID
      const ambiguousRes = resolveBacklogTaskId(backlogAmbiguous, "001")
      expect(ambiguousRes.isErr()).toBe(true)
      if (ambiguousRes.isErr()) {
        expect(ambiguousRes.error.kind).toBe("AMBIGUOUS_TASK_ID")
        if (ambiguousRes.error.kind === "AMBIGUOUS_TASK_ID") {
          expect(ambiguousRes.error.matches).toContain("25-001")
          expect(ambiguousRes.error.matches).toContain(task1.id)
        }
      }

      // Batch promotion with ambiguous ID aborts without moving anything
      const batchAmbiguousRes = promoteTasks(boardWithAmbiguity, DEFAULT_CONFIG, ["001"])
      expect(batchAmbiguousRes.promoted.length).toBe(0)
      expect(batchAmbiguousRes.failed.length).toBe(1)
      expect(batchAmbiguousRes.failed[0]?.error.kind).toBe("AMBIGUOUS_TASK_ID")

      // 3. Informative error when task is already in another column (cross-board awareness)
      const inTodoTask = createTask(boardWithAmbiguity, {
        title: "Already in Todo",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardWithTodo = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const promoteAlreadyInTodo = promoteTasks(boardWithTodo, DEFAULT_CONFIG, [inTodoTask.id])
      expect(promoteAlreadyInTodo.promoted.length).toBe(0)
      expect(promoteAlreadyInTodo.failed.length).toBe(1)
      expect(promoteAlreadyInTodo.failed[0]?.error.message).toContain("already in '01-todo'")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
