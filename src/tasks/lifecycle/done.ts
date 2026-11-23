import { err, ok, type Result } from "neverthrow"
import { findTaskByIdOrName, findTaskExact } from "../../board/discovery.ts"
import type { Board, BoardTask } from "../../board/types.ts"
import {
  ARCHIVE_COLUMN,
  BACKLOG_COLUMN,
  DEFAULT_COLUMNS,
  resolveFocusColumn,
  resolveNextColumn,
  resolvePreviousColumn,
} from "../../config/config.ts"
import type { DirbanConfig, MergeStrategy } from "../../config/types.ts"
import { getVcsProvider, type VersionControlProvider } from "../../vcs/index.ts"
import {
  detectWorkspaceDoneStrategy,
  type LifecycleStrategyType,
  type WorkspaceDoneResult,
  type WorkspaceLifecycleStrategy,
} from "../../workspace/index.ts"
import { archiveTasks } from "../mutation/archive.ts"
import { moveTask } from "../mutation/move.ts"
import { resolveCurrentTask } from "./current.ts"

export interface DoneTaskSuccess {
  readonly task: BoardTask
  readonly uncheckedCount: number
  readonly mergedBranch?: string
  readonly baseBranch?: string
  readonly worktreeRemoved?: boolean
  readonly gitSkipped: boolean
  readonly message?: string
}

export type DoneTaskError =
  | { readonly kind: "NO_ACTIVE_TASK"; readonly message: string }
  | { readonly kind: "TASK_NOT_FOUND"; readonly id: string; readonly message: string }
  | {
      readonly kind: "INVALID_COLUMN_TRANSITION"
      readonly message: string
      readonly currentColumn: string
      readonly expectedColumn: string
      readonly id: string
      readonly suggestion?: string
    }
  | { readonly kind: "ALREADY_COMPLETED"; readonly message: string }
  | { readonly kind: "MOVE_ERROR"; readonly message: string }
  | { readonly kind: "GIT_ERROR"; readonly message: string }

export interface DoneTaskOptions {
  readonly cwd?: string
  readonly baseBranch?: string
  readonly vcsProvider?: VersionControlProvider
  readonly strategy?: LifecycleStrategyType
  readonly noGit?: boolean
  readonly noMerge?: boolean
  readonly mergeStrategy?: MergeStrategy
  readonly workspaceStrategy?: WorkspaceLifecycleStrategy
}

/**
 * Counts how many acceptance criteria items remain unchecked ([ ]).
 */
export const countUncheckedCriteria = (task: BoardTask): number => {
  return task.document.acceptanceCriteria.filter((item) => !item.checked).length
}

const resolveDoneTarget = (
  board: Board,
  config: DirbanConfig,
  taskId: string | undefined,
  focusColName: string | null,
  cwd: string,
  vcs: VersionControlProvider,
): Result<BoardTask, DoneTaskError> => {
  if (taskId == null || taskId.trim() === "") {
    const currentResult = resolveCurrentTask(board, config, undefined, cwd, vcs)
    if (currentResult.isErr()) {
      return err({ kind: "NO_ACTIVE_TASK", message: currentResult.error.message })
    }
    return ok(currentResult.value.task)
  }

  const trimmedId = taskId.trim()
  const found = findTaskByIdOrName(board, trimmedId) ?? findTaskExact(board, trimmedId)
  if (found == null) {
    return err({ kind: "TASK_NOT_FOUND", id: trimmedId, message: `Task not found: ${trimmedId}` })
  }

  if (focusColName == null || found.column === focusColName) {
    return ok(found)
  }

  const displayId = found.document.id ?? found.filename
  const isCompleted =
    found.column === ARCHIVE_COLUMN
    || found.column === "archive"
    || found.column === DEFAULT_COLUMNS[DEFAULT_COLUMNS.length - 1]

  if (isCompleted) {
    return err({
      kind: "ALREADY_COMPLETED",
      message: `Task ${displayId} is already completed in '${found.column}'.`,
    })
  }

  if (found.column === BACKLOG_COLUMN || found.column === "backlog") {
    return err({
      kind: "INVALID_COLUMN_TRANSITION",
      message: `Cannot mark task ${displayId} as done: task is in '${found.column}'. Run 'dirban ready ${displayId}' first.`,
      currentColumn: found.column,
      expectedColumn: focusColName,
      id: trimmedId,
      suggestion: `dirban ready ${displayId}`,
    })
  }

  const preFocusCol = resolvePreviousColumn(config, focusColName) ?? DEFAULT_COLUMNS[0]
  if (found.column === preFocusCol) {
    return err({
      kind: "INVALID_COLUMN_TRANSITION",
      message: `Cannot mark task ${displayId} as done: task is in '${found.column}'. Run 'dirban start ${displayId}' first.`,
      currentColumn: found.column,
      expectedColumn: focusColName,
      id: trimmedId,
      suggestion: `dirban start ${displayId}`,
    })
  }

  return err({
    kind: "INVALID_COLUMN_TRANSITION",
    message: `Cannot mark task ${displayId} as done: task is in '${found.column}' (expected '${focusColName}').`,
    currentColumn: found.column,
    expectedColumn: focusColName,
    id: trimmedId,
  })
}

