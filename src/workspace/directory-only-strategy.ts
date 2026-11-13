import { ok, type Result } from "neverthrow"
import type { BoardTask } from "../board/types.ts"
import { extractSlugFromTask, getEffectiveTaskId } from "./slug.ts"
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

const DEFAULT_BRANCH_PREFIX = "task/"

export class DirectoryOnlyStrategy implements WorkspaceLifecycleStrategy {
  readonly name = "directory-only" as const

  onStart(
    task: BoardTask,
    ctx: WorkspaceLifecycleContext,
    _options?: WorkspaceStartOptions,
  ): Result<WorkspaceStartResult, WorkspaceStartError> {
    const effectiveId = getEffectiveTaskId(task)
    const slug = extractSlugFromTask(task)
    const branchPrefix = ctx.config.branchPrefix ?? DEFAULT_BRANCH_PREFIX
    const branchName = ctx.vcs.deriveBranchName(branchPrefix, effectiveId, slug)

    return ok({
      branchName,
      strategy: this.name,
      gitSkipped: true,
      gitMessage: "Git repository not detected; moved card to doing on filesystem only.",
    })
  }

  onDone(
    _task: BoardTask,
    _ctx: WorkspaceLifecycleContext,
    _options?: WorkspaceDoneOptions,
  ): Result<WorkspaceDoneResult, WorkspaceDoneError> {
    return ok({
      gitSkipped: true,
      message: "Git repository not detected; moved card to done on filesystem only.",
    })
  }
}
