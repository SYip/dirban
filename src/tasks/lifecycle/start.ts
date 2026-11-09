import { ok, err, type Result } from "neverthrow"
import type { Board, BoardTask } from "../../board/types.ts"
import { findTaskByIdOrName } from "../../board/discovery.ts"
import { resolveFocusColumn, resolvePreviousColumn } from "../../config/config.ts"
import type { DirbanConfig } from "../../config/types.ts"
import { moveTask } from "../mutation/move.ts"
import { getVcsProvider, type VersionControlProvider } from "../../vcs/index.ts"
import {
  resolveWorkspaceStrategy,
  type LifecycleStrategyType,
  type WorkspaceLifecycleStrategy,
  type WorkspaceStartResult,
} from "../../workspace/index.ts"
import type { OperationError } from "../types.ts"

export interface StartTaskSuccess {
  readonly task: BoardTask
  readonly branchName: string
  readonly strategy: LifecycleStrategyType
  readonly worktreePath?: string
  readonly gitSkipped: boolean
  readonly gitMessage?: string
}

export type StartTaskError =
  | { readonly kind: "TASK_NOT_FOUND"; readonly id: string; readonly message: string }
  | { readonly kind: "ALREADY_STARTED"; readonly message: string }
  | {
      readonly kind: "INVALID_COLUMN_TRANSITION"
      readonly message: string
      readonly currentColumn: string
      readonly expectedColumn: string
      readonly id: string
      readonly suggestion?: string
    }
  | { readonly kind: "GIT_CONFLICT"; readonly message: string }
  | { readonly kind: "MOVE_ERROR"; readonly message: string }

export interface StartTaskOptions {
  readonly strategy?: LifecycleStrategyType
  readonly cwd?: string
  readonly vcsProvider?: VersionControlProvider
  readonly noGit?: boolean
  readonly workspaceStrategy?: WorkspaceLifecycleStrategy
}

export const startTask = (
  board: Board,
  config: DirbanConfig,
  taskId: string,
  options?: StartTaskOptions,
): Result<StartTaskSuccess, StartTaskError> => {
  const cwd = options?.cwd ?? process.cwd()
  const vcs = options?.vcsProvider ?? getVcsProvider(cwd)
  const task = findTaskByIdOrName(board, taskId)
  if (task == null) {
    return err({
      kind: "TASK_NOT_FOUND",
      id: taskId,
      message: `Task not found: ${taskId}`,
    })
  }

  const focusColName = resolveFocusColumn(config)
  const expectedPreFocusCol = focusColName != null
    ? resolvePreviousColumn(config, focusColName) ?? config.columns[0]
    : config.columns[0]

  const displayId = task.document.id ?? task.filename

  // Strict workflow sequence guard: tasks can only be started from the pre-focus queue
  if (focusColName != null && task.column === focusColName) {
    return err({
      kind: "ALREADY_STARTED",
      message: `Task ${displayId} is already in '${focusColName}'.`,
    })
  }

  if (expectedPreFocusCol != null && task.column !== expectedPreFocusCol) {
    if (task.column === "backlog") {
      return err({
        kind: "INVALID_COLUMN_TRANSITION",
        message: `Cannot start task ${displayId}: task is in 'backlog'. Run 'dirban plan promote ${displayId}' first.`,
        currentColumn: "backlog",
        expectedColumn: expectedPreFocusCol,
        id: taskId,
        suggestion: `dirban plan promote ${displayId}`,
      })
    }

    const isCompleted = task.column === "archive" || (config.columns.length > 0 && task.column === config.columns[config.columns.length - 1])
    const message = isCompleted
      ? `Cannot start task ${displayId}: task is already completed in '${task.column}'.`
      : `Cannot start task ${displayId}: task is in '${task.column}' (expected '${expectedPreFocusCol}').`

    return err({
      kind: "INVALID_COLUMN_TRANSITION",
      message,
      currentColumn: task.column,
      expectedColumn: expectedPreFocusCol,
      id: taskId,
    })
  }

  const vcsCtx = vcs.getContext(cwd)
  const strategy = options?.workspaceStrategy ?? resolveWorkspaceStrategy(options, vcsCtx, config)

  // 1. Delegate workspace / VCS mutations to strategy (validates guard checks before disk mutation)
  const workspaceCtx = { vcs, vcsCtx, config, cwd }
  const startResult = strategy.onStart(task, workspaceCtx, options)
  if (startResult.isErr()) {
    return err(startResult.error)
  }

  // 2. Move task to focus column on filesystem (if a focus column exists)
  let updatedTask: BoardTask = task

  if (focusColName != null && task.column !== focusColName) {
    const moveResult = moveTask(board, taskId, focusColName)
    if (moveResult.isErr()) {
      return err({
        kind: "MOVE_ERROR",
        message: moveResult.error.message,
      })
    }
    updatedTask = moveResult.value
  }

  const startValue: WorkspaceStartResult = startResult.value
  return ok({
    task: updatedTask,
    branchName: startValue.branchName,
    strategy: startValue.strategy,
    worktreePath: startValue.worktreePath,
    gitSkipped: startValue.gitSkipped,
    gitMessage: startValue.gitMessage,
  })
}
