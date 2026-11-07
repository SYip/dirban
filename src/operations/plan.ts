import { err, ok, type Result } from "neverthrow"
import type { Board, BoardTask } from "../board/types.ts"
import { evaluateTaskBlockers, type TaskBlockerEvaluation } from "../board/dependencies.ts"
import { moveTask } from "./move.ts"
import type { OperationError } from "./types.ts"
import type { DirbanConfig } from "../config/types.ts"

const BACKLOG_COLUMN = "backlog" as const

export interface PlannedTask {
  readonly task: BoardTask
  readonly evaluation: TaskBlockerEvaluation
}

export interface PartitionedPlan {
  readonly ready: readonly PlannedTask[]
  readonly blocked: readonly PlannedTask[]
  readonly totalBacklog: number
}

export const partitionBacklog = (board: Board): PartitionedPlan => {
  const backlogCol = board.columns.find(
    (c) => c.name.toLowerCase() === BACKLOG_COLUMN,
  )

  if (backlogCol == null || backlogCol.tasks.length === 0) {
    return {
      ready: [],
      blocked: [],
      totalBacklog: 0,
    }
  }

  const ready: PlannedTask[] = []
  const blocked: PlannedTask[] = []

  for (const task of backlogCol.tasks) {
    const evaluation = evaluateTaskBlockers(task, board)
    if (evaluation.isBlocked) {
      blocked.push({ task, evaluation })
    } else {
      ready.push({ task, evaluation })
    }
  }

  return {
    ready,
    blocked,
    totalBacklog: backlogCol.tasks.length,
  }
}

export interface PromoteTaskResult {
  readonly task: BoardTask
  readonly targetColumn: string
}

export const promoteTask = (
  board: Board,
  config: DirbanConfig,
  taskIdOrPath: string,
  targetColumnOverride?: string,
): Result<PromoteTaskResult, OperationError> => {
  const targetColumn = targetColumnOverride ?? config.columns[0]
  if (targetColumn == null || targetColumn.trim() === "") {
    return err({
      kind: "COLUMN_NOT_FOUND",
      message: "No active workflow columns configured for promotion target",
      column: targetColumnOverride ?? "columns[0]",
    })
  }

  const backlogCol = board.columns.find(
    (c) => c.name.toLowerCase() === BACKLOG_COLUMN,
  )

  const task = backlogCol?.tasks.find((t) => {
    const id = t.document.id ?? t.document.frontmatter.id ?? t.filename
    return id === taskIdOrPath || t.filename === taskIdOrPath || t.filePath.endsWith(taskIdOrPath)
  })

  if (task == null) {
    return err({
      kind: "TASK_NOT_FOUND",
      message: `Task not found in backlog: ${taskIdOrPath}`,
      id: taskIdOrPath,
    })
  }

  const evaluation = evaluateTaskBlockers(task, board)
  if (evaluation.isBlocked) {
    const blockerList = evaluation.unresolved.join(", ")
    return err({
      kind: "INVALID_MUTATION",
      message: `Cannot promote task ${task.document.id}: it is currently blocked by [${blockerList}]`,
    })
  }

  const moveRes = moveTask(board, task.document.id ?? task.filename, targetColumn)
  if (moveRes.isErr()) {
    return err(moveRes.error)
  }

  return ok({
    task: moveRes.value,
    targetColumn,
  })
}

