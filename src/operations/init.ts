import * as fs from "node:fs"
import * as path from "node:path"
import { err, ok, type Result } from "neverthrow"
import {
  CONFIG_FILE_NAME,
  DEFAULT_CONFIG,
  VSCODE_SETTINGS_DIR,
  VSCODE_SETTINGS_FILE,
} from "../config/config.ts"
import type { DirbanConfig } from "../config/types.ts"
import type { OperationError } from "./types.ts"

export interface InitOptions {
  /**
   * "dirban" creates .dirban.json
   * "vscode" writes into .vscode/settings.json
   * "auto" (default): writes to .vscode/settings.json if .vscode directory exists, else .dirban.json
   */
  readonly configTarget?: "dirban" | "vscode" | "auto"
}

export interface InitResult {
  readonly tasksDir: string
  readonly archiveDir: string
  readonly createdDirectories: readonly string[]
  readonly alreadyExistedDirectories: readonly string[]
  readonly configFileCreated?: string
  readonly configFileUpdated?: string
}

/**
 * Initializes the Dirban board directory structure and configuration according to options.
 * Creates tasksRoot and columns, and writes starter config to .dirban.json or .vscode/settings.json.
 */
export const initializeBoard = (
  config: DirbanConfig = DEFAULT_CONFIG,
  workspaceRoot: string = process.cwd(),
  options: InitOptions = {},
): Result<InitResult, OperationError> => {
  const rootDir = path.isAbsolute(config.tasksDir)
    ? config.tasksDir
    : path.join(workspaceRoot, config.tasksDir)

  const archiveDir = path.isAbsolute(config.archiveDir)
    ? config.archiveDir
    : path.join(workspaceRoot, config.archiveDir)

  const directoriesToEnsure = [
    rootDir,
    ...config.columns.map((c) => path.join(rootDir, c)),
    archiveDir,
  ]

  const created: string[] = []
  const alreadyExisted: string[] = []

  for (const dirPath of directoriesToEnsure) {
    try {
      if (fs.existsSync(dirPath)) {
        alreadyExisted.push(dirPath)
      } else {
        fs.mkdirSync(dirPath, { recursive: true })
        created.push(dirPath)
      }
    } catch (e) {
      return err({
        kind: "FS_ERROR",
        message: e instanceof Error
          ? `Failed to create directory ${dirPath}: ${e.message}`
          : `Failed to create directory ${dirPath}`,
      })
    }
  }

  // Determine config file target
  const dirbanConfigPath = path.join(workspaceRoot, CONFIG_FILE_NAME)
  const vscodeDir = path.join(workspaceRoot, VSCODE_SETTINGS_DIR)
  const vscodeSettingsPath = path.join(vscodeDir, VSCODE_SETTINGS_FILE)

  let configFileCreated: string | undefined
  let configFileUpdated: string | undefined

  const target = options.configTarget ?? "auto"
  const useVsCode = target === "vscode" ||
    (target === "auto" && fs.existsSync(vscodeDir) && !fs.existsSync(dirbanConfigPath))

  try {
    if (useVsCode) {
      fs.mkdirSync(vscodeDir, { recursive: true })
      let currentSettings: Record<string, unknown> = {}

      if (fs.existsSync(vscodeSettingsPath)) {
        try {
          const content = fs.readFileSync(vscodeSettingsPath, "utf-8")
          currentSettings = JSON.parse(content) as Record<string, unknown>
        } catch {
          currentSettings = {}
        }
      }

      // Only set if not already defined
      let modified = false
      if (currentSettings["dirban.tasksDir"] == null) {
        currentSettings["dirban.tasksDir"] = config.tasksDir
        modified = true
      }
      if (currentSettings["dirban.columns"] == null) {
        currentSettings["dirban.columns"] = [...config.columns]
        modified = true
      }
      if (currentSettings["dirban.priorities"] == null) {
        currentSettings["dirban.priorities"] = [...config.priorities]
        modified = true
      }
      if (currentSettings["dirban.defaultPriority"] == null) {
        currentSettings["dirban.defaultPriority"] = config.defaultPriority
        modified = true
      }

      if (modified) {
        fs.writeFileSync(
          vscodeSettingsPath,
          JSON.stringify(currentSettings, null, 2) + "\n",
          "utf-8",
        )
        if (fs.existsSync(vscodeSettingsPath)) {
          configFileUpdated = path.relative(workspaceRoot, vscodeSettingsPath)
        } else {
          configFileCreated = path.relative(workspaceRoot, vscodeSettingsPath)
        }
      }
    } else {
      if (!fs.existsSync(dirbanConfigPath)) {
        const configContent = {
          tasksDir: config.tasksDir,
          columns: [...config.columns],
          priorities: [...config.priorities],
          defaultPriority: config.defaultPriority,
          archiveDir: config.archiveDir,
        }
        fs.writeFileSync(
          dirbanConfigPath,
          JSON.stringify(configContent, null, 2) + "\n",
          "utf-8",
        )
        configFileCreated = CONFIG_FILE_NAME
      }
    }
  } catch (e) {
    return err({
      kind: "FS_ERROR",
      message: e instanceof Error
        ? `Failed to write configuration: ${e.message}`
        : "Failed to write configuration",
    })
  }

  return ok(Object.freeze({
    tasksDir: rootDir,
    archiveDir,
    createdDirectories: Object.freeze(created),
    alreadyExistedDirectories: Object.freeze(alreadyExisted),
    configFileCreated,
    configFileUpdated,
  }))
}
