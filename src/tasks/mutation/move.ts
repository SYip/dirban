import { err, ok, type Result } from "neverthrow"
import * as path from "node:path"
import * as fs from "node:fs"
import type { Board, BoardTask } from "../../board/types.ts"
import { findTaskByIdOrName } from "../../board/discovery.ts"
import type { OperationError } from "../types.ts"

declare const Temporal: {
  Now?: {
    plainDateISO: () => { toString: () => string }
  }
} | undefined

export const getIsoDate = (): string => {
  if (typeof Temporal !== "undefined" && Temporal?.Now != null) {
    return Temporal.Now.plainDateISO().toString()
  }
  return new Date().toISOString().slice(0, 10)
}

export const moveTask = (
  board: Board,
  taskIdOrPath: string,
  targetColumnName: string,
): Result<BoardTask, OperationError> => {
  const task = findTaskByIdOrName(board, taskIdOrPath)
  if (task == null) {
    return err({
      kind: "TASK_NOT_FOUND",
      message: `Task not found: ${taskIdOrPath}`,
      id: taskIdOrPath,
    })
  }

  const targetCol = board.columns.find((c) =>
    c.name.toLowerCase() === targetColumnName.toLowerCase() ||
    c.name.toLowerCase().endsWith(targetColumnName.toLowerCase())
  )

  if (targetCol == null) {
    return err({
      kind: "COLUMN_NOT_FOUND",
      message: `Target column does not exist on board: ${targetColumnName}`,
      column: targetColumnName,
    })
  }

  if (task.column === targetCol.name) {
    return ok(task)
  }

  const newFilePath = path.join(targetCol.path, task.filename)

  try {
    fs.renameSync(task.filePath, newFilePath)

    const updatedDoc = Object.freeze({
      ...task.document,
      frontmatter: Object.freeze({
        ...task.document.frontmatter,
        status: targetCol.name,
      }),
    })

    return ok(Object.freeze({
      filePath: newFilePath,
      filename: task.filename,
      column: targetCol.name,
      document: updatedDoc,
    }))
  } catch (fsErr) {
    return err({
      kind: "FS_ERROR",
      message: fsErr instanceof Error
        ? fsErr.message
        : "Failed to move task file on disk",
    })
  }
}

