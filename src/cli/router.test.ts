import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { runCli } from "../../main.ts"
import type { DirbanConfig } from "../config/types.ts"
import { initializeBoard } from "../tasks/project/init.ts"
import { dispatchCommand, } from "./router.ts"
import type { CliContext } from "./types.ts"

const MOCK_CONFIG: DirbanConfig = {
  tasksDir: "docs/tasks",
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
      output += `${args.join(" ")}\n`
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
      errOutput += `${args.join(" ")}\n`
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
      output += `${args.join(" ")}\n`
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

  it("Vector 5: Dispatches ready command with task IDs and 'all'", async () => {
    let _output = ""
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      _output += `${args.join(" ")}\n`
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-router-test-"))
    try {
      initializeBoard(MOCK_CONFIG, tempDir)

      // Ready non-existent
      const ctxPositional: CliContext = {
        flags: {},
        positionals: ["ready", "non-existent-task"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const exitPositional = await dispatchCommand("ready", ctxPositional)
      expect(exitPositional).toBe(1)

      // Ready all in empty backlog
      const ctxAll: CliContext = {
        flags: {},
        positionals: ["ready", "all"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const exitAll = await dispatchCommand("ready", ctxAll)
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
      output += `${args.join(" ")}\n`
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
      expect(output).toContain("--unblocked")
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
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping
      const cleanOutput = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
      expect(cleanOutput).toContain("dirban start")
      expect(cleanOutput).toContain("--worktree")
      expect(cleanOutput).toContain("ALIASES: worktree add")
    } finally {
      console.log = origLog
    }
  })

  it("Vector 7: Config validation pipeline halts execution before running commands if uninitialized", async () => {
    let errOutput = ""
    const origErr = console.error
    console.error = (...args: unknown[]) => {
      errOutput += `${args.join(" ")}\n`
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

  it("Vector 8: Dispatches 'next' command and supports --raw output", async () => {
    let output = ""
    const origLog = console.log
    const origWrite = process.stdout.write
    console.log = (...args: unknown[]) => {
      output += `${args.join(" ")}\n`
    }
    process.stdout.write = (str: string | Uint8Array): boolean => {
      output += typeof str === "string" ? str : new TextDecoder().decode(str)
      return true
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-router-next-"))
    try {
      initializeBoard(MOCK_CONFIG, tempDir)
      fs.writeFileSync(
        path.join(tempDir, "docs/tasks/01-todo/26-001-sample-task.md"),
        `---\nokf_version: "1.0"\nid: "26-001"\ntitle: "Sample Next Task"\npriority: "p1"\nstatus: "todo"\n---\n# Sample\n`,
      )

      // 1. Standard format
      const ctxNext: CliContext = {
        flags: {},
        positionals: ["next"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const exitNext = await dispatchCommand("next", ctxNext)
      expect(exitNext).toBe(0)
      expect(output).toContain("Next Recommended Task")
      expect(output).toContain("26-001")
      expect(output).toContain("dirban start 26-001")

      // 2. --raw format
      output = ""
      const ctxRaw: CliContext = {
        flags: { raw: true },
        positionals: ["next"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const exitRaw = await dispatchCommand("next", ctxRaw)
      expect(exitRaw).toBe(0)
      expect(output).toBe("26-001")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
      console.log = origLog
      process.stdout.write = origWrite
    }
  })

  it("Vector 9: Pre-execution Command Parser rejects conflicting and invalid parameters", async () => {
    let errOutput = ""
    const origErr = console.error
    console.error = (...args: unknown[]) => {
      errOutput += `${args.join(" ")}\n`
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-router-validation-"))
    try {
      initializeBoard(MOCK_CONFIG, tempDir)

      // 1. dirban done with conflicting --merge and --no-merge
      const doneConflictCtx: CliContext = {
        flags: { merge: true, "no-merge": true },
        positionals: ["done", "26-001"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const doneExit = await dispatchCommand("done", doneConflictCtx)
      expect(doneExit).toBe(1)
      expect(errOutput).toContain("Error: Cannot specify both --merge and --no-merge.")

      // 2. dirban start with conflicting --worktree and --current
      errOutput = ""
      const startConflictCtx: CliContext = {
        flags: { worktree: true, current: true },
        positionals: ["start", "26-001"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const startExit = await dispatchCommand("start", startConflictCtx)
      expect(startExit).toBe(1)
      expect(errOutput).toContain(
        "Error: Cannot specify both --worktree and --current / --no-branch.",
      )

      // 3. dirban start missing task ID
      errOutput = ""
      const startMissingIdCtx: CliContext = {
        flags: {},
        positionals: ["start"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const startMissingExit = await dispatchCommand("start", startMissingIdCtx)
      expect(startMissingExit).toBe(1)
      expect(errOutput).toContain("Error: Missing task ID. Usage: dirban start <id>")

      // 4. dirban new missing task title
      errOutput = ""
      const newMissingTitleCtx: CliContext = {
        flags: {},
        positionals: ["new"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const newMissingExit = await dispatchCommand("new", newMissingTitleCtx)
      expect(newMissingExit).toBe(1)
      expect(errOutput).toContain("Error: Missing task title. Usage: dirban new")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
      console.error = origErr
    }
  })

  it("Vector 10: Standardized relative clickable file paths across CLI commands", async () => {
    let output = ""
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      output += `${args.join(" ")}\n`
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-paths-test-"))
    try {
      initializeBoard(MOCK_CONFIG, tempDir)

      // 1. dirban new outputs relative path
      output = ""
      const newCtx: CliContext = {
        flags: {},
        positionals: ["new", "Standardize Path Test"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const newExit = await dispatchCommand("new", newCtx)
      expect(newExit).toBe(0)
      expect(output).toContain(
        "✔ Created task 26-001 in 00-backlog: docs/tasks/00-backlog/26-001-standardize-path-test.md",
      )

      // 2. dirban move outputs relative path
      output = ""
      const moveCtx: CliContext = {
        flags: {},
        positionals: ["move", "26-001", "02-doing"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const moveExit = await dispatchCommand("move", moveCtx)
      expect(moveExit).toBe(0)
      expect(output).toContain(
        "✔ Moved task 26-001 to '02-doing': docs/tasks/02-doing/26-001-standardize-path-test.md",
      )

      // 3. dirban block outputs relative path
      output = ""
      const blockCtx: CliContext = {
        flags: {},
        positionals: ["block", "26-001", "Waiting on review"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const blockExit = await dispatchCommand("block", blockCtx)
      expect(blockExit).toBe(0)
      expect(output).toContain(
        "⛔ Blocked task 26-001: docs/tasks/00-backlog/26-001-standardize-path-test.md (added [Waiting on review])",
      )

      // 4. dirban unblock outputs relative path
      output = ""
      const unblockCtx: CliContext = {
        flags: {},
        positionals: ["unblock", "26-001", "Waiting on review"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const unblockExit = await dispatchCommand("unblock", unblockCtx)
      expect(unblockExit).toBe(0)
      expect(output).toContain(
        "✔ Unblocked task 26-001: docs/tasks/00-backlog/26-001-standardize-path-test.md (removed [Waiting on review])",
      )

      // 5. dirban ready outputs relative path
      output = ""
      const readyCtx: CliContext = {
        flags: {},
        positionals: ["ready", "26-001"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const readyExit = await dispatchCommand("ready", readyCtx)
      expect(readyExit).toBe(0)
      expect(output).toContain(
        "✔ Readied task 26-001: docs/tasks/01-todo/26-001-standardize-path-test.md",
      )

      // 6. dirban start outputs relative path
      output = ""
      const startCtx: CliContext = {
        flags: { "no-git": true },
        positionals: ["start", "26-001"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const startExit = await dispatchCommand("start", startCtx)
      expect(startExit).toBe(0)
      expect(output).toContain(
        "✔ Started task 26-001: docs/tasks/02-doing/26-001-standardize-path-test.md",
      )

      // 7. dirban done outputs relative path
      output = ""
      const doneCtx: CliContext = {
        flags: { "no-git": true },
        positionals: ["done", "26-001"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const doneExit = await dispatchCommand("done", doneCtx)
      expect(doneExit).toBe(0)
      expect(output).toContain(
        "✔ Completed task 26-001: docs/tasks/03-done/26-001-standardize-path-test.md",
      )

      // 8. dirban archive outputs relative path
      output = ""
      const archiveCtx: CliContext = {
        flags: {},
        positionals: ["archive", "26-001"],
        config: MOCK_CONFIG,
        cwd: tempDir,
      }
      const archiveExit = await dispatchCommand("archive", archiveCtx)
      expect(archiveExit).toBe(0)
      expect(output).toContain("✔ Archived task 26-001: archive/26-001-standardize-path-test.md")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
      console.log = origLog
    }
  })
})
