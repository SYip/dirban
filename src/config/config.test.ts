import { describe, expect, it } from "bun:test"
import * as path from "node:path"
import * as fs from "node:fs"
import * as os from "node:os"
import { DEFAULT_CONFIG, loadConfig } from "./config.ts"

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
})
