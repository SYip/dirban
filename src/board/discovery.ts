import { err, ok, type Result } from "neverthrow"
import * as path from "node:path"
import * as fs from "node:fs"
import type { DirbanConfig } from "../config/types.ts"
import { parseTaskDocument } from "../okf/parser.ts"
import { serializeTaskDocument } from "../okf/serializer.ts"
import { filterTasks, sortTasks } from "./sorter.ts"
import type {
  Board,
  BoardError,
  BoardFilterOptions,
  BoardTask,
  Column,
} from "./types.ts"

export const discoverBoard = (
  config: DirbanConfig,
  workspaceRoot: string = process.cwd(),
  options?: BoardFilterOptions,
): Result<Board, BoardError> => {
  const rootDir = path.isAbsolute(config.tasksDir)
    ? config.tasksDir
    : path.join(workspaceRoot, config.tasksDir)

  try {
    const dirInfo = fs.statSync(rootDir)
    if (!dirInfo.isDirectory()) {
      return err({
        kind: "DIRECTORY_NOT_FOUND",
        message: `Tasks path is not a directory: ${rootDir}`,
        path: rootDir,
      })
    }
  } catch (statErr: unknown) {
    if (
      typeof statErr === "object" &&
      statErr != null &&
      "code" in statErr &&
      (statErr as { code?: string }).code === "ENOENT"
    ) {
      return err({
        kind: "DIRECTORY_NOT_FOUND",
        message: `Tasks directory not found: ${rootDir}. Run "dirban init" to set up your board.`,
        path: rootDir,
      })
    }
    return err({
      kind: "FILE_READ_ERROR",
      message: statErr instanceof Error
        ? statErr.message
        : "Cannot access tasks directory",
      path: rootDir,
    })
  }

  const discoveredDirNames: string[] = []
  try {
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        discoveredDirNames.push(entry.name)
      }
    }
  } catch (readErr) {
    return err({
      kind: "FILE_READ_ERROR",
      message: readErr instanceof Error
        ? readErr.message
        : "Failed to scan tasks directory",
      path: rootDir,
    })
  }

  const orderedColNames: string[] = []
  for (const configuredCol of config.columns) {
    if (discoveredDirNames.includes(configuredCol)) {
      orderedColNames.push(configuredCol)
    }
  }

  const unlistedCols = discoveredDirNames
    .filter((name) => !config.columns.includes(name))
    .sort((a, b) => a.localeCompare(b))

  orderedColNames.push(...unlistedCols)

  const columns: Column[] = []
  let totalTasks = 0

  for (let i = 0; i < orderedColNames.length; i++) {
    const colName = orderedColNames[i]
    if (colName == null) continue

    const colPath = path.join(rootDir, colName)
    const taskList: BoardTask[] = []

    try {
      for (const entry of fs.readdirSync(colPath, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          const filePath = path.join(colPath, entry.name)
          const content = fs.readFileSync(filePath, "utf-8")
          const parseResult = parseTaskDocument(content)

          if (parseResult.isOk()) {
            let doc = parseResult.value

            // Physical directory is strict source of truth: self-heal status if mismatched
            if (doc.frontmatter.status !== colName) {
              const healedFm = Object.freeze({
                ...doc.frontmatter,
                status: colName,
              })
              doc = Object.freeze({
                ...doc,
                frontmatter: healedFm,
              })
              try {
                fs.writeFileSync(filePath, serializeTaskDocument(doc), "utf-8")
              } catch {
                // Silently skip write failure if read-only
              }
            }

            taskList.push(Object.freeze({
              filePath,
              filename: entry.name,
              column: colName,
              document: doc,
            }))
          }
        }
      }
    } catch {
      // Continue with empty column if unreadable
    }

    const filtered = filterTasks(taskList, options)
    const sorted = sortTasks(
      filtered,
      options?.sortMode ?? "priority",
      config.priorities,
    )

    totalTasks += sorted.length
    columns.push(Object.freeze({
      name: colName,
      path: colPath,
      orderIndex: i,
      tasks: Object.freeze(sorted),
    }))
  }

  return ok(Object.freeze({
    rootDir,
    columns: Object.freeze(columns),
    totalTasks,
  }))
}

export const findTaskByIdOrName = (
  board: Board,
  idOrPath: string,
): BoardTask | null => {
  const normalizedQuery = idOrPath.trim().toLowerCase()

  for (const col of board.columns) {
    for (const task of col.tasks) {
      if (
        task.document.frontmatter.id.toLowerCase() === normalizedQuery ||
        task.filename.toLowerCase() === normalizedQuery ||
        task.filename.toLowerCase().replace(/\.md$/, "") === normalizedQuery ||
        task.document.frontmatter.id.toLowerCase().endsWith(normalizedQuery) ||
        task.filePath.toLowerCase().endsWith(normalizedQuery)
      ) {
        return task
      }
    }
  }

  return null
}
