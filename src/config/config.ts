import { err, ok, type Result } from "neverthrow"
import * as path from "node:path"
import * as fs from "node:fs"
import type { ConfigError, DirbanConfig } from "./types.ts"

export const CONFIG_FILE_NAME = ".dirban.json" as const
export const VSCODE_SETTINGS_DIR = ".vscode" as const
export const VSCODE_SETTINGS_FILE = "settings.json" as const
export const DEFAULT_TASKS_DIR = "docs/tasks" as const
export const DEFAULT_BACKLOG_DIR = "docs/tasks/backlog" as const
export const DEFAULT_ARCHIVE_DIR = "docs/tasks/archive" as const
export const DEFAULT_PRIORITY = "p2" as const

export const DEFAULT_BRANCH_STRATEGY = "checkout" as const
export const DEFAULT_WORKTREES_DIR = "../.{repo}.worktrees" as const
export const DEFAULT_BRANCH_PREFIX = "task/" as const

export const DEFAULT_COLUMNS: readonly string[] = Object.freeze([
  "01-todo",
  "02-doing",
  "03-done",
])

export const DEFAULT_PRIORITIES: readonly string[] = Object.freeze([
  "p0",
  "p1",
  "p2",
  "p3",
])

export const DEFAULT_CONFIG: DirbanConfig = Object.freeze({
  tasksDir: DEFAULT_TASKS_DIR,
  columns: DEFAULT_COLUMNS,
  archiveDir: DEFAULT_ARCHIVE_DIR,
  priorities: DEFAULT_PRIORITIES,
  defaultPriority: DEFAULT_PRIORITY,
  branchStrategy: DEFAULT_BRANCH_STRATEGY,
  worktreesDir: DEFAULT_WORKTREES_DIR,
  branchPrefix: DEFAULT_BRANCH_PREFIX,
  focusColumn: undefined,
})

export const resolveFocusColumn = (config: DirbanConfig): string | null => {
  const columns = config.columns
  if (columns.length === 0) {
    return null
  }

  // 1. Explicit user configuration
  if (config.focusColumn != null && config.focusColumn.trim() !== "") {
    const matched = columns.find(
      (c) => c.toLowerCase() === config.focusColumn!.toLowerCase().trim(),
    )
    if (matched != null) {
      return matched
    }
    return config.focusColumn.trim()
  }

  // 2. Positional default: columns[1] (e.g. 02-doing) if >= 2 columns, else columns[0]
  return columns.length > 1 ? columns[1]! : columns[0]!
}

export const resolveNextColumn = (
  config: DirbanConfig,
  currentColumn: string,
): string => {
  const columns = config.columns
  if (columns.length === 0) {
    return "archive"
  }

  const currentIndex = columns.findIndex(
    (c) => c.toLowerCase() === currentColumn.toLowerCase(),
  )

  if (currentIndex === -1) {
    // If not found in columns, return last column (e.g. done)
    return columns[columns.length - 1]!
  }

  // Return next column (or stay at last column if already at end)
  const nextIndex = Math.min(currentIndex + 1, columns.length - 1)
  return columns[nextIndex]!
}

/**
 * Strips single-line and multi-line comments and trailing commas to tolerate JSONC in .vscode/settings.json
 */
const stripJsonc = (text: string): string => {
  return text
    .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, "$1")
    .replace(/,\s*([}\]])/g, "$1")
}

