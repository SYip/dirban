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
const DEFAULT_WORKTREES_DIR = "../.{repo}.worktrees"
const DEFAULT_BASE_BRANCH = "main"

export class GitWorktreeStrategy implements WorkspaceLifecycleStrategy {
  readonly name = "worktree" as const

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

    const existingWorktreeResult = ctx.vcs.resolveWorktreePath(effectiveId, ctx.cwd)
    if (existingWorktreeResult.isOk()) {
      return err({
        kind: "ALREADY_STARTED",
        message: `Task is already started: active worktree found at ${existingWorktreeResult.value}`,
      })
    }

    if (ctx.vcsCtx.repoRoot == null) {
      return err({
        kind: "GIT_CONFLICT",
        message: "Git repository root not found for worktree creation",
      })
    }

    const worktreesDirTemplate = ctx.config.worktreesDir ?? DEFAULT_WORKTREES_DIR
    const worktreePath = ctx.vcs.deriveWorktreePath(
      ctx.vcsCtx.repoRoot,
      worktreesDirTemplate,
      effectiveId,
      slug,
    )

    const worktreeResult = ctx.vcs.createWorktree(worktreePath, branchName, ctx.cwd)
    if (worktreeResult.isErr()) {
      return err({
        kind: "GIT_CONFLICT",
        message: worktreeResult.error.message,
      })
    }

    return ok({
      branchName,
      strategy: this.name,
      worktreePath,
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
    const isTaskBranchOrWorktree =
      detectedId != null &&
      effectiveId !== "" &&
      (detectedId === effectiveId || effectiveId.endsWith(detectedId))

    if (!isTaskBranchOrWorktree || ctx.vcsCtx.currentBranch == null) {
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

    const shouldSkipMerge =
      options?.noMerge !== undefined
        ? options.noMerge === true
        : ctx.config.autoMerge === false

    if (shouldSkipMerge) {
      return ok({
        mergedBranch: undefined,
        baseBranch,
        worktreeRemoved: false,
        gitSkipped: true,
        message: `Worktree for ${taskBranch} retained without merging (--no-merge).`,
      })
    }

    const commitMessage = `docs: complete task ${effectiveId} and move to done`

    const mergeResult = ctx.vcs.autoMergeAndCleanup({
      taskBranch,
      baseBranch,
      isWorktree: ctx.vcsCtx.isWorktree ?? false,
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
      worktreeRemoved: mergeResult.value.worktreeRemoved,
      gitSkipped: false,
    })
  }
}
