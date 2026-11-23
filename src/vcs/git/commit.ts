import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import { err, ok, type Result } from "neverthrow"
import type { VcsContext, VcsError } from "../types.ts"

const isTrackedInGit = (filePath: string, cwd: string): boolean => {
  const res = spawnSync("git", ["ls-files", "--error-unmatch", "--", filePath], {
    cwd,
    stdio: "ignore",
  })
  return res.status === 0
}

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

  const stageablePaths = filePaths.filter((p) => fs.existsSync(p) || isTrackedInGit(p, cwd))
  if (stageablePaths.length === 0) {
    return ok(undefined)
  }

  try {
    const addRes = spawnSync("git", ["add", "--", ...stageablePaths], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (addRes.status !== 0) {
      return err({
        kind: "COMMAND_ERROR",
        message: `Failed to stage file(s) '${stageablePaths.join(", ")}': ${addRes.stderr.trim()}`,
      })
    }

    const commitRes = spawnSync("git", ["commit", "-m", message, "--", ...stageablePaths], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (commitRes.status !== 0) {
      return err({
        kind: "COMMAND_ERROR",
        message: `Failed to commit file(s) '${stageablePaths.join(", ")}': ${commitRes.stderr.trim()}`,
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
