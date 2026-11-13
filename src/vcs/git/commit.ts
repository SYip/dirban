import { spawnSync } from "node:child_process"
import { err, ok, type Result } from "neverthrow"
import type { VcsContext, VcsError } from "../types.ts"

/**
 * Safely stages and commits a single target file, preventing accidental
 * bundling of unrelated working tree modifications into lifecycle commits.
 */
export const commitSingleGitFile = (
  context: VcsContext,
  filePath: string,
  message: string,
  cwd: string = process.cwd(),
): Result<void, VcsError> => {
  if (!context.isAvailable || context.repoRoot == null) {
    return ok(undefined)
  }

  try {
    const addRes = spawnSync("git", ["add", filePath], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (addRes.status !== 0) {
      return err({
        kind: "COMMAND_ERROR",
        message: `Failed to stage file '${filePath}': ${addRes.stderr.trim()}`,
      })
    }

    const commitRes = spawnSync("git", ["commit", "-m", message, "--", filePath], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (commitRes.status !== 0) {
      return err({
        kind: "COMMAND_ERROR",
        message: `Failed to commit file '${filePath}': ${commitRes.stderr.trim()}`,
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
