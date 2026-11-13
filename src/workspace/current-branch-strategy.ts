import { ok, type Result } from "neverthrow"
import type { BoardTask } from "../board/types.ts"
import type {
  WorkspaceDoneError,
  WorkspaceDoneOptions,
  WorkspaceDoneResult,
  WorkspaceLifecycleContext,
  WorkspaceLifecycleStrategy,
  WorkspaceStartError,
  WorkspaceStartOptions,
  WorkspaceStartResult,
} from "./types.ts"

export class CurrentBranchStrategy implements WorkspaceLifecycleStrategy {
  readonly name = "none" as const

  onStart(
    _task: BoardTask,
    ctx: WorkspaceLifecycleContext,
    _options?: WorkspaceStartOptions,
  ): Result<WorkspaceStartResult, WorkspaceStartError> {
    const activeBranch = ctx.vcsCtx.currentBranch ?? "HEAD"

    return ok({
      branchName: activeBranch,
      strategy: this.name,
      gitSkipped: true,
      gitMessage: `Staying on current branch ${activeBranch} (strategy: none).`,
    })
  }

  onDone(
    _task: BoardTask,
    ctx: WorkspaceLifecycleContext,
    _options?: WorkspaceDoneOptions,
  ): Result<WorkspaceDoneResult, WorkspaceDoneError> {
    const activeBranch = ctx.vcsCtx.currentBranch ?? "HEAD"

    return ok({
      mergedBranch: undefined,
      baseBranch: undefined,
      worktreeRemoved: false,
      gitSkipped: true,
      message: `Card completion recorded on branch ${activeBranch} (branch strategy: none).`,
    })
  }
}
