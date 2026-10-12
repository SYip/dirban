import { err, ok, type Result } from "neverthrow"
import * as path from "node:path"
import * as fs from "node:fs"
import type { ConfigError, DirbanConfig } from "./types.ts"

export const CONFIG_FILE_NAME = ".dirban.json" as const
export const DEFAULT_TASKS_DIR = "docs/tasks" as const
export const DEFAULT_ARCHIVE_DIR = "docs/tasks/archive" as const
export const DEFAULT_PRIORITY = "p2" as const

export const DEFAULT_COLUMNS: readonly string[] = Object.freeze([
  "00-backlog",
  "01-ready",
  "02-in-progress",
  "03-done",
])

export const DEFAULT_CONFIG: DirbanConfig = Object.freeze({
  tasksDir: DEFAULT_TASKS_DIR,
  columns: DEFAULT_COLUMNS,
  archiveDir: DEFAULT_ARCHIVE_DIR,
  defaultPriority: DEFAULT_PRIORITY,
})

export const loadConfig = (
  workspaceRoot: string = process.cwd(),
): Result<DirbanConfig, ConfigError> => {
  const configPath = path.join(workspaceRoot, CONFIG_FILE_NAME)
  try {
    const rawContent = fs.readFileSync(configPath, "utf-8")
    try {
      const parsed = JSON.parse(rawContent) as Record<string, unknown>
      const tasksDir =
        typeof parsed.tasksDir === "string" && parsed.tasksDir.trim() !== ""
          ? parsed.tasksDir.trim()
          : DEFAULT_CONFIG.tasksDir

      const archiveDir =
        typeof parsed.archiveDir === "string" && parsed.archiveDir.trim() !== ""
          ? parsed.archiveDir.trim()
          : DEFAULT_CONFIG.archiveDir

      const columns = Array.isArray(parsed.columns) && parsed.columns.length > 0
        ? parsed.columns.filter((c): c is string =>
          typeof c === "string" && c.trim() !== ""
        )
        : DEFAULT_CONFIG.columns

      const priority = parsed.defaultPriority === "p0" ||
          parsed.defaultPriority === "p1" ||
          parsed.defaultPriority === "p2" ||
          parsed.defaultPriority === "p3"
        ? parsed.defaultPriority
        : DEFAULT_CONFIG.defaultPriority

      return ok({
        tasksDir,
        columns,
        archiveDir,
        defaultPriority: priority,
      })
    } catch (parseErr) {
      return err({
        kind: "JSON_PARSE_ERROR",
        message: parseErr instanceof Error
          ? parseErr.message
          : "Malformed JSON",
      })
    }
  } catch (readErr: unknown) {
    if (
      typeof readErr === "object" &&
      readErr != null &&
      "code" in readErr &&
      (readErr as { code?: string }).code === "ENOENT"
    ) {
      return ok(DEFAULT_CONFIG)
    }
    return err({
      kind: "FILE_READ_ERROR",
      message: readErr instanceof Error
        ? readErr.message
        : "Failed to read config file",
    })
  }
}
