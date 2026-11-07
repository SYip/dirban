import { err, ok, type Result } from "neverthrow"
import * as path from "node:path"
import { SLUG_CLEANUP_REGEX, SLUG_TRIM_HYPHENS_REGEX } from "./git.ts"
import type {
  VcsContext,
  VcsError,
  VersionControlProvider,
} from "./types.ts"

export class NoopVcsProvider implements VersionControlProvider {
  readonly name = "noop" as const

  getContext(_cwd?: string): VcsContext {
    return { isAvailable: false }
  }

  extractTaskId(_branchName?: string, _cwd?: string): string | null {
    return null
  }

  deriveBranchName(prefix: string, taskId: string, slug: string): string {
    const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`
    const sanitizedSlug = slug
      .toLowerCase()
      .replace(SLUG_CLEANUP_REGEX, "-")
      .replace(SLUG_TRIM_HYPHENS_REGEX, "")

    if (sanitizedSlug === "") {
      return `${normalizedPrefix}${taskId}`
    }
    return `${normalizedPrefix}${taskId}-${sanitizedSlug}`
  }

  deriveWorktreePath(
    repoRoot: string,
    template: string,
    taskId: string,
    slug: string,
  ): string {
    const repoName = path.basename(repoRoot)
    const expandedDir = template.replace(/\{repo\}/g, repoName)
    const sanitizedSlug = slug
      .toLowerCase()
      .replace(SLUG_CLEANUP_REGEX, "-")
      .replace(SLUG_TRIM_HYPHENS_REGEX, "")
    const dirName = sanitizedSlug === "" ? taskId : `${taskId}-${sanitizedSlug}`

    const targetBaseDir = path.isAbsolute(expandedDir)
      ? expandedDir
      : path.resolve(repoRoot, expandedDir)

    return path.join(targetBaseDir, dirName)
  }

  switchOrCreateBranch(
    _branchName: string,
    _cwd?: string,
  ): Result<{ readonly alreadyOnBranch: boolean }, VcsError> {
    return err({
      kind: "VCS_NOT_AVAILABLE",
      message: "Version control not available in this workspace",
    })
  }

  createWorktree(
    _targetPath: string,
    _branchName: string,
    _cwd?: string,
  ): Result<void, VcsError> {
    return err({
      kind: "VCS_NOT_AVAILABLE",
      message: "Version control not available in this workspace",
    })
  }

  autoMergeAndCleanup(_options: {
    readonly taskBranch: string
    readonly baseBranch: string
    readonly isWorktree: boolean
    readonly cwd?: string
  }): Result<{ readonly worktreeRemoved: boolean }, VcsError> {
    return err({
      kind: "VCS_NOT_AVAILABLE",
      message: "Version control not available in this workspace",
    })
  }
}
