import { err, ok, type Result } from "neverthrow"
import * as fs from "node:fs"
import * as path from "node:path"
import YAML from "yaml"
import type { Board, BoardTask } from "../../board/types.ts"
import { findTaskByIdOrName } from "../../board/discovery.ts"
import { LINE_SPLIT_REGEX } from "../../okf/parser.ts"
import type { TaskRelationships } from "../../okf/types.ts"
import { getIsoDate } from "../mutation/move.ts"
import type { OperationError } from "../types.ts"
import { isTaskId } from "../../board/dependencies.ts"

const FRONTMATTER_DELIMITER = "---"
const COMMA_SPLIT_REGEX = /\s*,\s*/
const BACKLOG_COLUMN = "backlog" as const

const detectEol = (content: string): "\r\n" | "\n" =>
  content.includes("\r\n") ? "\r\n" : "\n"

export const normalizeBlockerInput = (
  rawInput: string,
  board: Board,
): string => {
  const trimmed = rawInput.trim()
  if (isTaskId(trimmed)) {
    return trimmed
  }

  // Check if rawInput refers to an existing task by path, slug or filename
  const matchedTask = findTaskByIdOrName(board, trimmed)
  if (matchedTask != null) {
    const canonicalId = matchedTask.document.id ?? matchedTask.document.frontmatter.id
    if (canonicalId != null && canonicalId !== "") {
      return canonicalId
    }
  }

  // Otherwise, treat as freeform string reason
  return trimmed
}

export const parseBlockerReasons = (
  rawReasons: readonly string[],
  board: Board,
): readonly string[] => {
  const normalized: string[] = []

  for (const raw of rawReasons) {
    const trimmed = raw.trim()
    if (trimmed === "") continue

    // Support comma-separated inputs
    const parts = trimmed.includes(",")
      ? trimmed.split(COMMA_SPLIT_REGEX)
      : [trimmed]

    for (const part of parts) {
      const partTrimmed = part.trim()
      if (partTrimmed !== "") {
        normalized.push(normalizeBlockerInput(partTrimmed, board))
      }
    }
  }

  return normalized
}

const writeTaskRelationships = (
  task: BoardTask,
  updatedRelationships: TaskRelationships,
): Result<BoardTask, OperationError> => {
  let rawContent: string
  try {
    rawContent = fs.readFileSync(task.filePath, "utf-8")
  } catch (readErr) {
    return err({
      kind: "FS_ERROR",
      message: readErr instanceof Error ? readErr.message : "Failed to read task file",
    })
  }

  const today = getIsoDate()
  const eol = detectEol(rawContent)
  const lines = rawContent.split(LINE_SPLIT_REGEX)
  let updatedContent: string

  const relationshipsRecord = {
    depends_on: [...updatedRelationships.depends_on],
    blocks: [...updatedRelationships.blocks],
    related_to: [...updatedRelationships.related_to],
  }

  if (lines[0]?.trim() === FRONTMATTER_DELIMITER) {
    const secondDelim = lines.slice(1).findIndex((l) => l.trim() === FRONTMATTER_DELIMITER)
    if (secondDelim !== -1) {
      const frontmatterRaw = lines.slice(1, secondDelim + 1).join("\n")
      const body = lines.slice(secondDelim + 2).join(eol)

      let parsed: Record<string, unknown> = {}
      try {
        const parsedYaml = YAML.parse(frontmatterRaw)
        if (parsedYaml != null && typeof parsedYaml === "object") {
          parsed = parsedYaml as Record<string, unknown>
        }
      } catch {
        // Fallback to empty object
      }

      const merged = {
        ...parsed,
        last_updated: today,
        relationships: relationshipsRecord,
      }
      const yamlStr = YAML.stringify(merged).trim()
      updatedContent = `---\n${yamlStr}\n---${eol}${body}`
    } else {
      updatedContent = rawContent
    }
  } else {
    // Pure markdown without frontmatter
    const newFrontmatter: Record<string, unknown> = {
      id: task.document.id,
      last_updated: today,
      relationships: relationshipsRecord,
    }
    const yamlStr = YAML.stringify(newFrontmatter).trim()
    updatedContent = `---\n${yamlStr}\n---${eol}${eol}${rawContent.trim()}${eol}`
  }

  try {
    fs.writeFileSync(task.filePath, updatedContent, "utf-8")
  } catch (fsErr) {
    return err({
      kind: "FS_ERROR",
      message: fsErr instanceof Error ? fsErr.message : "Failed to save updated task",
    })
  }

  const updatedFm = {
    ...task.document.frontmatter,
    last_updated: today,
    relationships: updatedRelationships,
  }

  const updatedDoc = {
    ...task.document,
    last_updated: today,
    frontmatter: updatedFm,
  }

  return ok({
    ...task,
    document: updatedDoc,
  })
}

export interface BlockTaskResult {
  readonly task: BoardTask
  readonly addedBlockers: readonly string[]
  readonly demotedToBacklog: boolean
}

