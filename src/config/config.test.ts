import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import {
  DEFAULT_CONFIG,
  loadConfig,
  resolveFocusColumn,
  resolveNextColumn,
  validateConfig,
} from "./config.ts"

describe("Config Module Tests", () => {
  it("Vector 1 (Baseline): Missing config file returns default config", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-config-"))
    try {
      const result = loadConfig(tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual(DEFAULT_CONFIG)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 2 (Custom Valid): Fully specified .dirban.json overrides defaults", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-config-"))
    try {
      const customConfig = {
        tasksDir: "custom/tasks",
        archiveDir: "custom/archive",
        defaultPriority: "p0",
        focusColumn: "doing",
      }
      fs.writeFileSync(path.join(tempDir, ".dirban.json"), JSON.stringify(customConfig), "utf-8")

      const result = loadConfig(tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.tasksDir).toBe("custom/tasks")
        expect(result.value.archiveDir).toBe("custom/archive")
        expect(result.value.defaultPriority).toBe("p0")
        expect(result.value.focusColumn).toBe("doing")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 3 (Malformed JSON): Returns JSON_PARSE_ERROR", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-config-"))
    try {
      fs.writeFileSync(path.join(tempDir, ".dirban.json"), "{ invalid json", "utf-8")

      const result = loadConfig(tempDir)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.kind).toBe("JSON_PARSE_ERROR")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 4 (VS Code Settings): Reads dirban.* settings from .vscode/settings.json when .dirban.json is absent", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-config-"))
    try {
      const vscodeDir = path.join(tempDir, ".vscode")
      fs.mkdirSync(vscodeDir, { recursive: true })

      const vscodeSettings = {
        "editor.tabSize": 2,
        "dirban.tasksDir": "ide/tasks",
        "dirban.defaultPriority": "p1",
      }

      fs.writeFileSync(
        path.join(vscodeDir, "settings.json"),
        JSON.stringify(vscodeSettings),
        "utf-8",
      )

      const result = loadConfig(tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.tasksDir).toBe("ide/tasks")
        expect(result.value.defaultPriority).toBe("p1")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 5 (JSONC Support): Tolerates comments and trailing commas in config files", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-config-"))
    try {
      const jsoncContent = `
        {
          // Project tasks folder
          "tasksDir": "docs/tasks",
          /* Columns */
          "columns": [
            "backlog",
            "01-todo",
            "02-doing",
            "03-done",
          ],
          "defaultPriority": "p2",
        }
      `
      fs.writeFileSync(path.join(tempDir, ".dirban.json"), jsoncContent, "utf-8")

      const result = loadConfig(tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.tasksDir).toBe("docs/tasks")
        expect(result.value.defaultPriority).toBe("p2")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 6 (Custom Priorities & Default): Accepts user-defined priority levels and user default", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-config-"))
    try {
      const customConfig = {
        priorities: ["urgent", "high", "normal", "low"],
        defaultPriority: "normal",
      }
      fs.writeFileSync(path.join(tempDir, ".dirban.json"), JSON.stringify(customConfig), "utf-8")

      const result = loadConfig(tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.priorities).toEqual(["urgent", "high", "normal", "low"])
        expect(result.value.defaultPriority).toBe("normal")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 7 (Focus & Next Column Resolution): Resolves standard lifecycle columns", () => {
    // 1. Default configuration preservation
    expect(resolveFocusColumn(DEFAULT_CONFIG)).toBe("02-doing")
    expect(resolveNextColumn(DEFAULT_CONFIG, "01-todo")).toBe("02-doing")
    expect(resolveNextColumn(DEFAULT_CONFIG, "02-doing")).toBe("03-done")
    expect(resolveNextColumn(DEFAULT_CONFIG, "03-done")).toBe("03-done")
  })

  it("Vector 8 (Config Validation): Validates priorities, unique columns, and tasksDir presence", () => {
    // 1. Valid default config
    expect(validateConfig(DEFAULT_CONFIG).isOk()).toBe(true)

    // 2. Empty priorities array fails
    const emptyPriorities = { ...DEFAULT_CONFIG, priorities: [] }
    const emptyPrioRes = validateConfig(emptyPriorities)
    expect(emptyPrioRes.isErr()).toBe(true)
    if (emptyPrioRes.isErr()) {
      expect(emptyPrioRes.error.kind).toBe("VALIDATION_ERROR")
      expect(emptyPrioRes.error.message).toContain("cannot be empty")
    }

    // 3. defaultPriority not in priorities fails
    const mismatchPriority = { ...DEFAULT_CONFIG, defaultPriority: "non-existent" }
    const mismatchRes = validateConfig(mismatchPriority)
    expect(mismatchRes.isErr()).toBe(true)
    if (mismatchRes.isErr()) {
      expect(mismatchRes.error.kind).toBe("VALIDATION_ERROR")
      expect(mismatchRes.error.message).toContain('defaultPriority "non-existent" must be one of')
    }

    // 4. requireTasksDir verification against disk
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-val-"))
    try {
      const nonExistentTasksRes = validateConfig(DEFAULT_CONFIG, {
        requireTasksDir: true,
        workspaceRoot: tempDir,
      })
      expect(nonExistentTasksRes.isErr()).toBe(true)
      if (nonExistentTasksRes.isErr()) {
        expect(nonExistentTasksRes.error.message).toContain("Tasks directory not found at:")
      }

      // Create tasksDir -> passes
      fs.mkdirSync(path.join(tempDir, DEFAULT_CONFIG.tasksDir), { recursive: true })
      const existentTasksRes = validateConfig(DEFAULT_CONFIG, {
        requireTasksDir: true,
        workspaceRoot: tempDir,
      })
      expect(existentTasksRes.isOk()).toBe(true)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
