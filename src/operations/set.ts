import { err, ok, type Result } from "neverthrow"
import * as fs from "node:fs"
import type { Board, BoardTask } from "../board/types.ts"
import { findTaskByIdOrName } from "../board/discovery.ts"
import type { Priority } from "../okf/types.ts"
import { serializeTaskDocument } from "../okf/serializer.ts"
import { getIsoDate } from "./move.ts"
import type { OperationError } from "./types.ts"

export interface TaskMutationOptions {
  readonly priority?: Priority
  readonly assignee?: string
  readonly owner?: string
  readonly title?: string
  readonly tags?: readonly string[]
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

  const updatedFm = Object.freeze({
    ...fm,
    priority: options.priority != null ? options.priority : fm.priority,
    assigned_to: options.assignee != null ? options.assignee : fm.assigned_to,
    owner: options.owner != null ? options.owner : fm.owner,
    title: options.title != null ? options.title : fm.title,
    tags: options.tags != null ? Object.freeze([...options.tags]) : fm.tags,
    last_updated: today,
  })

  const updatedDoc = Object.freeze({
    ...task.document,
    frontmatter: updatedFm,
  })

  try {
    const serialized = serializeTaskDocument(updatedDoc)
    fs.writeFileSync(task.filePath, serialized, "utf-8")

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
