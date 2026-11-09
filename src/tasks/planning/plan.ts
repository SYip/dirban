import { err, ok, type Result } from "neverthrow"
import type { Board, BoardTask } from "../../board/types.ts"
import { evaluateTaskBlockers, type TaskBlockerEvaluation } from "../../board/dependencies.ts"
import { findTaskByIdOrName, findTaskByQuery } from "../../board/discovery.ts"
import { moveTask } from "../mutation/move.ts"
import type { OperationError } from "../types.ts"
import type { DirbanConfig } from "../../config/types.ts"

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

/**
 * Resolves a task ID from the backlog tasks by exact match or short numeric suffix.
 * Returns AMBIGUOUS_TASK_ID if multiple backlog tasks match the short ID.
 * If not found in backlog, inspects the wider board to return an informative error.
 */
export const resolveBacklogTaskId = (
  backlogTasks: readonly BoardTask[],
  query: string,
  board?: Board,
): Result<BoardTask, OperationError> => {
  const matchResult = findTaskByQuery(backlogTasks, query)
  if (matchResult.kind === "FOUND") {
    return ok(matchResult.task)
  }

  if (matchResult.kind === "AMBIGUOUS") {
    const matchedIds = matchResult.matches.map(
      (t) => t.document.id ?? t.document.frontmatter.id ?? t.filename,
    )
    return err({
      kind: "AMBIGUOUS_TASK_ID",
      message: `Ambiguous short task ID '${query}': matches multiple tasks [${matchedIds.join(", ")}]. Please specify full task ID.`,
      id: query,
      matches: matchedIds,
    })
  }

  // Cross-board awareness: check if task exists elsewhere on the board
  if (board != null) {
    const elsewhere = findTaskByIdOrName(board, query)
    if (elsewhere != null) {
      const displayId = elsewhere.document.id ?? elsewhere.filename
      return err({
        kind: "INVALID_MUTATION",
        message: `Cannot promote task ${displayId}: task is already in '${elsewhere.column}'.`,
      })
    }
  }

  return err({
    kind: "TASK_NOT_FOUND",
    message: `Task not found in backlog: ${query}`,
    id: query,
  })
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

export interface BatchPromoteResult {
  readonly promoted: readonly PromoteTaskResult[]
  readonly failed: readonly {
    readonly taskId: string
    readonly error: OperationError
  }[]
}

export const promoteTasks = (
  board: Board,
  config: DirbanConfig,
  taskIdsOrPaths: readonly string[],
  targetColumnOverride?: string,
): BatchPromoteResult => {
  const targetColumn = targetColumnOverride ?? config.columns[0]
  if (targetColumn == null || targetColumn.trim() === "") {
    return {
      promoted: [],
      failed: taskIdsOrPaths.map((id) => ({
        taskId: id,
        error: {
          kind: "COLUMN_NOT_FOUND",
          message: "No active workflow columns configured for promotion target",
          column: targetColumnOverride ?? "columns[0]",
        },
      })),
    }
  }

  const backlogCol = board.columns.find(
    (c) => c.name.toLowerCase() === BACKLOG_COLUMN,
  )
  const backlogTasks = backlogCol?.tasks ?? []

  const trimmedIds = taskIdsOrPaths
    .map((id) => id.trim())
    .filter((id) => id !== "")

  // Phase 1: Pre-validation (all-or-nothing check)
  // Resolve every task and verify it is not blocked.
  const resolvedTasks: BoardTask[] = []
  const validationErrors: { taskId: string; error: OperationError }[] = []

  for (const query of trimmedIds) {
    const resolveRes = resolveBacklogTaskId(backlogTasks, query, board)
    if (resolveRes.isErr()) {
      validationErrors.push({ taskId: query, error: resolveRes.error })
      continue
    }

    const task = resolveRes.value
    const evaluation = evaluateTaskBlockers(task, board)
    if (evaluation.isBlocked) {
      const blockerList = evaluation.unresolved.join(", ")
      validationErrors.push({
        taskId: query,
        error: {
          kind: "INVALID_MUTATION",
          message: `Cannot promote task ${task.document.id}: it is currently blocked by [${blockerList}]`,
        },
      })
      continue
    }

    resolvedTasks.push(task)
  }

  // If any task failed validation, abort entire batch: 0 tasks moved
  if (validationErrors.length > 0) {
    return {
      promoted: [],
      failed: validationErrors,
    }
  }

  // Phase 2: Atomic Execution (all pre-validated tasks are moved)
  const promoted: PromoteTaskResult[] = []
  const executionErrors: { taskId: string; error: OperationError }[] = []

  for (const task of resolvedTasks) {
    const taskIdOrName = task.document.id ?? task.filename
    const moveRes = moveTask(board, taskIdOrName, targetColumn)
    if (moveRes.isOk()) {
      promoted.push({
        task: moveRes.value,
        targetColumn,
      })
    } else {
      executionErrors.push({
        taskId: taskIdOrName,
        error: moveRes.error,
      })
    }
  }

  return {
    promoted,
    failed: executionErrors,
  }
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
  const backlogTasks = backlogCol?.tasks ?? []

  const resolveRes = resolveBacklogTaskId(backlogTasks, taskIdOrPath)
  if (resolveRes.isErr()) {
    return err(resolveRes.error)
  }

  const task = resolveRes.value
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


