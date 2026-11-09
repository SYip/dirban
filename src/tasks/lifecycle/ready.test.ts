import { describe, expect, it } from "bun:test"
import { parseReady, handleReady } from "./ready.cli.ts"
import { parsePlan, handlePlan } from "../planning/plan.cli.ts"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_CONFIG } from "../../config/config.ts"
import { initializeBoard } from "../project/init.ts"
import { createTask } from "../mutation/create.ts"
import { discoverBoard } from "../../board/discovery.ts"

describe("Ready Command and Backlog Filter Tests", () => {
  it("Vector 1 (Baseline): parseReady requires at least one task ID or 'all'", () => {
    const errRes = parseReady({
      flags: {},
      positionals: ["ready"],
      config: DEFAULT_CONFIG,
      cwd: process.cwd(),
    })
    expect(errRes.isErr()).toBe(true)

    const okRes = parseReady({
      flags: {},
      positionals: ["ready", "26-001", "26-002"],
      config: DEFAULT_CONFIG,
      cwd: process.cwd(),
    })
    expect(okRes.isOk()).toBe(true)
    if (okRes.isOk()) {
      expect(okRes.value.ids).toEqual(["26-001", "26-002"])
    }
  })

  it("Vector 2 (Execution): handleReady readies task from backlog into 01-todo", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "dirban-ready-test-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      const task = createTask(board, {
        title: "Test Ready Task",
        column: "backlog",
      })._unsafeUnwrap()

      const exitCode = await handleReady({
        flags: {},
        positionals: ["ready", task.id],
        config: DEFAULT_CONFIG,
        cwd: tempDir,
      })

      expect(exitCode).toBe(0)

      const updatedBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const inTodo = updatedBoard.columns.find((c) => c.name === "01-todo")?.tasks.find((t) => t.document.id === task.id)
      expect(inTodo).toBeDefined()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 3 (Filters): parsePlan supports --unblocked and --no-blocked", () => {
    const unblockedRes = parsePlan({
      flags: { unblocked: true },
      positionals: ["plan"],
      config: DEFAULT_CONFIG,
      cwd: process.cwd(),
    })
    expect(unblockedRes.isOk()).toBe(true)
    if (unblockedRes.isOk()) {
      expect(unblockedRes.value.mode).toBe("list")
      expect(unblockedRes.value.unblockedOnly).toBe(true)
    }

    const noBlockedRes = parsePlan({
      flags: { "no-blocked": true },
      positionals: ["plan"],
      config: DEFAULT_CONFIG,
      cwd: process.cwd(),
    })
    expect(noBlockedRes.isOk()).toBe(true)
    if (noBlockedRes.isOk()) {
      expect(noBlockedRes.value.unblockedOnly).toBe(true)
    }
  })
})
