import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { discoverBoard } from "../board/discovery.ts"
import { DEFAULT_CONFIG } from "../config/config.ts"
import type { DirbanConfig } from "../config/types.ts"
import { createTask } from "./create.ts"
import { initializeBoard } from "./init.ts"
import { resolveNextTask } from "./next.ts"
import { formatNextTaskView } from "../cli/formatters.ts"

describe("Resolve Next Task (dirban next)", () => {
  it("Vector 1 (Standard Baseline Case): Selects highest priority task from todo queue", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-next-standard-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      createTask(board, {
        title: "P2 Task in Todo",
        column: "01-todo",
        priority: "p2",
      })._unsafeUnwrap()

      createTask(board, {
        title: "P0 Critical Task in Todo",
        column: "01-todo",
        priority: "p0",
      })._unsafeUnwrap()

      createTask(board, {
        title: "P1 High Task in Todo",
        column: "01-todo",
        priority: "p1",
      })._unsafeUnwrap()

      const boardWithTasks = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const nextRes = resolveNextTask(boardWithTasks, DEFAULT_CONFIG)

      expect(nextRes.isOk()).toBe(true)
      if (nextRes.isOk()) {
        expect(nextRes.value.task.document.title).toBe("P0 Critical Task in Todo")
        expect(nextRes.value.task.document.priority).toBe("p0")
        expect(nextRes.value.sourceColumn).toBe("01-todo")
        expect(nextRes.value.queueCount).toBe(3)

        const formatted = formatNextTaskView(nextRes.value.task, nextRes.value.sourceColumn, nextRes.value.queueCount, tempDir)
        expect(formatted).toContain("Next Recommended Task")
        expect(formatted).toContain("P0 Critical Task in Todo")
        expect(formatted).toContain("dirban start")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 2 (Empty Todo Queue Guidance): Gracefully reports empty queue and suggests dirban plan", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-next-empty-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      const nextRes = resolveNextTask(board, DEFAULT_CONFIG)
      expect(nextRes.isErr()).toBe(true)
      if (nextRes.isErr()) {
        expect(nextRes.error.kind).toBe("QUEUE_EMPTY")
        if (nextRes.error.kind === "QUEUE_EMPTY") {
          expect(nextRes.error.sourceColumn).toBe("01-todo")
        }
        expect(nextRes.error.message).toContain("dirban plan")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 3 (Custom Focus Column Queue Resolution): Resolves queue preceding custom focusColumn", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-next-custom-"))
    try {
      const customConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        columns: ["ready", "develop", "review", "done"],
        focusColumn: "develop",
      }
      for (const col of customConfig.columns) {
        fs.mkdirSync(path.join(tempDir, "docs/tasks", col), { recursive: true })
      }
      const board = discoverBoard(customConfig, tempDir)._unsafeUnwrap()

      const created = createTask(board, {
        title: "Ready Feature Task",
        column: "ready",
        priority: "p1",
      })._unsafeUnwrap()

      const refreshed = discoverBoard(customConfig, tempDir)._unsafeUnwrap()
      const nextRes = resolveNextTask(refreshed, customConfig)

      expect(nextRes.isOk()).toBe(true)
      if (nextRes.isOk()) {
        expect(nextRes.value.task.document.id).toBe(created.id)
        expect(nextRes.value.sourceColumn).toBe("ready")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
