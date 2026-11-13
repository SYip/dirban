import { err, ok, type Result } from "neverthrow"
import * as path from "node:path"
import * as fs from "node:fs"
import type { DirbanConfig } from "../config/types.ts"
import { parseTaskDocument } from "../okf/parser.ts"
import { getVcsProvider } from "../vcs/index.ts"
import { buildWorktreeTaskMap, overlayWorktreeTask } from "./overlay.ts"
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

  // 1. Backlog always on the far left (if present in discovered directories)
  const backlogDirs = discoveredDirNames.filter(
    (name) => name.toLowerCase() === "backlog" || name.toLowerCase().endsWith("-backlog"),
  )
  orderedColNames.push(...backlogDirs)

  // 2. Configured workflow columns in the middle
  for (const configuredCol of config.columns) {
    if (discoveredDirNames.includes(configuredCol) && !orderedColNames.includes(configuredCol)) {
      orderedColNames.push(configuredCol)
    }
  }

  // 3. Unlisted / custom intermediate columns
  const unlistedCols = discoveredDirNames
    .filter(
      (name) =>
        !config.columns.includes(name) &&
        !orderedColNames.includes(name) &&
        name.toLowerCase() !== "archive" &&
        !name.toLowerCase().endsWith("-archive"),
    )
    .sort((a, b) => a.localeCompare(b))

  orderedColNames.push(...unlistedCols)

  // 4. Archive always on the far right (if present in discovered directories)
  const archiveDirs = discoveredDirNames.filter(
    (name) =>
      (name.toLowerCase() === "archive" || name.toLowerCase().endsWith("-archive")) &&
      !orderedColNames.includes(name),
  )
  orderedColNames.push(...archiveDirs)

  const vcs = getVcsProvider(workspaceRoot)
  const worktreeMap = buildWorktreeTaskMap(vcs, workspaceRoot)

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
          const parseResult = parseTaskDocument(content, entry.name)

          if (parseResult.isOk()) {
            let doc = parseResult.value

            // Physical directory is strict source of truth: directory dictates column status
            if (doc.frontmatter.status !== colName) {
              const healedFm = Object.freeze({
                ...doc.frontmatter,
                status: colName,
              })
              doc = Object.freeze({
                ...doc,
                frontmatter: healedFm,
              })
            }

            const baseTask: BoardTask = {
              filePath,
              filename: entry.name,
              column: colName,
              document: doc,
            }

            taskList.push(overlayWorktreeTask(baseTask, worktreeMap, config.tasksDir))
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

export type LookupMatchResult =
  | { readonly kind: "FOUND"; readonly task: BoardTask }
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "AMBIGUOUS"; readonly matches: readonly BoardTask[] }

const TASK_SUFFIX_REGEX = /(?:^|[\.-])(\d{1,4})(?:\.md)?$/

/**
 * Checks if a task matches an exact identifier (ID, frontmatter ID, filename, or filepath).
 */
export const isTaskExactMatch = (task: BoardTask, query: string): boolean => {
  const normalizedQuery = query.toLowerCase()
  const taskId = (task.document.id ?? task.document.frontmatter.id ?? "").toLowerCase()
  const filename = task.filename.toLowerCase()
  const fileStem = filename.replace(/\.md$/, "")
  const filePath = task.filePath.toLowerCase()

  return (
    taskId === normalizedQuery ||
    filename === normalizedQuery ||
    fileStem === normalizedQuery ||
    filePath.endsWith(`/${normalizedQuery}`) ||
    filePath.endsWith(`/${normalizedQuery}.md`)
  )
}

/**
 * Checks if a task matches a short numeric suffix (e.g. "001" or numeric 1).
 */
export const isTaskNumericSuffixMatch = (
  task: BoardTask,
  query: string,
  numericQuery: number | null,
): boolean => {
  const canonicalId = task.document.id ?? task.document.frontmatter.id ?? task.filename
  const match = canonicalId.match(TASK_SUFFIX_REGEX)
  if (match == null || match[1] == null) {
    return false
  }

  const suffix = match[1]
  if (suffix === query || suffix.endsWith(query)) {
    return true
  }

  if (numericQuery != null && parseInt(suffix, 10) === numericQuery) {
    return true
  }

  return false
}

