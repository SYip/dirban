import { err, ok, type Result } from "neverthrow"
import { findTaskByIdOrName } from "../../board/discovery.ts"
import type { Board, BoardTask } from "../../board/types.ts"
import {
  ARCHIVE_COLUMN,
  BACKLOG_COLUMN,
  DEFAULT_COLUMNS,
  resolveFocusColumn,
  resolvePreviousColumn,
} from "../../config/config.ts"
import type { DirbanConfig } from "../../config/types.ts"
import { getVcsProvider, type VersionControlProvider } from "../../vcs/index.ts"
import {
  type LifecycleStrategyType,
  resolveWorkspaceStrategy,
  type WorkspaceLifecycleStrategy,
  type WorkspaceStartResult,
} from "../../workspace/index.ts"
import { moveTask } from "../mutation/move.ts"

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
  | {
      readonly kind: "DIRTY_WORKING_TREE"
      readonly message: string
      readonly dirtyFiles: readonly string[]
    }

export interface StartTaskOptions {
  readonly strategy?: LifecycleStrategyType
  readonly cwd?: string
  readonly vcsProvider?: VersionControlProvider
  readonly noGit?: boolean
  readonly workspaceStrategy?: WorkspaceLifecycleStrategy
}

import { assertWorkingTreeClean, isVcsOperationSkipped } from "./guard.ts"

const commitStartMoveToTarget = (
  vcs: VersionControlProvider,
  vcsCtx: { readonly isAvailable: boolean },
  filePath: string,
  displayId: string,
  title: string | undefined,
  cwd: string,
  strategyName: string,
  noGit?: boolean,
): Result<void, StartTaskError> => {
  if (isVcsOperationSkipped(vcsCtx, strategyName, noGit)) {
    return ok(undefined)
  }

  const taskTitle = title ?? displayId
  const commitMsg = `chore(task): start ${displayId} ${taskTitle}`.trim()
  const commitRes = vcs.commitFile(filePath, commitMsg, cwd)

  if (commitRes.isErr()) {
    return err({
      kind: "GIT_CONFLICT",
      message: commitRes.error.message,
    })
  }

  return ok(undefined)
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
  const expectedPreFocusCol =
    focusColName != null
      ? (resolvePreviousColumn(config, focusColName) ?? DEFAULT_COLUMNS[0])
      : DEFAULT_COLUMNS[0]

  const displayId = task.document.id ?? task.filename

  // Strict workflow sequence guard: tasks can only be started from the pre-focus queue
  if (focusColName != null && task.column === focusColName) {
    return err({
      kind: "ALREADY_STARTED",
      message: `Task ${displayId} is already in '${focusColName}'.`,
    })
  }

  if (expectedPreFocusCol != null && task.column !== expectedPreFocusCol) {
    if (task.column === BACKLOG_COLUMN || task.column === "backlog") {
      return err({
        kind: "INVALID_COLUMN_TRANSITION",
        message: `Cannot start task ${displayId}: task is in '${task.column}'. Run 'dirban ready ${displayId}' first.`,
        currentColumn: task.column,
        expectedColumn: expectedPreFocusCol,
        id: taskId,
        suggestion: `dirban ready ${displayId}`,
      })
    }

    const isCompleted =
      task.column === ARCHIVE_COLUMN
      || task.column === "archive"
      || task.column === DEFAULT_COLUMNS[DEFAULT_COLUMNS.length - 1]
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

  // 1. Guard against dirty working tree in VCS mode
  const cleanRes = assertWorkingTreeClean({
    vcs,
    vcsCtx,
    tasksDir: config.tasksDir ?? "docs/tasks",
    cwd,
    strategyName: strategy.name,
    noGit: options?.noGit,
  })
  if (cleanRes.isErr()) {
    return err(cleanRes.error)
  }

  // 2. Move task to focus column on filesystem first (before branch / worktree creation)
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

  // 3. For Git strategies, commit the task file move on target branch before spawning worktree/branch
  const commitRes = commitStartMoveToTarget(
    vcs,
    vcsCtx,
    updatedTask.filePath,
    displayId,
    task.document.frontmatter.title ?? task.document.id,
    cwd,
    strategy.name,
    options?.noGit,
  )
  if (commitRes.isErr()) {
    return err(commitRes.error)
  }

  // 4. Delegate workspace / VCS mutations to strategy (spawns worktree or branch from this commit)
  const workspaceCtx = { vcs, vcsCtx, config, cwd }
  const startResult = strategy.onStart(updatedTask, workspaceCtx, options)
  if (startResult.isErr()) {
    return err(startResult.error)
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
