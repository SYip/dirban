import { GitVcsProvider } from "./git/index.ts"
import { NoopVcsProvider } from "./noop.ts"
import type { VersionControlProvider } from "./types.ts"

export * from "./git/index.ts"
export * from "./noop.ts"
export * from "./types.ts"

/**
 * Returns the appropriate VCS provider for the given directory.
 * If Git is available and inside a Git worktree/repository, returns a GitVcsProvider.
 * Otherwise, falls back to NoopVcsProvider.
 */
export const getVcsProvider = (cwd: string = process.cwd()): VersionControlProvider => {
  const gitProvider = new GitVcsProvider()
  const context = gitProvider.getContext(cwd)
  if (context.isAvailable) {
    return gitProvider
  }
  return new NoopVcsProvider()
}
