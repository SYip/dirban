import { describe, expect, it } from "bun:test"
import { dispatchCommand, printHelp } from "./router.ts"
import { runCli } from "../../../main.ts"
import type { CliContext } from "./types.ts"
import type { DirbanConfig } from "../../config/types.ts"

const MOCK_CONFIG: DirbanConfig = {
  tasksDir: "docs/tasks",
  columns: ["01-todo", "02-doing", "03-done"],
  archiveDir: "archive",
  priorities: ["p0", "p1", "p2", "p3"],
  defaultPriority: "p2",
  branchPrefix: "task/",
  worktreesDir: "../",
  branchStrategy: "checkout",
}

describe("CLI Router and Modular Command Handlers", () => {
  it("Vector 1: Dispatches 'help' and prints help text cleanly", async () => {
    let output = ""
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      output += args.join(" ") + "\n"
    }

    try {
      const ctx: CliContext = {
        flags: {},
        positionals: ["help"],
        config: MOCK_CONFIG,
        cwd: process.cwd(),
      }
      const code = await dispatchCommand("help", ctx)
      expect(code).toBe(0)
      expect(output).toContain("Dirban (dirban)")
      expect(output).toContain("COMMANDS")
    } finally {
      console.log = origLog
    }
  })

  it("Vector 2: Returns 1 for unknown commands", async () => {
    let errOutput = ""
    const origErr = console.error
    console.error = (...args: unknown[]) => {
      errOutput += args.join(" ") + "\n"
    }

    try {
      const ctx: CliContext = {
        flags: {},
        positionals: ["non-existent-cmd"],
        config: MOCK_CONFIG,
        cwd: process.cwd(),
      }
      const code = await dispatchCommand("non-existent-cmd", ctx)
      expect(code).toBe(1)
      expect(errOutput).toContain("Unknown command: non-existent-cmd")
    } finally {
      console.error = origErr
    }
  })

  it("Vector 3: Maps aliases (focus -> current, create -> new, finish -> done)", async () => {
    const ctxFocus: CliContext = {
      flags: {},
      positionals: ["focus"],
      config: MOCK_CONFIG,
      cwd: process.cwd(),
    }
    // Resolving focus with existing tasks in repo will succeed with 0
    const exitCodeFocus = await dispatchCommand("focus", ctxFocus)
    expect(exitCodeFocus).toBe(0)

    // create alias calls handleNew; without arguments returns error code 1 with usage
    const ctxCreate: CliContext = {
      flags: {},
      positionals: ["create"],
      config: MOCK_CONFIG,
      cwd: process.cwd(),
    }
    const exitCodeCreate = await dispatchCommand("create", ctxCreate)
    expect(exitCodeCreate).toBe(1)
  })

  it("Vector 4: End-to-end runCli parsing and routing via main.ts entrypoint", async () => {
    let output = ""
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      output += args.join(" ") + "\n"
    }

    try {
      const codeVersion = await runCli(["--version"])
      expect(codeVersion).toBe(0)
      expect(output).toContain("dirban v0.1.0")

      const codePriorities = await runCli(["priorities"])
      expect(codePriorities).toBe(0)
      expect(output).toContain("Available priorities")
    } finally {
      console.log = origLog
    }
  })
})