export const blockTask = (
  board: Board,
  taskIdOrPath: string,
  reasons: readonly string[],
): Result<BlockTaskResult, OperationError> => {
  const task = findTaskByIdOrName(board, taskIdOrPath)
  if (task == null) {
    return err({
      kind: "TASK_NOT_FOUND",
      message: `Task not found: ${taskIdOrPath}`,
      id: taskIdOrPath,
    })
  }

  const normalizedBlockers = parseBlockerReasons(reasons, board)
  if (normalizedBlockers.length === 0) {
    return err({
      kind: "INVALID_MUTATION",
      message: "At least one blocker reason or task ID must be provided",
    })
  }

  const existingDeps = task.document.frontmatter.relationships?.depends_on ?? []
  const existingSet = new Set(existingDeps)
  const newlyAdded: string[] = []

  for (const blocker of normalizedBlockers) {
    if (!existingSet.has(blocker)) {
      existingSet.add(blocker)
      newlyAdded.push(blocker)
    }
  }

  const updatedRelationships: TaskRelationships = {
    depends_on: [...existingDeps, ...newlyAdded],
    blocks: task.document.frontmatter.relationships?.blocks ?? [],
    related_to: task.document.frontmatter.relationships?.related_to ?? [],
  }

  const writeResult = writeTaskRelationships(task, updatedRelationships)
  if (writeResult.isErr()) {
    return err(writeResult.error)
  }

  let finalTask = writeResult.value
  let demoted = false

  // Demote task to backlog if it is currently in an active workflow column
  if (task.column !== BACKLOG_COLUMN) {
    const parentDir = path.dirname(path.dirname(task.filePath))
    const targetPath = path.join(parentDir, BACKLOG_COLUMN, task.filename)

    if (targetPath !== task.filePath) {
      try {
        fs.renameSync(task.filePath, targetPath)
        demoted = true
        finalTask = {
          ...finalTask,
          filePath: targetPath,
          column: BACKLOG_COLUMN,
        }
      } catch (renameErr) {
        return err({
          kind: "FS_ERROR",
          message: renameErr instanceof Error
            ? renameErr.message
            : "Failed to demote task to backlog",
        })
      }
    }
  }

  return ok({
    task: finalTask,
    addedBlockers: newlyAdded,
    demotedToBacklog: demoted,
  })
}

export interface UnblockTaskResult {
  readonly task: BoardTask
  readonly removedBlockers: readonly string[]
  readonly remainingBlockers: readonly string[]
}

export const unblockTask = (
  board: Board,
  taskIdOrPath: string,
  blockerToClear?: string,
): Result<UnblockTaskResult, OperationError> => {
  const task = findTaskByIdOrName(board, taskIdOrPath)
  if (task == null) {
    return err({
      kind: "TASK_NOT_FOUND",
      message: `Task not found: ${taskIdOrPath}`,
      id: taskIdOrPath,
    })
  }

  const existingDeps = task.document.frontmatter.relationships?.depends_on ?? []
  if (existingDeps.length === 0) {
    return err({
      kind: "INVALID_MUTATION",
      message: `Task ${task.document.id} has no dependencies or blockers to unblock`,
    })
  }

  let removedBlockers: string[] = []
  let remainingDeps: string[] = []

  const trimmedToClear = blockerToClear?.trim()

  if (trimmedToClear != null && trimmedToClear !== "") {
    const normalizedTarget = normalizeBlockerInput(trimmedToClear, board)
    const foundIndex = existingDeps.findIndex(
      (d) => d === trimmedToClear || d === normalizedTarget,
    )

    if (foundIndex === -1) {
      return err({
        kind: "INVALID_MUTATION",
        message: `Blocker "${trimmedToClear}" not found on task ${task.document.id}. Current blockers: ${existingDeps.join(", ")}`,
      })
    }

    removedBlockers = [existingDeps[foundIndex]!]
    remainingDeps = existingDeps.filter((_, idx) => idx !== foundIndex)
  } else if (existingDeps.length === 1) {
    // Exactly one blocker: clear it automatically
    removedBlockers = [existingDeps[0]!]
    remainingDeps = []
  } else {
    // Multiple blockers: require explicit target
    return err({
      kind: "INVALID_MUTATION",
      message: `Task ${task.document.id} has multiple blockers. Specify which one to unblock: ${existingDeps.map((d) => `"${d}"`).join(", ")}`,
    })
  }

  const updatedRelationships: TaskRelationships = {
    depends_on: remainingDeps,
    blocks: task.document.frontmatter.relationships?.blocks ?? [],
    related_to: task.document.frontmatter.relationships?.related_to ?? [],
  }

  const writeResult = writeTaskRelationships(task, updatedRelationships)
  if (writeResult.isErr()) {
    return err(writeResult.error)
  }

  return ok({
    task: writeResult.value,
    removedBlockers,
    remainingBlockers: remainingDeps,
  })
}


