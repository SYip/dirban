import { err, ok, type Result } from "neverthrow"
import type { BoardTask } from "../board/types.ts"
import { extractSlugFromTask, getEffectiveTaskId } from "./slug.ts"
import type {
  WorkspaceDoneOptions,
  WorkspaceDoneResult,
  WorkspaceDoneError,
  WorkspaceLifecycleContext,
  WorkspaceLifecycleStrategy,
  WorkspaceStartOptions,
  WorkspaceStartResult,
  WorkspaceStartError,
} from "./types.ts"

const DEFAULT_BRANCH_PREFIX = "task/"
const DEFAULT_BASE_BRANCH = "main"

export class GitBranchStrategy implements WorkspaceLifecycleStrategy {
  readonly name = "checkout" as const

  onStart(
    task: BoardTask,
    ctx: WorkspaceLifecycleContext,
    _options?: WorkspaceStartOptions,
  ): Result<WorkspaceStartResult, WorkspaceStartError> {
    const effectiveId = getEffectiveTaskId(task)
    const slug = extractSlugFromTask(task)
    const branchPrefix = ctx.config.branchPrefix ?? DEFAULT_BRANCH_PREFIX
    const branchName = ctx.vcs.deriveBranchName(branchPrefix, effectiveId, slug)

    if (ctx.vcsCtx.currentBranch === branchName) {
      return err({
        kind: "ALREADY_STARTED",
        message: `Task is already started: currently active on branch ${branchName}`,
      })
    }

    const checkoutResult = ctx.vcs.switchOrCreateBranch(branchName, ctx.cwd)
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
      branchName,
      strategy: this.name,
      gitSkipped: false,
    })
  }

  onDone(
    task: BoardTask,
    ctx: WorkspaceLifecycleContext,
    options?: WorkspaceDoneOptions,
  ): Result<WorkspaceDoneResult, WorkspaceDoneError> {
    const effectiveId = getEffectiveTaskId(task)
    const detectedId = ctx.vcs.extractTaskId(ctx.vcsCtx.currentBranch, ctx.cwd)
    const isTaskBranch =
      detectedId != null &&
      effectiveId !== "" &&
      (detectedId === effectiveId || effectiveId.endsWith(detectedId))

    if (!isTaskBranch || ctx.vcsCtx.currentBranch == null) {
      return ok({
        gitSkipped: true,
        message: "Not currently on task branch or worktree; skipped git merge.",
      })
    }

    const baseBranch = options?.baseBranch ?? DEFAULT_BASE_BRANCH
    const taskBranch = ctx.vcsCtx.currentBranch

    if (taskBranch === baseBranch) {
      return ok({
        gitSkipped: true,
        message: `Already on base branch ${baseBranch}; skipped git merge.`,
      })
    }

    const commitMessage = `docs: complete task ${effectiveId} and move to done`

    const mergeResult = ctx.vcs.autoMergeAndCleanup({
      taskBranch,
      baseBranch,
      isWorktree: false,
      cwd: ctx.cwd,
      commitMessage,
    })

    if (mergeResult.isErr()) {
      return err({
        kind: "GIT_ERROR",
        message: mergeResult.error.message,
      })
    }

    return ok({
      mergedBranch: taskBranch,
      baseBranch,
      worktreeRemoved: false,
      gitSkipped: false,
    })
  }
}