const parseRawConfigObject = (
  raw: Record<string, unknown>,
  isVsCodeSettings: boolean = false,
): Partial<DirbanConfig> => {
  const getVal = (key: string): unknown => {
    if (isVsCodeSettings) {
      return raw[`dirban.${key}`] ?? raw[key]
    }
    return raw[key]
  }

  const tasksDirRaw = getVal("tasksDir")
  const tasksDir = typeof tasksDirRaw === "string" && tasksDirRaw.trim() !== ""
    ? tasksDirRaw.trim()
    : undefined

  const archiveDirRaw = getVal("archiveDir")
  const archiveDir =
    typeof archiveDirRaw === "string" && archiveDirRaw.trim() !== ""
      ? archiveDirRaw.trim()
      : undefined

  const columnsRaw = getVal("columns")
  const columns = Array.isArray(columnsRaw) && columnsRaw.length > 0
    ? columnsRaw.filter((c): c is string =>
      typeof c === "string" && c.trim() !== ""
    )
    : undefined

  const prioritiesRaw = getVal("priorities")
  const priorities = Array.isArray(prioritiesRaw) && prioritiesRaw.length > 0
    ? prioritiesRaw.filter((p): p is string =>
      typeof p === "string" && p.trim() !== ""
    )
    : undefined

  const allowedPriorities = priorities ?? DEFAULT_PRIORITIES
  const priorityRaw = getVal("defaultPriority")
  const defaultPriority =
    typeof priorityRaw === "string" &&
      allowedPriorities.includes(priorityRaw.trim())
      ? priorityRaw.trim()
      : (priorities != null && priorities.length > 0
        ? priorities[Math.min(2, priorities.length - 1)]
        : undefined)

  const branchStrategyRaw = getVal("branchStrategy")
  const branchStrategy =
    branchStrategyRaw === "checkout" || branchStrategyRaw === "worktree"
      ? branchStrategyRaw
      : undefined

  const worktreesDirRaw = getVal("worktreesDir")
  const worktreesDir =
    typeof worktreesDirRaw === "string" && worktreesDirRaw.trim() !== ""
      ? worktreesDirRaw.trim()
      : undefined

  const branchPrefixRaw = getVal("branchPrefix")
  const branchPrefix =
    typeof branchPrefixRaw === "string" && branchPrefixRaw.trim() !== ""
      ? branchPrefixRaw.trim()
      : undefined

  const focusColumnRaw = getVal("focusColumn")
  const focusColumn =
    typeof focusColumnRaw === "string" && focusColumnRaw.trim() !== ""
      ? focusColumnRaw.trim()
      : undefined

  return {
    tasksDir,
    archiveDir,
    columns,
    priorities,
    defaultPriority,
    branchStrategy,
    worktreesDir,
    branchPrefix,
    focusColumn,
  }
}

export const loadConfig = (
  workspaceRoot: string = process.cwd(),
): Result<DirbanConfig, ConfigError> => {
  const dirbanConfigPath = path.join(workspaceRoot, CONFIG_FILE_NAME)
  const vscodeSettingsPath = path.join(
    workspaceRoot,
    VSCODE_SETTINGS_DIR,
    VSCODE_SETTINGS_FILE,
  )

  let rawConfig: Record<string, unknown> | null = null
  let isVsCode = false

  // 1. Check .dirban.json first
  if (fs.existsSync(dirbanConfigPath)) {
    try {
      const content = fs.readFileSync(dirbanConfigPath, "utf-8")
      rawConfig = JSON.parse(stripJsonc(content)) as Record<string, unknown>
    } catch (parseErr) {
      return err({
        kind: "JSON_PARSE_ERROR",
        message: parseErr instanceof Error
          ? `Error in ${CONFIG_FILE_NAME}: ${parseErr.message}`
          : "Malformed JSON",
      })
    }
  } else if (fs.existsSync(vscodeSettingsPath)) {
    // 2. Check .vscode/settings.json next
    try {
      const content = fs.readFileSync(vscodeSettingsPath, "utf-8")
      rawConfig = JSON.parse(stripJsonc(content)) as Record<string, unknown>
      isVsCode = true
    } catch (parseErr) {
      return err({
        kind: "JSON_PARSE_ERROR",
        message: parseErr instanceof Error
          ? `Error in ${VSCODE_SETTINGS_DIR}/${VSCODE_SETTINGS_FILE}: ${parseErr.message}`
          : "Malformed JSON",
      })
    }
  }

  if (rawConfig == null) {
    return ok(DEFAULT_CONFIG)
  }

  const parsed = parseRawConfigObject(rawConfig, isVsCode)

  return ok(Object.freeze({
    tasksDir: parsed.tasksDir ?? DEFAULT_CONFIG.tasksDir,
    columns: parsed.columns ?? DEFAULT_CONFIG.columns,
    archiveDir: parsed.archiveDir ?? DEFAULT_CONFIG.archiveDir,
    priorities: parsed.priorities ?? DEFAULT_CONFIG.priorities,
    defaultPriority: parsed.defaultPriority ?? DEFAULT_CONFIG.defaultPriority,
    branchStrategy: parsed.branchStrategy ?? DEFAULT_CONFIG.branchStrategy,
    worktreesDir: parsed.worktreesDir ?? DEFAULT_CONFIG.worktreesDir,
    branchPrefix: parsed.branchPrefix ?? DEFAULT_CONFIG.branchPrefix,
    focusColumn: parsed.focusColumn ?? DEFAULT_CONFIG.focusColumn,
  }))
}
