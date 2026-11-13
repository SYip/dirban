import { err, ok, type Result } from "neverthrow"
import type { VersionControlProvider } from "../../vcs/index.ts"

export type CleanGuardError =
  | {
      readonly kind: "DIRTY_WORKING_TREE"
      readonly message: string
      readonly dirtyFiles: readonly string[]
    }
  | { readonly kind: "GIT_CONFLICT"; readonly message: string }

export interface AssertCleanOptions {
  readonly vcs: VersionControlProvider
  readonly vcsCtx: { readonly isAvailable: boolean }
  readonly tasksDir: string
  readonly cwd: string
  readonly strategyName: string
  readonly noGit?: boolean
  readonly force?: boolean
}

/**
 * Determines whether Version Control operations should be skipped based on
 * availability, user override (--no-git), or strategy type (none / directory-only).
 */
export const isVcsOperationSkipped = (
  vcsCtx: { readonly isAvailable: boolean },
  strategyName: string,
  noGit?: boolean,
): boolean =>
  !vcsCtx.isAvailable
  || noGit === true
  || strategyName === "none"
  || strategyName === "directory-only"

/**
 * Validates that the working tree or target branch has no uncommitted non-task files
 * before performing a Git lifecycle transition (start, block, resume).
 */
export const assertWorkingTreeClean = (
  options: AssertCleanOptions,
): Result<void, CleanGuardError> => {
  const { vcs, vcsCtx, tasksDir, cwd, strategyName, noGit } = options

  if (isVcsOperationSkipped(vcsCtx, strategyName, noGit)) {
    return ok(undefined)
  }

  const cleanCheck = vcs.checkWorkingTreeClean({
    allowedPathPrefixes: [tasksDir],
    cwd,
  })

  if (cleanCheck.isOk()) {
    return ok(undefined)
  }

  if (cleanCheck.error.kind === "DIRTY_WORKING_TREE") {
    return err({
      kind: "DIRTY_WORKING_TREE",
      message: cleanCheck.error.message,
      dirtyFiles: cleanCheck.error.dirtyFiles,
    })
  }

  return err({
    kind: "GIT_CONFLICT",
    message: cleanCheck.error.message,
  })
}