export interface TaskQueryOptions {
  readonly enableFuzzy?: boolean
  readonly column?: string | readonly string[]
}

/**
 * Standardized multi-tier query resolution across a collection of tasks:
 * - Tier 1: Exact canonical ID, frontmatter ID, filename stem, or relative path.
 * - Tier 2: Numeric suffix match (e.g., "001" or "1").
 * - Tier 3 (optional): Fuzzy match across filename and title.
 *
 * Query is assumed to be normalized / non-empty by boundary parsers.
 */
export const findTaskByQuery = (
  tasks: readonly BoardTask[],
  query: string,
  options?: TaskQueryOptions,
): LookupMatchResult => {
  const scopedTasks = options?.column != null
    ? Array.isArray(options.column)
      ? tasks.filter((t) => (options.column as readonly string[]).includes(t.column))
      : tasks.filter((t) => t.column === options.column)
    : tasks

  // Tier 1: Exact Match
  const exact = scopedTasks.find((t) => isTaskExactMatch(t, query))
  if (exact != null) {
    return { kind: "FOUND", task: exact }
  }

  // Tier 2: Numeric Suffix Match
  const parsedNum = parseInt(query, 10)
  const numericQuery = !Number.isNaN(parsedNum) ? parsedNum : null

  const suffixMatches = scopedTasks.filter((t) => isTaskNumericSuffixMatch(t, query, numericQuery))
  if (suffixMatches.length === 1 && suffixMatches[0] != null) {
    return { kind: "FOUND", task: suffixMatches[0] }
  }
  if (suffixMatches.length > 1) {
    return { kind: "AMBIGUOUS", matches: Object.freeze(suffixMatches) }
  }

  // Tier 3: Optional Fuzzy Match (for read-only operations like view)
  if (options?.enableFuzzy) {
    const normalizedQuery = query.toLowerCase()
    const fuzzyMatches = scopedTasks.filter((t) => {
      const filename = t.filename.toLowerCase()
      const title = (t.document.title ?? "").toLowerCase()
      return filename.includes(normalizedQuery) || title.includes(normalizedQuery)
    })

    if (fuzzyMatches.length === 1 && fuzzyMatches[0] != null) {
      return { kind: "FOUND", task: fuzzyMatches[0] }
    }
    if (fuzzyMatches.length > 1) {
      return { kind: "AMBIGUOUS", matches: Object.freeze(fuzzyMatches) }
    }
  }

  return { kind: "NOT_FOUND" }
}

/**
 * Flattens all tasks across board columns into a single array.
 */
export const getAllBoardTasks = (board: Board): readonly BoardTask[] =>
  board.columns.flatMap((col) => col.tasks)

/**
 * Resolves a task by exact identifier:
 * - Exact task ID (e.g., "task.dirban.core.26-001" or "26-001")
 * - Exact filename (e.g., "26-001-fix-auth.md")
 * - Exact file stem without extension (e.g., "26-001-fix-auth")
 * - Exact relative or absolute file path
 */
export const findTaskExact = (
  board: Board,
  idOrPath: string,
): BoardTask | null => {
  const allTasks = getAllBoardTasks(board)
  const match = allTasks.find((t) => isTaskExactMatch(t, idOrPath))
  return match ?? null
}

/**
 * Resolves a task for read-only operations (e.g., `view`).
 * Uses findTaskByQuery with fuzzy matching enabled across the entire board.
 */
export const findTaskWithFuzzy = (
  board: Board,
  query: string,
): LookupMatchResult => {
  const allTasks = getAllBoardTasks(board)
  return findTaskByQuery(allTasks, query, { enableFuzzy: true })
}

/**
 * Backward-compatible exact task lookup. Supports Tier 1 and Tier 2 resolution
 * across all board columns.
 */
export const findTaskByIdOrName = (
  board: Board,
  idOrPath: string,
): BoardTask | null => {
  const allTasks = getAllBoardTasks(board)
  const res = findTaskByQuery(allTasks, idOrPath)
  return res.kind === "FOUND" ? res.task : null
}
