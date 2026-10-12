import { err, ok, type Result } from "neverthrow"
import type { Board, BoardTask } from "../board/types.ts"
import { findTaskByIdOrName } from "../board/discovery.ts"
import * as fs from "node:fs"
import { serializeTaskDocument } from "../okf/serializer.ts"
import { getIsoDate } from "./move.ts"
import type { OperationError } from "./types.ts"

export const checkTaskItem = (
  board: Board,
  taskIdOrPath: string,
  targetIndex: number,
  forcedState?: boolean,
): Result<BoardTask, OperationError> => {
  const task = findTaskByIdOrName(board, taskIdOrPath)
  if (task == null) {
    return err({
      kind: "TASK_NOT_FOUND",
      message: `Task not found: ${taskIdOrPath}`,
      id: taskIdOrPath,
    })
  }

  const items = task.document.acceptanceCriteria
  const targetItem = items.find((it) => it.index === targetIndex)
  if (targetItem == null) {
    return err({
      kind: "INDEX_OUT_OF_BOUNDS",
      message:
        `Acceptance criteria item #${targetIndex} does not exist (total: ${items.length})`,
      index: targetIndex,
    })
  }

  const newChecked = forcedState != null ? forcedState : !targetItem.checked
  const today = getIsoDate()

  const updatedItems = items.map((it) => {
    if (it.index === targetIndex) {
      return Object.freeze({
        ...it,
        checked: newChecked,
      })
    }
    return it
  })

  // Update rawBody lines
  let bodyLines = task.document.rawBody.split("\n")
  let currentAcIndex = 1

  bodyLines = bodyLines.map((line) => {
    const match = line.match(/^(\s*-\s*\[)([ xX])(\]\s*.+)$/)
    if (match != null && match[1] != null && match[3] != null) {
      if (currentAcIndex === targetIndex) {
        currentAcIndex += 1
        return `${match[1]}${newChecked ? "x" : " "}${match[3]}`
      }
      currentAcIndex += 1
    }
    return line
  })

  const updatedDoc = Object.freeze({
    ...task.document,
    frontmatter: Object.freeze({
      ...task.document.frontmatter,
      last_updated: today,
    }),
    acceptanceCriteria: Object.freeze(updatedItems),
    rawBody: bodyLines.join("\n"),
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
        : "Failed to save updated task checklist",
    })
  }
}