const transitionCompletedTaskFile = (
  board: Board,
  config: DirbanConfig,
  taskToDone: BoardTask,
  focusColName: string | null,
  cwd: string,
): Result<BoardTask, DoneTaskError> => {
  if (focusColName == null) {
    const archiveResult = archiveTasks(
      board,
      config,
      taskToDone.document.id ?? taskToDone.filename,
      cwd,
    )
    if (archiveResult.isErr()) {
      return err({ kind: "MOVE_ERROR", message: archiveResult.error.message })
    }
    return ok(archiveResult.value.archivedTasks[0] ?? taskToDone)
  }

  const targetColName = resolveNextColumn(config, focusColName)
  if (taskToDone.column === targetColName) {
    return ok(taskToDone)
  }

  const moveResult = moveTask(board, taskToDone.document.id ?? taskToDone.filename, targetColName)
  if (moveResult.isErr()) {
    return err({ kind: "MOVE_ERROR", message: moveResult.error.message })
  }
  return ok(moveResult.value)
}

export const doneTask = (
  board: Board,
  config: DirbanConfig,
  taskId?: string,
  options?: DoneTaskOptions,
): Result<DoneTaskSuccess, DoneTaskError> => {
  const cwd = options?.cwd ?? process.cwd()
  const vcs = options?.vcsProvider ?? getVcsProvider(cwd)
  const focusColName = resolveFocusColumn(config)

  // 1. Resolve & validate target task
  const targetRes = resolveDoneTarget(board, config, taskId, focusColName, cwd, vcs)
  if (targetRes.isErr()) return err(targetRes.error)
  const taskToDone = targetRes.value

  // 2. Count unchecked acceptance criteria
  const uncheckedCount = countUncheckedCriteria(taskToDone)

  // 3. Resolve workspace strategy and validate before moving files on disk
  const vcsCtx = vcs.getContext(cwd)
  const strategy =
    options?.workspaceStrategy
    ?? detectWorkspaceDoneStrategy(taskToDone, options, vcsCtx, vcs, config, cwd)
  const workspaceCtx = { vcs, vcsCtx, config, cwd }

  const validateRes = strategy.validateDone?.(taskToDone, workspaceCtx, options)
  if (validateRes?.isErr()) {
    return err({ kind: "GIT_ERROR", message: validateRes.error.message })
  }

  // 4. Transition completed task file
  const transitionRes = transitionCompletedTaskFile(board, config, taskToDone, focusColName, cwd)
  if (transitionRes.isErr()) return err(transitionRes.error)
  const updatedTask = transitionRes.value

  const doneResult = strategy.onDone(updatedTask, workspaceCtx, options)
  if (doneResult.isErr()) {
    return err(doneResult.error)
  }

  const doneValue: WorkspaceDoneResult = doneResult.value
  return ok({
    task: updatedTask,
    uncheckedCount,
    mergedBranch: doneValue.mergedBranch,
    baseBranch: doneValue.baseBranch,
    worktreeRemoved: doneValue.worktreeRemoved,
    gitSkipped: doneValue.gitSkipped,
    message: doneValue.message,
  })
}
