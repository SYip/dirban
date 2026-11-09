import { err, ok, type Result } from "neverthrow"
import type { Board, BoardTask } from "../../board/types.ts"
import { resolveFocusColumn, resolvePreviousColumn } from "../../config/config.ts"
import type { DirbanConfig } from "../../config/types.ts"

export interface ResolveNextTaskSuccess {
  readonly task: BoardTask
  readonly sourceColumn: string
  readonly queueCount: number
}

export type ResolveNextTaskError =
  | { readonly kind: "NO_TODO_COLUMN"; readonly message: string }
  | { readonly kind: "QUEUE_EMPTY"; readonly message: string; readonly sourceColumn: string }

export const resolveNextTask = (
  board: Board,
  config: DirbanConfig,
): Result<ResolveNextTaskSuccess, ResolveNextTaskError> => {
  const focusCol = resolveFocusColumn(config)
  if (focusCol == null) {
    return err({
      kind: "NO_TODO_COLUMN",
      message: "No focus or todo column available in board configuration.",
    })
  }

  // Find column preceding focus column (e.g. 01-todo if focus is 02-doing)
  const todoColName = resolvePreviousColumn(config, focusCol) ?? config.columns[0]
  if (todoColName == null) {
    return err({
      kind: "NO_TODO_COLUMN",
      message: "No todo queue column found preceding the active focus column.",
    })
  }

  const column = board.columns.find(
    (c) => c.name.toLowerCase() === todoColName.toLowerCase(),
  )

  if (column == null || column.tasks.length === 0) {
    return err({
      kind: "QUEUE_EMPTY",
      sourceColumn: todoColName,
      message: `No scheduled tasks remain in ${todoColName}. Run "dirban plan" to promote unblocked tasks from backlog.`,
    })
  }

  // Board discovery sorts tasks by priority descending (p0 -> p1 -> p2 -> p3)
  const nextTask = column.tasks[0]!

  return ok({
    task: nextTask,
    sourceColumn: todoColName,
    queueCount: column.tasks.length,
  })
}
