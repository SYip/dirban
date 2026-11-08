import { ok, err, type Result } from "neverthrow"
import type { Board, BoardTask } from "../board/types.ts"
import { findTaskExact } from "../board/discovery.ts"
import type { BranchStrategy, DirbanConfig } from "../config/types.ts"
import { moveTask } from "./move.ts"
import { getVcsProvider, type VersionControlProvider } from "../vcs/index.ts"

export interface StartTaskSuccess {
  readonly task: BoardTask
  readonly branchName: string
  readonly strategy: BranchStrategy
  readonly worktreePath?: string
  readonly gitSkipped: boolean
  readonly gitMessage?: string
}

export type StartTaskError =
  | { readonly kind: "TASK_NOT_FOUND"; readonly id: string; readonly message: string }
  | { readonly kind: "ALREADY_STARTED"; readonly message: string }
  | { readonly kind: "GIT_CONFLICT"; readonly message: string }
  | { readonly kind: "MOVE_ERROR"; readonly message: string }

const extractSlugFromTask = (task: BoardTask): string => {
  const stem = task.filename.replace(/\.md$/, "")
  const id = task.document.id ?? task.document.frontmatter.id ?? ""
  if (id !== "" && stem.startsWith(id)) {
    return stem.slice(id.length).replace(/^-+/, "")
  }
  const title = task.document.title ?? ""
  if (title !== "") {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }
  return stem
}

const checkAlreadyStarted = (
  vcs: VersionControlProvider,
  vcsCtx: ReturnType<VersionControlProvider["getContext"]>,
  branchName: string,
  strategy: BranchStrategy,
  taskId: string,
  cwd: string,
): Result<void, StartTaskError> => {
  if (!vcsCtx.isAvailable || vcsCtx.repoRoot == null) {
    return ok(undefined)
  }

  if (vcsCtx.currentBranch === branchName) {
    return err({
      kind: "ALREADY_STARTED",
      message: `Task is already started: currently active on branch ${branchName}`,
    })
  }

  if (strategy === "worktree") {
    const existingWorktreeResult = vcs.resolveWorktreePath(taskId, cwd)
    if (existingWorktreeResult.isOk()) {
      return err({
        kind: "ALREADY_STARTED",
        message: `Task is already started: active worktree found at ${existingWorktreeResult.value}`,
      })
    }
  }

  return ok(undefined)
}

export const startTask = (
  board: Board,
  config: DirbanConfig,
  taskId: string,
  options?: {
    readonly strategy?: BranchStrategy
    readonly cwd?: string
    readonly vcsProvider?: VersionControlProvider
  },
): Result<StartTaskSuccess, StartTaskError> => {
  const cwd = options?.cwd ?? process.cwd()
  const vcs = options?.vcsProvider ?? getVcsProvider(cwd)
  const task = findTaskExact(board, taskId)
  if (task == null) {
    return err({
      kind: "TASK_NOT_FOUND",
      id: taskId,
      message: `Task not found: ${taskId}`,
    })
  }

  const effectiveId = task.document.id ?? task.document.frontmatter.id ?? taskId
  const slug = extractSlugFromTask(task)
  const branchPrefix = config.branchPrefix ?? "task/"
  const branchName = vcs.deriveBranchName(branchPrefix, effectiveId, slug)
  const strategy = options?.strategy ?? config.branchStrategy ?? "checkout"

  // 1. VCS guard: prevent start if already on branch or worktree is already created
  const vcsCtx = vcs.getContext(cwd)
  const guardRes = checkAlreadyStarted(vcs, vcsCtx, branchName, strategy, effectiveId, cwd)
  if (guardRes.isErr()) {
    return err(guardRes.error)
  }

  // 2. Move task to doing column on filesystem
  const doingColName = config.columns.find((c) =>
    c.toLowerCase() === "02-doing" || c.toLowerCase().includes("doing")
  ) ?? "02-doing"

  let updatedTask: BoardTask = task
  if (task.column !== doingColName) {
    const moveResult = moveTask(board, taskId, doingColName)
    if (moveResult.isErr()) {
      return err({
        kind: "MOVE_ERROR",
        message: moveResult.error.message,
      })
    }
    updatedTask = moveResult.value
  }

  // 3. VCS checkout or worktree creation
  if (!vcsCtx.isAvailable || vcsCtx.repoRoot == null) {
    return ok({
      task: updatedTask,
      branchName,
      strategy,
      gitSkipped: true,
      gitMessage: "Git repository not detected; moved card to doing on filesystem only.",
    })
  }

  if (strategy === "checkout") {
    const checkoutResult = vcs.switchOrCreateBranch(branchName, cwd)
    if (checkoutResult.isErr()) {
      return err({
        kind: "GIT_CONFLICT",
        message: checkoutResult.error.message,
      })
    }

    if (checkoutResult.value.alreadyOnBranch) {
      return err({
        kind: "ALREADY_STARTED",
        message: `Task is already started: already on branch ${branchName}.`,
      })
    }

    return ok({
      task: updatedTask,
      branchName,
      strategy,
      gitSkipped: false,
    })
  }

  // Worktree strategy
  const worktreesDirTemplate = config.worktreesDir ?? "../.{repo}.worktrees"
  const worktreePath = vcs.deriveWorktreePath(
    vcsCtx.repoRoot,
    worktreesDirTemplate,
    effectiveId,
    slug,
  )

  const worktreeResult = vcs.createWorktree(worktreePath, branchName, cwd)
  if (worktreeResult.isErr()) {
    return err({
      kind: "GIT_CONFLICT",
      message: worktreeResult.error.message,
    })
  }

  return ok({
    task: updatedTask,
    branchName,
    strategy,
    worktreePath,
    gitSkipped: false,
  })
}
