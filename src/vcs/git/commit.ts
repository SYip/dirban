import { spawnSync } from "node:child_process"
import { err, ok, type Result } from "neverthrow"
import type { VcsContext, VcsError } from "../types.ts"

/**
 * Safely stages and commits a single target file, preventing accidental
 * bundling of unrelated working tree modifications into lifecycle commits.
 */
export const commitSingleGitFile = (
  context: VcsContext,
  filePaths: readonly string[],
  message: string,
  cwd: string = process.cwd(),
): Result<void, VcsError> => {
  if (!context.isAvailable || context.repoRoot == null) {
    return ok(undefined)
  }

  if (filePaths.length === 0) {
    return ok(undefined)
  }

  try {
    const addRes = spawnSync("git", ["add", "--", ...filePaths], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (addRes.status !== 0) {
      return err({
        kind: "COMMAND_ERROR",
        message: `Failed to stage file(s) '${filePaths.join(", ")}': ${addRes.stderr.trim()}`,
      })
    }

    const commitRes = spawnSync("git", ["commit", "-m", message, "--", ...filePaths], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (commitRes.status !== 0) {
      return err({
        kind: "COMMAND_ERROR",
        message: `Failed to commit file(s) '${filePaths.join(", ")}': ${commitRes.stderr.trim()}`,
      })
    }

    return ok(undefined)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return err({
      kind: "COMMAND_ERROR",
      message: `Exception committing file: ${msg}`,
    })
  }
}
