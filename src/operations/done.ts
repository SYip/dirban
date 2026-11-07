import { ok, err, type Result } from "neverthrow"
import type { Board, BoardTask } from "../board/types.ts"
import { findTaskExact } from "../board/discovery.ts"
import type { DirbanConfig } from "../config/types.ts"
import { moveTask } from "./move.ts"
import { resolveCurrentTask } from "./current.ts"
import { getVcsProvider, type VersionControlProvider } from "../vcs/index.ts"

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
  | { readonly kind: "MOVE_ERROR"; readonly message: string }
  | { readonly kind: "GIT_ERROR"; readonly message: string }

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
  options?: {
    readonly cwd?: string
    readonly baseBranch?: string
    readonly vcsProvider?: VersionControlProvider
  },
): Result<DoneTaskSuccess, DoneTaskError> => {
  const cwd = options?.cwd ?? process.cwd()
  const vcs = options?.vcsProvider ?? getVcsProvider(cwd)

  // 1. Resolve task
  let taskToDone: BoardTask
  if (taskId != null && taskId.trim() !== "") {
    const found = findTaskExact(board, taskId.trim())
    if (found == null) {
      return err({
        kind: "TASK_NOT_FOUND",
        id: taskId.trim(),
        message: `Task not found: ${taskId.trim()}`,
      })
    }
    taskToDone = found
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

  // 3. Move task file to 03-done on the filesystem
  const doneColName = config.columns.find((c) =>
    c.toLowerCase() === "03-done" || c.toLowerCase().includes("done")
  ) ?? "03-done"

  let updatedTask: BoardTask = taskToDone
  if (taskToDone.column !== doneColName) {
    const moveResult = moveTask(
      board,
      taskToDone.document.id ?? taskToDone.filename,
      doneColName,
    )
    if (moveResult.isErr()) {
      return err({
        kind: "MOVE_ERROR",
        message: moveResult.error.message,
      })
    }
    updatedTask = moveResult.value
  }

  // 4. VCS branch & worktree auto-merge
  const vcsCtx = vcs.getContext(cwd)
  if (!vcsCtx.isAvailable || vcsCtx.repoRoot == null) {
    return ok({
      task: updatedTask,
      uncheckedCount,
      gitSkipped: true,
      message: "Git repository not detected; moved card to done on filesystem only.",
    })
  }

  const effectiveId = updatedTask.document.id ?? updatedTask.document.frontmatter.id ?? ""
  const detectedId = vcs.extractTaskId(vcsCtx.currentBranch, cwd)
  const isTaskBranchOrWorktree =
    detectedId != null &&
    effectiveId != null &&
    (detectedId === effectiveId || effectiveId.endsWith(detectedId))

  if (!isTaskBranchOrWorktree || vcsCtx.currentBranch == null) {
    return ok({
      task: updatedTask,
      uncheckedCount,
      gitSkipped: true,
      message: "Not currently on task branch or worktree; skipped git merge.",
    })
  }

  const baseBranch = options?.baseBranch ?? "main"
  const taskBranch = vcsCtx.currentBranch

  if (taskBranch === baseBranch) {
    return ok({
      task: updatedTask,
      uncheckedCount,
      gitSkipped: true,
      message: `Already on base branch ${baseBranch}; skipped git merge.`,
    })
  }

  const mergeResult = vcs.autoMergeAndCleanup({
    taskBranch,
    baseBranch,
    isWorktree: vcsCtx.isWorktree ?? false,
    cwd,
  })

  if (mergeResult.isErr()) {
    return err({
      kind: "GIT_ERROR",
      message: mergeResult.error.message,
    })
  }

  return ok({
    task: updatedTask,
    uncheckedCount,
    mergedBranch: taskBranch,
    baseBranch,
    worktreeRemoved: mergeResult.value.worktreeRemoved,
    gitSkipped: false,
  })
}
