import type { Result } from "neverthrow"
import type { BoardTask } from "../board/types.ts"
import type { DirbanConfig } from "../config/types.ts"
import type { VersionControlProvider, VcsContext } from "../vcs/types.ts"

export type LifecycleStrategyType = "directory-only" | "checkout" | "worktree" | "none"

export interface WorkspaceLifecycleContext {
  readonly vcs: VersionControlProvider
  readonly vcsCtx: VcsContext
  readonly config: DirbanConfig
  readonly cwd: string
}

export interface WorkspaceStartOptions {
  readonly strategy?: LifecycleStrategyType
  readonly baseBranch?: string
}

export interface WorkspaceStartResult {
  readonly branchName: string
  readonly strategy: LifecycleStrategyType
  readonly worktreePath?: string
  readonly gitSkipped: boolean
  readonly gitMessage?: string
}

export type WorkspaceStartError =
  | { readonly kind: "ALREADY_STARTED"; readonly message: string }
  | { readonly kind: "GIT_CONFLICT"; readonly message: string }

export interface WorkspaceDoneOptions {
  readonly baseBranch?: string
  readonly noMerge?: boolean
}

export interface WorkspaceDoneResult {
  readonly mergedBranch?: string
  readonly baseBranch?: string
  readonly worktreeRemoved?: boolean
  readonly gitSkipped: boolean
  readonly message?: string
}

export type WorkspaceDoneError =
  | { readonly kind: "GIT_ERROR"; readonly message: string }

export interface WorkspaceLifecycleStrategy {
  readonly name: LifecycleStrategyType
  onStart(
    task: BoardTask,
    ctx: WorkspaceLifecycleContext,
    options?: WorkspaceStartOptions,
  ): Result<WorkspaceStartResult, WorkspaceStartError>
  onDone(
    task: BoardTask,
    ctx: WorkspaceLifecycleContext,
    options?: WorkspaceDoneOptions,
  ): Result<WorkspaceDoneResult, WorkspaceDoneError>
}
