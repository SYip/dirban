import { ok, err, type Result } from "neverthrow"
import type { Board, BoardTask } from "../board/types.ts"
import { findTaskExact } from "../board/discovery.ts"
import { sortTasksByPriority } from "../board/sorter.ts"
import type { DirbanConfig } from "../config/types.ts"
import { getVcsProvider, type VersionControlProvider } from "../vcs/index.ts"

export type CurrentResolutionSource = "explicit" | "git-branch" | "git-worktree" | "doing-column"

export interface CurrentTaskResult {
  readonly task: BoardTask
  readonly source: CurrentResolutionSource
  readonly multipleInDoing: boolean
  readonly doingCount: number
}

export type CurrentTaskError =
  | { readonly kind: "NO_ACTIVE_TASK"; readonly message: string }
  | { readonly kind: "TASK_NOT_FOUND"; readonly id: string; readonly message: string }

export const resolveCurrentTask = (
  board: Board,
  config: DirbanConfig,
  explicitId?: string,
  cwd: string = process.cwd(),
  vcsProvider: VersionControlProvider = getVcsProvider(cwd),
): Result<CurrentTaskResult, CurrentTaskError> => {
  // 1. Explicit Selection: `dirban current <id>` immediately displays the specified task
  if (explicitId != null && explicitId.trim() !== "") {
    const task = findTaskExact(board, explicitId.trim())
    if (task == null) {
      return err({
        kind: "TASK_NOT_FOUND",
        id: explicitId.trim(),
        message: `Task not found: ${explicitId.trim()}`,
      })
    }
    return ok({
      task,
      source: "explicit",
      multipleInDoing: false,
      doingCount: 1,
    })
  }

  // 2. VCS Branch / Worktree Detection
  const vcsCtx = vcsProvider.getContext(cwd)
  if (vcsCtx.isAvailable) {
    const detectedId = vcsProvider.extractTaskId(vcsCtx.currentBranch, cwd)
    if (detectedId != null) {
      const task = findTaskExact(board, detectedId)
      if (task != null) {
        return ok({
          task,
          source: vcsCtx.isWorktree ? "git-worktree" : "git-branch",
          multipleInDoing: false,
          doingCount: 1,
        })
      }
    }
  }

  // 3. Doing Column Resolution
  const doingCol = board.columns.find((col) =>
    col.name.toLowerCase() === "02-doing" ||
    col.name.toLowerCase().endsWith("doing") ||
    col.name.toLowerCase().includes("doing") ||
    col.name.toLowerCase().includes("progress")
  )

  const doingTasks = doingCol?.tasks ?? []

  if (doingTasks.length === 0) {
    return err({
      kind: "NO_ACTIVE_TASK",
      message: "No task currently in progress.",
    })
  }

  if (doingTasks.length === 1 && doingTasks[0] != null) {
    return ok({
      task: doingTasks[0],
      source: "doing-column",
      multipleInDoing: false,
      doingCount: 1,
    })
  }

  // Multiple tasks in 02-doing: Pick highest priority task
  const sorted = sortTasksByPriority(doingTasks, config.priorities)
  const highest = sorted[0]

  if (highest == null) {
    return err({
      kind: "NO_ACTIVE_TASK",
      message: "No task currently in progress.",
    })
  }

  return ok({
    task: highest,
    source: "doing-column",
    multipleInDoing: true,
    doingCount: doingTasks.length,
  })
}
