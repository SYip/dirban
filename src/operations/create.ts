import * as fs from "node:fs"
import * as path from "node:path"
import { err, ok, type Result } from "neverthrow"
import type { Board } from "../board/types.ts"
import type { Priority } from "../okf/types.ts"
import type { OperationError } from "./types.ts"

const SLUGIFY = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Extracts all numeric suffixes from existing tasks for a given 2-digit year.
 * Matches patterns like "26-001", "task.26-001", "26-1", etc.
 */
export const getExistingTaskNumbersForYear = (
  board: Board,
  yearYY: string,
): readonly number[] => {
  const numbers: number[] = []
  const pattern = new RegExp(`(?:^|[^0-9])${yearYY}-(\\d+)(?:[^0-9]|$)`, "i")

  for (const col of board.columns) {
    for (const task of col.tasks) {
      // Check frontmatter ID
      const idMatch = task.document.frontmatter.id.match(pattern)
      if (idMatch?.[1] != null) {
        const num = parseInt(idMatch[1], 10)
        if (!isNaN(num)) numbers.push(num)
      }

      // Also check filename
      const fileMatch = task.filename.match(pattern)
      if (fileMatch?.[1] != null) {
        const num = parseInt(fileMatch[1], 10)
        if (!isNaN(num)) numbers.push(num)
      }
    }
  }

  return numbers
}

/**
 * Computes the next ID string formatted as YY-001 (or YY-0001 if padded).
 * Automatically calculates the 2-digit year from the current date or provided date.
 */
export const calculateNextTaskId = (
  board: Board,
  referenceDate: Date = new Date(),
  minDigits: number = 3,
): string => {
  const yearYY = String(referenceDate.getFullYear()).slice(-2)
  const existingNumbers = getExistingTaskNumbersForYear(board, yearYY)

  const maxNumber = existingNumbers.length > 0
    ? Math.max(...existingNumbers)
    : 0

  const nextNumber = maxNumber + 1
  const padded = String(nextNumber).padStart(minDigits, "0")

  return `${yearYY}-${padded}`
}

export interface CreateTaskOptions {
  readonly title: string
  readonly column?: string
  readonly priority?: Priority
  readonly owner?: string
  readonly assigned_to?: string
  readonly tags?: readonly string[]
  readonly criteria?: readonly string[]
}

export interface CreatedTaskResult {
  readonly id: string
  readonly filePath: string
  readonly column: string
  readonly filename: string
}

/**
 * Creates a new task file in the target column with auto-generated ID.
 */
export const createTask = (
  board: Board,
  options: CreateTaskOptions,
  referenceDate: Date = new Date(),
): Result<CreatedTaskResult, OperationError> => {
  const trimmedTitle = options.title.trim()
  if (trimmedTitle === "") {
    return err({
      kind: "INVALID_MUTATION",
      message: "Task title cannot be empty",
    })
  }

  const targetColumnName = options.column ??
    board.columns[0]?.name ??
    "00-backlog"

  const targetCol = board.columns.find((c) =>
    c.name.toLowerCase() === targetColumnName.toLowerCase() ||
    c.name.toLowerCase().endsWith(targetColumnName.toLowerCase())
  )

  if (targetCol == null) {
    return err({
      kind: "COLUMN_NOT_FOUND",
      column: targetColumnName,
      message: `Target column '${targetColumnName}' not found on board`,
    })
  }

  const nextId = calculateNextTaskId(board, referenceDate)
  const slug = SLUGIFY(trimmedTitle)
  const filename = slug !== "" ? `${nextId}-${slug}.md` : `${nextId}.md`
  const filePath = path.join(targetCol.path, filename)

  if (fs.existsSync(filePath)) {
    return err({
      kind: "FS_ERROR",
      message: `File already exists: ${filePath}`,
    })
  }

  const dateStr = referenceDate.toISOString().slice(0, 10)
  const priority = options.priority ?? "p2"
  const owner = options.owner ?? "developer"
  const assignedTo = options.assigned_to ?? "unassigned"
  const tags = options.tags ?? []

  const yamlLines = [
    "---",
    `id: "${nextId}"`,
    `title: "${trimmedTitle.replace(/"/g, '\\"')}"`,
    `type: "task"`,
    `status: "${targetCol.name}"`,
    `priority: "${priority}"`,
    `owner: "${owner}"`,
    `assigned_to: "${assignedTo}"`,
    `created_date: "${dateStr}"`,
    `last_updated: "${dateStr}"`,
  ]

  if (tags.length > 0) {
    yamlLines.push("tags:")
    for (const tag of tags) {
      yamlLines.push(`  - ${tag}`)
    }
  } else {
    yamlLines.push("tags: []")
  }

  yamlLines.push("---")

  const criteria = options.criteria && options.criteria.length > 0
    ? options.criteria
    : ["Initial task implementation"]

  const bodyLines = [
    "",
    `# ${trimmedTitle}`,
    "",
    "## Acceptance Criteria",
    ...criteria.map((c) => `- [ ] ${c}`),
    "",
  ]

  const fullContent = `${yamlLines.join("\n")}\n${bodyLines.join("\n")}`

  try {
    fs.writeFileSync(filePath, fullContent, "utf-8")
  } catch (e) {
    return err({
      kind: "FS_ERROR",
      message: e instanceof Error ? e.message : "Failed to write task file",
    })
  }

  return ok(Object.freeze({
    id: nextId,
    filePath,
    column: targetCol.name,
    filename,
  }))
}
