import { spawnSync } from "node:child_process"
import { err, ok, type Result } from "neverthrow"
import type { VcsContext, VcsError } from "../types.ts"
import { LINE_SPLIT_REGEX } from "./git.ts"

export interface CheckCleanOptions {
  readonly allowedPathPrefixes?: readonly string[]
  readonly cwd?: string
}

/**
 * Checks if the working tree has uncommitted or untracked changes,
 * ignoring any files matching allowedPathPrefixes.
 */
export const checkGitWorkingTreeClean = (
  context: VcsContext,
  options?: CheckCleanOptions,
): Result<void, VcsError> => {
  const cwd = options?.cwd ?? process.cwd()
  if (!context.isAvailable || context.repoRoot == null) {
    return ok(undefined)
  }

  try {
    const statusRes = spawnSync("git", ["status", "--porcelain=v1", "-uall"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (statusRes.status !== 0) {
      return err({
        kind: "COMMAND_ERROR",
        message: `Failed to check git status: ${statusRes.stderr.trim()}`,
      })
    }

    const lines = statusRes.stdout.split(LINE_SPLIT_REGEX).filter((l) => l.trim().length > 0)
    if (lines.length === 0) {
      return ok(undefined)
    }

    const allowed = options?.allowedPathPrefixes ?? []
    const dirtyFiles: string[] = []

    for (const line of lines) {
      const rawPath = line.slice(3).trim()
      const filePath = rawPath.includes(" -> ")
        ? (rawPath.split(" -> ")[1]?.trim() ?? rawPath)
        : rawPath

      const isAllowed = allowed.some((prefix) => filePath.startsWith(prefix))
      if (!isAllowed) {
        dirtyFiles.push(filePath)
      }
    }

    if (dirtyFiles.length > 0) {
      return err({
        kind: "DIRTY_WORKING_TREE",
        message: `Working directory has uncommitted non-task changes (${dirtyFiles.length} file(s) modified/untracked). Stash or commit code changes first.`,
        dirtyFiles: Object.freeze(dirtyFiles),
      })
    }

    return ok(undefined)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return err({
      kind: "COMMAND_ERROR",
      message: `Exception checking working tree status: ${msg}`,
    })
  }
}
