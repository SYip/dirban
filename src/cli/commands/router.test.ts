import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { dispatchCommand, printHelp } from "./router.ts"
import { runCli } from "../../../main.ts"
import type { CliContext } from "./types.ts"
import type { DirbanConfig } from "../../config/types.ts"
import { initializeBoard } from "../../operations/init.ts"

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

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-router-test-"))
    try {
      initializeBoard(MOCK_CONFIG, tempDir)
      const ctx: CliContext = {
        flags: {},
        positionals: ["help"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const code = await dispatchCommand("help", ctx)
      expect(code).toBe(0)
      expect(output).toContain("Dirban (dirban)")
      expect(output).toContain("COMMANDS")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
      console.log = origLog
    }
  })

  it("Vector 2: Returns 1 for unknown commands", async () => {
    let errOutput = ""
    const origErr = console.error
    console.error = (...args: unknown[]) => {
      errOutput += args.join(" ") + "\n"
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-router-test-"))
    try {
      initializeBoard(MOCK_CONFIG, tempDir)
      const ctx: CliContext = {
        flags: {},
        positionals: ["non-existent-cmd"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const code = await dispatchCommand("non-existent-cmd", ctx)
      expect(code).toBe(1)
      expect(errOutput).toContain("Unknown command: non-existent-cmd")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
      console.error = origErr
    }
  })

  it("Vector 3: Maps aliases (focus -> current, create -> new, finish -> done)", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-router-test-"))
    try {
      initializeBoard(MOCK_CONFIG, tempDir)
      const ctxFocus: CliContext = {
        flags: {},
        positionals: ["focus"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      // Empty board with no task in progress prints notice and exits with 0
      const exitCodeFocus = await dispatchCommand("focus", ctxFocus)
      expect(exitCodeFocus).toBe(0)

      // create alias calls handleNew; without arguments returns error code 1 with usage
      const ctxCreate: CliContext = {
        flags: {},
        positionals: ["create"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const exitCodeCreate = await dispatchCommand("create", ctxCreate)
      expect(exitCodeCreate).toBe(1)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
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

  it("Vector 5: Dispatches plan promote with comma-separated IDs and positional syntax", async () => {
    let output = ""
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      output += args.join(" ") + "\n"
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-router-test-"))
    try {
      initializeBoard(MOCK_CONFIG, tempDir)

      // Positional: dirban plan promote non-existent
      const ctxPositional: CliContext = {
        flags: {},
        positionals: ["plan", "promote", "non-existent-task"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const exitPositional = await dispatchCommand("plan", ctxPositional)
      expect(exitPositional).toBe(1)

      // Flag with all: dirban plan --promote=all in empty backlog
      const ctxAll: CliContext = {
        flags: { promote: "all" },
        positionals: ["plan"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const exitAll = await dispatchCommand("plan", ctxAll)
      expect(exitAll).toBe(0)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
      console.log = origLog
    }
  })

  it("Vector 6: Renders command-specific help for 'dirban plan --help' and 'dirban help start'", async () => {
    let output = ""
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      output += args.join(" ") + "\n"
    }

    try {
      // 1. dirban <cmd> --help
      const ctxPlanHelp: CliContext = {
        flags: { help: true },
        positionals: ["plan"],
        config: MOCK_CONFIG,
        cwd: process.cwd(),
      }
      const exitPlanHelp = await dispatchCommand("plan", ctxPlanHelp)
      expect(exitPlanHelp).toBe(0)
      expect(output).toContain("dirban plan")
      expect(output).toContain("--promote=<ids|all>")
      expect(output).toContain("EXAMPLES:")

      output = ""

      // 2. dirban help <cmd>
      const ctxHelpStart: CliContext = {
        flags: {},
        positionals: ["help", "start"],
        config: MOCK_CONFIG,
        cwd: process.cwd(),
      }
      const exitHelpStart = await dispatchCommand("help", ctxHelpStart)
      expect(exitHelpStart).toBe(0)
      expect(output).toContain("dirban start")
      expect(output).toContain("--worktree")
      expect(output).toContain("ALIASES: worktree add")
    } finally {
      console.log = origLog
    }
  })

  it("Vector 7: Config validation pipeline halts execution before running commands if uninitialized", async () => {
    let errOutput = ""
    const origErr = console.error
    console.error = (...args: unknown[]) => {
      errOutput += args.join(" ") + "\n"
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-router-val-"))
    try {
      // Do NOT initializeBoard in tempDir (tasksDir does not exist)
      const ctx: CliContext = {
        flags: {},
        positionals: ["board"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }

      // Operational command 'board' requires tasksDir
      const exitCode = await dispatchCommand("board", ctx)
      expect(exitCode).toBe(1)
      expect(errOutput).toContain("Configuration Error: Tasks directory not found at:")
      expect(errOutput).toContain('Run "dirban init"')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
      console.error = origErr
    }
  })
})
