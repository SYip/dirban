import type { Result } from "neverthrow"

export type VcsError =
  | { readonly kind: "VCS_NOT_AVAILABLE"; readonly message: string }
  | { readonly kind: "BRANCH_CONFLICT"; readonly message: string }
  | { readonly kind: "WORKTREE_ERROR"; readonly message: string }
  | { readonly kind: "MERGE_ERROR"; readonly message: string }
  | { readonly kind: "COMMAND_ERROR"; readonly message: string }
  | {
      readonly kind: "DIRTY_WORKING_TREE"
      readonly message: string
      readonly dirtyFiles: readonly string[]
    }

export interface WorktreeEntry {
  readonly path: string
  readonly branchRef?: string
  readonly taskId?: string | null
}

export interface VcsContext {
  readonly isAvailable: boolean
  readonly currentBranch?: string
  readonly repoRoot?: string
  readonly isWorktree?: boolean
}

export interface VersionControlProvider {
  readonly name: string
  getContext(cwd?: string): VcsContext
  extractTaskId(branchName?: string, cwd?: string): string | null
  deriveBranchName(prefix: string, taskId: string, slug: string): string
  deriveWorktreePath(repoRoot: string, template: string, taskId: string, slug: string): string
  resolveWorktreePath(taskIdOrTarget?: string, cwd?: string): Result<string, VcsError>
  listWorktrees(cwd?: string): Result<readonly WorktreeEntry[], VcsError>
  removeWorktree(targetPath: string, force?: boolean, cwd?: string): Result<void, VcsError>
  switchOrCreateBranch(
    branchName: string,
    cwd?: string,
  ): Result<{ readonly alreadyOnBranch: boolean }, VcsError>
  createWorktree(targetPath: string, branchName: string, cwd?: string): Result<void, VcsError>
  checkWorkingTreeClean(options?: {
    readonly allowedPathPrefixes?: readonly string[]
    readonly cwd?: string
  }): Result<void, VcsError>
  commitFile(filePath: string, message: string, cwd?: string): Result<void, VcsError>
  autoMergeAndCleanup(options: {
    readonly taskBranch: string
    readonly baseBranch: string
    readonly isWorktree: boolean
    readonly cwd?: string
    readonly commitMessage?: string
  }): Result<{ readonly worktreeRemoved: boolean }, VcsError>
}
