import { err, ok, type Result } from "neverthrow"
import * as fs from "node:fs"
import YAML from "yaml"
import type { Board, BoardTask } from "../../board/types.ts"
import { findTaskByIdOrName } from "../../board/discovery.ts"
import { LINE_SPLIT_REGEX } from "../../okf/parser.ts"
import type { Priority } from "../../okf/types.ts"
import { getIsoDate } from "./move.ts"
import type { OperationError } from "../types.ts"

const detectEol = (content: string): "\r\n" | "\n" =>
  content.includes("\r\n") ? "\r\n" : "\n"

export interface TaskMutationOptions {
  readonly priority?: Priority
  readonly assignee?: string
  readonly owner?: string
  readonly title?: string
  readonly tags?: readonly string[]
}

const FRONTMATTER_DELIMITER = "---"

const buildFrontmatterUpdates = (
  options: TaskMutationOptions,
  today: string,
): Record<string, unknown> => {
  const candidateEntries: readonly [string, unknown][] = [
    ["last_updated", today],
    ["priority", options.priority],
    ["assigned_to", options.assignee],
    ["owner", options.owner],
    ["title", options.title],
    ["tags", options.tags != null ? [...options.tags] : undefined],
  ]

  return Object.fromEntries(
    candidateEntries.filter(([, value]) => value != null),
  )
}

export const setTaskMetadata = (
  board: Board,
  taskIdOrPath: string,
  options: TaskMutationOptions,
): Result<BoardTask, OperationError> => {
  const task = findTaskByIdOrName(board, taskIdOrPath)
  if (task == null) {
    return err({
      kind: "TASK_NOT_FOUND",
      message: `Task not found: ${taskIdOrPath}`,
      id: taskIdOrPath,
    })
  }

  const today = getIsoDate()
  const fm = task.document.frontmatter
  const updates = buildFrontmatterUpdates(options, today)

  const updatedFm = Object.freeze({
    ...fm,
    ...updates,
    priority: (updates.priority as Priority | undefined) ?? fm.priority,
    tags: updates.tags != null ? Object.freeze(updates.tags as string[]) : fm.tags,
  })

  // Read current file content directly
  let rawContent: string
  try {
    rawContent = fs.readFileSync(task.filePath, "utf-8")
  } catch (readErr) {
    return err({
      kind: "FS_ERROR",
      message: readErr instanceof Error ? readErr.message : "Failed to read task file",
    })
  }

  const eol = detectEol(rawContent)
  const lines = rawContent.split(LINE_SPLIT_REGEX)
  let updatedContent: string

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

      const merged = { ...parsed, ...updates }
      const yamlStr = YAML.stringify(merged).trim()
      updatedContent = `---\n${yamlStr}\n---${eol}${body}`
    } else {
      updatedContent = rawContent
    }
  } else {
    // Pure markdown without frontmatter: create minimal frontmatter with changes
    const newFrontmatter: Record<string, unknown> = {
      id: task.document.id,
      ...updates,
    }

    const yamlStr = YAML.stringify(newFrontmatter).trim()
    updatedContent = `---\n${yamlStr}\n---${eol}${eol}${rawContent.trim()}${eol}`
  }

  const updatedDoc = Object.freeze({
    ...task.document,
    id: updatedFm.id ?? task.document.id,
    title: updatedFm.title ?? task.document.title,
    priority: updatedFm.priority ?? task.document.priority,
    tags: updatedFm.tags ?? task.document.tags,
    owner: updatedFm.owner ?? task.document.owner,
    assigned_to: updatedFm.assigned_to ?? task.document.assigned_to,
    last_updated: today,
    frontmatter: updatedFm,
  })

  try {
    fs.writeFileSync(task.filePath, updatedContent, "utf-8")

    return ok(Object.freeze({
      ...task,
      document: updatedDoc,
    }))
  } catch (fsErr) {
    return err({
      kind: "FS_ERROR",
      message: fsErr instanceof Error
        ? fsErr.message
        : "Failed to save updated task metadata",
    })
  }
}


