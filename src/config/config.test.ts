import { describe, expect, it } from "bun:test"
import * as path from "node:path"
import * as fs from "node:fs"
import * as os from "node:os"
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
        columns: ["todo", "doing", "done"],
        archiveDir: "custom/archive",
        defaultPriority: "p0",
        focusColumn: "doing",
      }
      fs.writeFileSync(
        path.join(tempDir, ".dirban.json"),
        JSON.stringify(customConfig),
        "utf-8",
      )

      const result = loadConfig(tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.tasksDir).toBe("custom/tasks")
        expect(result.value.columns).toEqual(["todo", "doing", "done"])
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
      fs.writeFileSync(
        path.join(tempDir, ".dirban.json"),
        "{ invalid json",
        "utf-8",
      )

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
        "dirban.columns": ["backlog", "in-dev", "verified"],
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
        expect(result.value.columns).toEqual(["backlog", "in-dev", "verified"])
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
      fs.writeFileSync(
        path.join(tempDir, ".dirban.json"),
        JSON.stringify(customConfig),
        "utf-8",
      )

      const result = loadConfig(tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.priorities).toEqual([
          "urgent",
          "high",
          "normal",
          "low",
        ])
        expect(result.value.defaultPriority).toBe("normal")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 7 (Focus & Next Column Resolution): Handles custom workflows and fallbacks", () => {
    // 1. Explicit focusColumn
    const explicitConfig = {
      ...DEFAULT_CONFIG,
      columns: ["todo", "develop", "test", "production"],
      focusColumn: "develop",
    }
    expect(resolveFocusColumn(explicitConfig)).toBe("develop")
    expect(resolveNextColumn(explicitConfig, "develop")).toBe("test")
    expect(resolveNextColumn(explicitConfig, "test")).toBe("production")
    expect(resolveNextColumn(explicitConfig, "production")).toBe("production")

    // 2. Positional default: columns[1] when focusColumn is not specified
    const positionalConfig = {
      ...DEFAULT_CONFIG,
      columns: ["open", "working", "resolved"],
      focusColumn: undefined,
    }
    expect(resolveFocusColumn(positionalConfig)).toBe("working")
    expect(resolveNextColumn(positionalConfig, "working")).toBe("resolved")

    // 3. Single column edge case defaults to columns[0]
    const singleColConfig = {
      ...DEFAULT_CONFIG,
      columns: ["only-column"],
      focusColumn: undefined,
    }
    expect(resolveFocusColumn(singleColConfig)).toBe("only-column")
    expect(resolveNextColumn(singleColConfig, "only-column")).toBe("only-column")

    // 4. Zero-column workflow: columns: [] yields null focusColumn and advances to "archive"
    const zeroColConfig = {
      ...DEFAULT_CONFIG,
      columns: [],
      focusColumn: undefined,
    }
    expect(resolveFocusColumn(zeroColConfig)).toBe(null)
    expect(resolveNextColumn(zeroColConfig, "backlog")).toBe("archive")

    // 5. Default configuration preservation
    expect(resolveFocusColumn(DEFAULT_CONFIG)).toBe("02-doing")
    expect(resolveNextColumn(DEFAULT_CONFIG, "02-doing")).toBe("03-done")
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

    // 4. Duplicate columns fail
    const duplicateCols = { ...DEFAULT_CONFIG, columns: ["todo", "doing", "TODO"] }
    const duplicateRes = validateConfig(duplicateCols)
    expect(duplicateRes.isErr()).toBe(true)
    if (duplicateRes.isErr()) {
      expect(duplicateRes.error.kind).toBe("VALIDATION_ERROR")
      expect(duplicateRes.error.message).toContain("duplicate column name")
    }

    // 5. Empty column name fails
    const emptyCol = { ...DEFAULT_CONFIG, columns: ["todo", "   "] }
    const emptyColRes = validateConfig(emptyCol)
    expect(emptyColRes.isErr()).toBe(true)

    // 6. requireTasksDir verification against disk
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
