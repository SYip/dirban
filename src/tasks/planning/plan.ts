import { err, ok, type Result } from "neverthrow"
import type { Board, BoardTask } from "../../board/types.ts"
import { evaluateTaskBlockers, type TaskBlockerEvaluation } from "../../board/dependencies.ts"
import { moveTask } from "../mutation/move.ts"
import type { OperationError } from "../types.ts"
import type { DirbanConfig } from "../../config/types.ts"

const BACKLOG_COLUMN = "backlog" as const
const TASK_SUFFIX_REGEX = /(?:^|[\.-])(\d{1,4})(?:\.md)?$/

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
 */
export const resolveBacklogTaskId = (
  backlogTasks: readonly BoardTask[],
  query: string,
): Result<BoardTask, OperationError> => {
  const trimmed = query.trim()
  if (trimmed === "") {
    return err({
      kind: "TASK_NOT_FOUND",
      message: "Task query cannot be empty",
      id: query,
    })
  }

  // 1. Exact match (ID, frontmatter ID, filename, or file stem)
  const exactMatch = backlogTasks.find((t) => {
    const canonicalId = t.document.id ?? t.document.frontmatter.id
    const fileStem = t.filename.replace(/\.md$/, "")
    return (
      canonicalId === trimmed ||
      t.filename === trimmed ||
      fileStem === trimmed ||
      t.filePath.endsWith(trimmed)
    )
  })

  if (exactMatch != null) {
    return ok(exactMatch)
  }

  // 2. Short numeric suffix match (e.g. "001" or "1")
  const numericQuery = parseInt(trimmed, 10)
  const isNumericQuery = !isNaN(numericQuery)

  const suffixMatches = backlogTasks.filter((t) => {
    const canonicalId = t.document.id ?? t.document.frontmatter.id ?? t.filename
    const match = canonicalId.match(TASK_SUFFIX_REGEX)
    if (match == null || match[1] == null) {
      return false
    }

    const taskSuffix = match[1]
    // Suffix string match (e.g. "001" matches "26-001")
    if (taskSuffix === trimmed || taskSuffix.endsWith(trimmed)) {
      return true
    }

    // Number value match (e.g. "1" matches 1 from "001")
    if (isNumericQuery && parseInt(taskSuffix, 10) === numericQuery) {
      return true
    }

    return false
  })

  if (suffixMatches.length === 1 && suffixMatches[0] != null) {
    return ok(suffixMatches[0])
  }

  if (suffixMatches.length > 1) {
    const matchedIds = suffixMatches.map(
      (t) => t.document.id ?? t.document.frontmatter.id ?? t.filename,
    )
    return err({
      kind: "AMBIGUOUS_TASK_ID",
      message: `Ambiguous short task ID '${trimmed}': matches multiple tasks [${matchedIds.join(", ")}]. Please specify full task ID.`,
      id: trimmed,
      matches: matchedIds,
    })
  }

  return err({
    kind: "TASK_NOT_FOUND",
    message: `Task not found in backlog: ${trimmed}`,
    id: trimmed,
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
    const resolveRes = resolveBacklogTaskId(backlogTasks, query)
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


