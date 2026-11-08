import type { BoardTask } from "../board/types.ts"
import type { DirbanConfig } from "../config/types.ts"
import type { VersionControlProvider, VcsContext } from "../vcs/types.ts"
import { CurrentBranchStrategy } from "./current-branch-strategy.ts"
import { DirectoryOnlyStrategy } from "./directory-only-strategy.ts"
import { GitBranchStrategy } from "./git-branch-strategy.ts"
import { GitWorktreeStrategy } from "./git-worktree-strategy.ts"
import { getEffectiveTaskId } from "./slug.ts"
import type { LifecycleStrategyType, WorkspaceLifecycleStrategy } from "./types.ts"

export interface ResolveWorkspaceStrategyOptions {
  readonly strategy?: LifecycleStrategyType
  readonly noGit?: boolean
}

export const resolveWorkspaceStrategy = (
  options: ResolveWorkspaceStrategyOptions | undefined,
  vcsCtx: VcsContext,
  config: DirbanConfig,
): WorkspaceLifecycleStrategy => {
  const isNoGitRequested =
    options?.noGit ||
    options?.strategy === "directory-only"

  if (isNoGitRequested) {
    return new DirectoryOnlyStrategy()
  }

  const requestedStrategy = options?.strategy ?? config.branchStrategy ?? "checkout"

  if (requestedStrategy === "none") {
    return new CurrentBranchStrategy()
  }

  if (!vcsCtx.isAvailable || vcsCtx.repoRoot == null) {
    return new DirectoryOnlyStrategy()
  }

  if (requestedStrategy === "worktree") {
    return new GitWorktreeStrategy()
  }

  return new GitBranchStrategy()
}

/**
 * Automatically detects the lifecycle strategy for a task during `done`.
 * If the user explicitly provided options (e.g. --strategy or --no-git), honors that override.
 * Otherwise, inspects runtime environment:
 * 1. Inside a git worktree (`vcsCtx.isWorktree === true`) or task has an active worktree -> GitWorktreeStrategy
 * 2. On a matching task branch in git -> GitBranchStrategy
 * 3. Strategy set to "none" -> CurrentBranchStrategy
 * 4. Otherwise -> DirectoryOnlyStrategy or fallback to config
 */
export const detectWorkspaceDoneStrategy = (
  task: BoardTask,
  options: ResolveWorkspaceStrategyOptions | undefined,
  vcsCtx: VcsContext,
  vcs: VersionControlProvider,
  config: DirbanConfig,
  cwd: string,
): WorkspaceLifecycleStrategy => {
  const isNoGitRequested =
    options?.noGit ||
    options?.strategy === "directory-only"

  if (isNoGitRequested) {
    return new DirectoryOnlyStrategy()
  }

  // Explicit strategy override takes precedence if user supplied it
  if (options?.strategy === "none") {
    return new CurrentBranchStrategy()
  }

  // If config specifies branchStrategy: "none", honor it
  if (config.branchStrategy === "none") {
    return new CurrentBranchStrategy()
  }

  if (!vcsCtx.isAvailable || vcsCtx.repoRoot == null) {
    return new DirectoryOnlyStrategy()
  }

  if (options?.strategy === "worktree") {
    return new GitWorktreeStrategy()
  }
  if (options?.strategy === "checkout") {
    return new GitBranchStrategy()
  }

  // Automatic runtime detection:
  // 1. Is the current working directory an active worktree?
  if (vcsCtx.isWorktree) {
    return new GitWorktreeStrategy()
  }

  // 2. Does an active worktree exist for this task?
  const effectiveId = getEffectiveTaskId(task)
  if (effectiveId !== "") {
    const worktreeResult = vcs.resolveWorktreePath(effectiveId, cwd)
    if (worktreeResult.isOk()) {
      return new GitWorktreeStrategy()
    }
  }

  // 3. Is current branch a task branch matching this task?
  const detectedBranchId = vcs.extractTaskId(vcsCtx.currentBranch, cwd)
  const isTaskBranch =
    detectedBranchId != null &&
    effectiveId !== "" &&
    (detectedBranchId === effectiveId || effectiveId.endsWith(detectedBranchId))

  if (isTaskBranch) {
    return new GitBranchStrategy()
  }

  // Fallback to configured branchStrategy or GitBranchStrategy
  if (config.branchStrategy === "worktree") {
    return new GitWorktreeStrategy()
  }

  return new GitBranchStrategy()
}
