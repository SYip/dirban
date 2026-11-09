import { err, ok, type Result } from "neverthrow"
import type { Board, BoardTask } from "../../board/types.ts"
import { findTaskByIdOrName } from "../../board/discovery.ts"
import * as fs from "node:fs"
import { LINE_SPLIT_REGEX } from "../../okf/parser.ts"
import { getIsoDate } from "./move.ts"
import type { OperationError } from "../types.ts"

const detectEol = (content: string): "\r\n" | "\n" =>
  content.includes("\r\n") ? "\r\n" : "\n"

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

  // Read current file content directly to preserve exact markdown formatting
  let fileContent: string
  try {
    fileContent = fs.readFileSync(task.filePath, "utf-8")
  } catch (readErr) {
    return err({
      kind: "FS_ERROR",
      message: readErr instanceof Error ? readErr.message : "Failed to read task file",
    })
  }

  const eol = detectEol(fileContent)
  let currentAcIndex = 1
  const updatedLines = fileContent.split(LINE_SPLIT_REGEX).map((line) => {
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
    rawBody: updatedLines.join(eol),
  })

  try {
    fs.writeFileSync(task.filePath, updatedLines.join(eol), "utf-8")

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


