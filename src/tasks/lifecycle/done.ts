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
import type { DirbanConfig } from "../../config/types.ts"
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
  readonly workspaceStrategy?: WorkspaceLifecycleStrategy
}

/**
 * Counts how many acceptance criteria items remain unchecked ([ ]).
 */
export const countUncheckedCriteria = (task: BoardTask): number => {
  return task.document.acceptanceCriteria.filter((item) => !item.checked).length
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

  // 1. Resolve task
  let taskToDone: BoardTask
  if (taskId != null && taskId.trim() !== "") {
    const trimmedId = taskId.trim()
    const found = findTaskByIdOrName(board, trimmedId) ?? findTaskExact(board, trimmedId)
    if (found == null) {
      return err({
        kind: "TASK_NOT_FOUND",
        id: trimmedId,
        message: `Task not found: ${trimmedId}`,
      })
    }
    taskToDone = found

    // Strict workflow guard: when board has columns and a focus column,
    // explicit task must be in the focus column to be marked done.
    if (focusColName != null && taskToDone.column !== focusColName) {
      const displayId = taskToDone.document.id ?? taskToDone.filename
      const isCompleted =
        taskToDone.column === ARCHIVE_COLUMN
        || taskToDone.column === "archive"
        || taskToDone.column === DEFAULT_COLUMNS[DEFAULT_COLUMNS.length - 1]

      if (isCompleted) {
        return err({
          kind: "ALREADY_COMPLETED",
          message: `Task ${displayId} is already completed in '${taskToDone.column}'.`,
        })
      }

      if (taskToDone.column === BACKLOG_COLUMN || taskToDone.column === "backlog") {
        return err({
          kind: "INVALID_COLUMN_TRANSITION",
          message: `Cannot mark task ${displayId} as done: task is in '${taskToDone.column}'. Run 'dirban ready ${displayId}' first.`,
          currentColumn: taskToDone.column,
          expectedColumn: focusColName,
          id: trimmedId,
          suggestion: `dirban ready ${displayId}`,
        })
      }

      const preFocusCol = resolvePreviousColumn(config, focusColName) ?? DEFAULT_COLUMNS[0]
      if (taskToDone.column === preFocusCol) {
        return err({
          kind: "INVALID_COLUMN_TRANSITION",
          message: `Cannot mark task ${displayId} as done: task is in '${taskToDone.column}'. Run 'dirban start ${displayId}' first.`,
          currentColumn: taskToDone.column,
          expectedColumn: focusColName,
          id: trimmedId,
          suggestion: `dirban start ${displayId}`,
        })
      }

      return err({
        kind: "INVALID_COLUMN_TRANSITION",
        message: `Cannot mark task ${displayId} as done: task is in '${taskToDone.column}' (expected '${focusColName}').`,
        currentColumn: taskToDone.column,
        expectedColumn: focusColName,
        id: trimmedId,
      })
    }
  } else {
    const currentResult = resolveCurrentTask(board, config, undefined, cwd, vcs)
    if (currentResult.isErr()) {
      return err({
        kind: "NO_ACTIVE_TASK",
        message: currentResult.error.message,
      })
    }
    taskToDone = currentResult.value.task
  }

  // 2. Count unchecked acceptance criteria
  const uncheckedCount = countUncheckedCriteria(taskToDone)

  // 3. Transition completed task file:
  // If no columns are configured, transition directly to flat archive
  let updatedTask: BoardTask = taskToDone

  if (focusColName == null) {
    const archiveResult = archiveTasks(
      board,
      config,
      taskToDone.document.id ?? taskToDone.filename,
      cwd,
    )
    if (archiveResult.isErr()) {
      return err({
        kind: "MOVE_ERROR",
        message: archiveResult.error.message,
      })
    }
    const archivedTask = archiveResult.value.archivedTasks[0]
    if (archivedTask != null) {
      updatedTask = archivedTask
    }
  } else {
    // Transition to relative next column (focus + 1, e.g. 03-done or test)
    const targetColName = resolveNextColumn(config, focusColName)
    if (taskToDone.column !== targetColName) {
      const moveResult = moveTask(
        board,
        taskToDone.document.id ?? taskToDone.filename,
        targetColName,
      )
      if (moveResult.isErr()) {
        return err({
          kind: "MOVE_ERROR",
          message: moveResult.error.message,
        })
      }
      updatedTask = moveResult.value
    }
  }

  // 4. VCS branch & worktree auto-merge delegated to lifecycle strategy (with automatic runtime detection)
  const vcsCtx = vcs.getContext(cwd)
  const strategy =
    options?.workspaceStrategy
    ?? detectWorkspaceDoneStrategy(updatedTask, options, vcsCtx, vcs, config, cwd)
  const workspaceCtx = { vcs, vcsCtx, config, cwd }

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
