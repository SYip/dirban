import type { Result } from "neverthrow"

export type VcsError =
  | { readonly kind: "VCS_NOT_AVAILABLE"; readonly message: string }
  | { readonly kind: "BRANCH_CONFLICT"; readonly message: string }
  | { readonly kind: "WORKTREE_ERROR"; readonly message: string }
  | { readonly kind: "MERGE_ERROR"; readonly message: string }
  | { readonly kind: "COMMAND_ERROR"; readonly message: string }

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
  switchOrCreateBranch(branchName: string, cwd?: string): Result<{ readonly alreadyOnBranch: boolean }, VcsError>
  createWorktree(targetPath: string, branchName: string, cwd?: string): Result<void, VcsError>
  autoMergeAndCleanup(options: {
    readonly taskBranch: string
    readonly baseBranch: string
    readonly isWorktree: boolean
    readonly cwd?: string
  }): Result<{ readonly worktreeRemoved: boolean }, VcsError>
}

