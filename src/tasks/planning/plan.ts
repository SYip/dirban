import { err, ok, type Result } from "neverthrow"
import type { Board, BoardTask } from "../../board/types.ts"
import { evaluateTaskBlockers, type TaskBlockerEvaluation } from "../../board/dependencies.ts"
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
  const promoted: PromoteTaskResult[] = []
  const failed: { taskId: string; error: OperationError }[] = []

  let currentBoard = board
  for (const taskId of taskIdsOrPaths) {
    const trimmed = taskId.trim()
    if (trimmed === "") continue

    const res = promoteTask(currentBoard, config, trimmed, targetColumnOverride)
    if (res.isOk()) {
      promoted.push(res.value)
      // Update local board state so subsequent promotions and dependency evaluations reflect the move
      const updatedBacklogTasks = currentBoard.columns
        .find((c) => c.name.toLowerCase() === BACKLOG_COLUMN)
        ?.tasks.filter((t) => (t.document.id ?? t.filename) !== (res.value.task.document.id ?? res.value.task.filename)) ?? []

      const targetColName = res.value.targetColumn
      const updatedColumns = currentBoard.columns.map((c) => {
        if (c.name.toLowerCase() === BACKLOG_COLUMN) {
          return { ...c, tasks: updatedBacklogTasks }
        }
        if (c.name.toLowerCase() === targetColName.toLowerCase()) {
          return { ...c, tasks: [...c.tasks, res.value.task] }
        }
        return c
      })
      currentBoard = { ...currentBoard, columns: updatedColumns }
    } else {
      failed.push({ taskId: trimmed, error: res.error })
    }
  }

  return {
    promoted,
    failed,
  }
}

import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { formatPlanView } from "../../cli/formatters.ts"
import { startInteractivePlanTui } from "../../cli/plan-tui.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/commands/types.ts"

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

export const handlePlan: CommandHandler = async (ctx) => {
  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const board = boardRes.value

  // 1. Scriptable promotion:
  // - Positional syntax: dirban plan promote <id1> <id2> ... [--to=<col>]
  // - Flag syntax: dirban plan --promote=<id1>,<id2> | --promote=all [--to=<col>]
  const isPositionalPromote = ctx.positionals[1] === "promote"
  const positionalIds = isPositionalPromote ? ctx.positionals.slice(2) : []

  let idsToPromote: string[] = []

  if (positionalIds.length > 0) {
    idsToPromote = positionalIds
  } else if (ctx.flags.promote != null && ctx.flags.promote.trim() !== "") {
    const rawVal = ctx.flags.promote.trim()
    if (rawVal === "all" || rawVal === "ready") {
      const plan = partitionBacklog(board)
      idsToPromote = plan.ready.map((item) => item.task.document.id ?? item.task.filename)
      if (idsToPromote.length === 0) {
        console.log(pc.yellow("No unblocked tasks ready to promote in backlog."))
        return 0
      }
    } else {
      idsToPromote = rawVal
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    }
  }

  if (idsToPromote.length > 0) {
    const result = promoteTasks(board, ctx.config, idsToPromote, ctx.flags.to)

    for (const item of result.promoted) {
      console.log(
        pc.green(
          `✔ Successfully promoted task ${item.task.document.id} to ${item.targetColumn}`,
        ),
      )
    }

    for (const fail of result.failed) {
      console.error(pc.red(`✖ Failed to promote ${fail.taskId}: ${fail.error.message}`))
    }

    if (result.failed.length > 0 && result.promoted.length === 0) {
      return 1
    }
    return 0
  }

  const plan = partitionBacklog(board)

  // 2. Scriptable flag: dirban plan --ready (lists only unblocked tasks)
  if (ctx.flags.ready) {
    for (const item of plan.ready) {
      console.log(`${item.task.document.id}\t${item.task.document.title}`)
    }
    return 0
  }

  // 3. Scriptable flag: dirban plan --blocked (lists only blocked tasks and blockers)
  if (ctx.flags.blocked) {
    for (const item of plan.blocked) {
      const blockers = item.evaluation.unresolved.join(";")
      console.log(`${item.task.document.id}\t${item.task.document.title}\t${blockers}`)
    }
    return 0
  }

  // 4. Interactive mode: dirban plan --interactive / -i
  if (ctx.flags.interactive) {
    await startInteractivePlanTui(ctx.config)
    return 0
  }

  // 5. Default: Output formatted terminal list
  console.log(formatPlanView(plan))
  return 0
}

export const planCommand: CommandDefinition = {
  name: "plan",
  summary: "View backlog triage and planning (options: --ready, --blocked, --promote=<ids|all>, -i)",
  usage: "dirban plan [options]\n       dirban plan promote <id...> [--to=<column>]",
  options: [
    { flag: "--ready", description: "List only unblocked backlog tasks ready to be scheduled" },
    { flag: "--blocked", description: "List only currently blocked backlog tasks and blocking sources" },
    { flag: "--promote=<ids|all>", description: "Promote unblocked backlog tasks (single ID, comma-separated, or 'all')" },
    { flag: "--to=<column>", description: "Target column for promotion (defaults to first active column)" },
    { flag: "-i, --interactive", description: "Launch interactive terminal planner to triage, multi-select, and promote tasks" },
  ],
  examples: [
    "dirban plan",
    "dirban plan --ready",
    "dirban plan --promote=all",
    "dirban plan promote 26-001 26-002",
    "dirban plan -i",
  ],
  requiresTasksDir: true,
  execute: handlePlan,
}

