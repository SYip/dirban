import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { discoverBoard } from "../../board/discovery.ts"
import { DEFAULT_CONFIG } from "../../config/config.ts"
import { createTask } from "../mutation/create.ts"
import { initializeBoard } from "../project/init.ts"
import { moveTask } from "../mutation/move.ts"
import { resolveCurrentTask } from "./current.ts"

describe("Current Task Resolution (resolveCurrentTask)", () => {
  it("Vector 1: Returns NO_ACTIVE_TASK in non-git directory when 0 tasks are in focus/doing column", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-current-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isErr()) return

      const res = resolveCurrentTask(boardRes.value, DEFAULT_CONFIG, undefined, tempDir)
      expect(res.isErr()).toBe(true)
      if (res.isErr()) {
        expect(res.error.message).toBe("No task currently in progress.")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 2: Resolves explicit task ID by lookup regardless of column", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-current-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const created = createTask(board, {
        title: "Explicit Task",
        priority: "p2",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardAfter = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const res = resolveCurrentTask(boardAfter, DEFAULT_CONFIG, created.id, tempDir)
      expect(res.isOk()).toBe(true)
      if (res.isOk()) {
        expect(res.value.source).toBe("explicit")
        expect(res.value.task.document.id).toBe(created.id)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 3: Resolves single active task in doing column", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-current-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const created = createTask(board, {
        title: "Active Doing Task",
        priority: "p2",
        column: "02-doing",
      })._unsafeUnwrap()

      const boardAfter = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const res = resolveCurrentTask(boardAfter, DEFAULT_CONFIG, undefined, tempDir)
      expect(res.isOk()).toBe(true)
      if (res.isOk()) {
        expect(res.value.source).toBe("doing-column")
        expect(res.value.multipleInDoing).toBe(false)
        expect(res.value.task.document.id).toBe(created.id)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 4: Selects highest priority task when multiple tasks exist in doing column", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-current-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      createTask(board, {
        title: "P2 Task",
        priority: "p2",
        column: "02-doing",
      })._unsafeUnwrap()

      const boardWithFirst = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      createTask(boardWithFirst, {
        title: "P0 Task",
        priority: "p0",
        column: "02-doing",
      })._unsafeUnwrap()

      const boardWithBoth = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const res = resolveCurrentTask(boardWithBoth, DEFAULT_CONFIG, undefined, tempDir)
      expect(res.isOk()).toBe(true)
      if (res.isOk()) {
        expect(res.value.source).toBe("doing-column")
        expect(res.value.multipleInDoing).toBe(true)
        expect(res.value.doingCount).toBe(2)
        expect(res.value.task.document.priority).toBe("p0")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 5: Resolves active task in custom focusColumn ('develop')", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-current-"))
    try {
      const customConfig = {
        ...DEFAULT_CONFIG,
        columns: ["todo", "develop", "test"],
        focusColumn: "develop",
      }
      for (const col of customConfig.columns) {
        fs.mkdirSync(path.join(tempDir, "docs/tasks", col), { recursive: true })
      }
      const board = discoverBoard(customConfig, tempDir)._unsafeUnwrap()
      const task = createTask(board, {
        title: "Custom Flow Task",
        column: "develop",
      })._unsafeUnwrap()

      const boardAfter = discoverBoard(customConfig, tempDir)._unsafeUnwrap()
      const res = resolveCurrentTask(boardAfter, customConfig, undefined, tempDir)
      expect(res.isOk()).toBe(true)
      if (res.isOk()) {
        expect(res.value.task.column).toBe("develop")
        expect(res.value.task.document.id).toBe(task.id)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 6: Fails gracefully when board has no focus column and zero columns", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-current-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const zeroColConfig = {
        ...DEFAULT_CONFIG,
        columns: [],
        focusColumn: undefined,
      }
      const board = discoverBoard(zeroColConfig, tempDir)._unsafeUnwrap()
      createTask(board, {
        title: "Zero Column Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithZero = discoverBoard(zeroColConfig, tempDir)._unsafeUnwrap()
      const res = resolveCurrentTask(boardWithZero, zeroColConfig, undefined, tempDir)
      expect(res.isErr()).toBe(true)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
