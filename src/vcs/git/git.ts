import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { err, ok, type Result } from "neverthrow"
import type { VcsContext, VcsError, VersionControlProvider, WorktreeEntry } from "../types.ts"
import { commitSingleGitFile } from "./commit.ts"
import { checkGitWorkingTreeClean } from "./status.ts"

export const TASK_ID_EXTRACT_REGEX = /(?:^|\/)(?:task\/)?([0-9]{2}-[0-9]+)(?:-[^/]*)?$/
export const SLUG_CLEANUP_REGEX = /[^a-z0-9]+/g
export const SLUG_TRIM_HYPHENS_REGEX = /^-+|-+$/g
export const WORKTREE_ENTRY_SPLIT_REGEX = /\n\n+/
export const LINE_SPLIT_REGEX = /\r?\n/

export interface GitWorktreeEntry {
  readonly path: string
  readonly branchRef?: string
}

/**
 * Parses raw stdout from `git worktree list --porcelain` into typed entries.
 */
export const parseGitWorktreeListPorcelain = (rawStdout: string): readonly GitWorktreeEntry[] => {
  const blocks = rawStdout.split(WORKTREE_ENTRY_SPLIT_REGEX)
  const entries: GitWorktreeEntry[] = []

  for (const block of blocks) {
    const lines = block.split(LINE_SPLIT_REGEX).filter((l) => l.trim() !== "")
    const worktreeLine = lines.find((l) => l.startsWith("worktree "))
    if (worktreeLine == null) continue

    const branchLine = lines.find((l) => l.startsWith("branch "))
    const entryPath = worktreeLine.slice("worktree ".length).trim()
    const branchRef = branchLine != null ? branchLine.slice("branch ".length).trim() : undefined

    entries.push(Object.freeze({ path: entryPath, branchRef }))
  }

  return Object.freeze(entries)
}

export class GitVcsProvider implements VersionControlProvider {
  readonly name = "git" as const

  getContext(cwd: string = process.cwd()): VcsContext {
    try {
      const isInsideWorktreeResult = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
      const isGitRepo =
        isInsideWorktreeResult.error == null
        && isInsideWorktreeResult.status === 0
        && isInsideWorktreeResult.stdout.trim() === "true"

      if (!isGitRepo) {
        return { isAvailable: false }
      }

      const branchResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
      const branchName = branchResult.status === 0 ? branchResult.stdout.trim() : undefined

      const rootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
      const repoRoot = rootResult.status === 0 ? rootResult.stdout.trim() : undefined

      const gitDirResult = spawnSync("git", ["rev-parse", "--git-dir"], {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
      const gitDir = gitDirResult.status === 0 ? gitDirResult.stdout.trim() : ""
      const isWorktree =
        gitDir.includes("/.git/worktrees/") || gitDir.includes("\\.git\\worktrees\\")

      return {
        isAvailable: true,
        currentBranch: branchName === "HEAD" ? undefined : branchName,
        repoRoot,
        isWorktree,
      }
    } catch {
      return { isAvailable: false }
    }
  }

  extractTaskId(branchName?: string, cwd?: string): string | null {
    if (branchName != null && branchName !== "") {
      const branchMatch = TASK_ID_EXTRACT_REGEX.exec(branchName)
      if (branchMatch != null && branchMatch[1] != null) {
        return branchMatch[1]
      }
    }

    if (cwd != null && cwd !== "") {
      const basename = path.basename(cwd)
      const cwdMatch = TASK_ID_EXTRACT_REGEX.exec(basename)
      if (cwdMatch != null && cwdMatch[1] != null) {
        return cwdMatch[1]
      }
    }

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

  deriveWorktreePath(repoRoot: string, template: string, taskId: string, slug: string): string {
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

  resolveWorktreePath(
    taskIdOrTarget?: string,
    cwd: string = process.cwd(),
  ): Result<string, VcsError> {
    const ctx = this.getContext(cwd)
    if (!ctx.isAvailable || ctx.repoRoot == null) {
      return err({
        kind: "VCS_NOT_AVAILABLE",
        message: "Git repository not detected",
      })
    }

    const trimmedTarget = taskIdOrTarget?.trim().toLowerCase()
    const isTargetingMain =
      trimmedTarget == null
      || trimmedTarget === ""
      || trimmedTarget === "main"
      || trimmedTarget === "root"

    // 1. If asking for "main" or target omitted, return the primary root repository path
    if (isTargetingMain) {
      const commonDirResult = spawnSync(
        "git",
        ["rev-parse", "--path-format=absolute", "--git-common-dir"],
        { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      )
      if (commonDirResult.status === 0 && commonDirResult.stdout.trim() !== "") {
        const commonDir = commonDirResult.stdout.trim()
        const mainRoot = path.resolve(commonDir, "..")
        return ok(mainRoot)
      }
      return ok(ctx.repoRoot)
    }

    // 2. Query git worktree list --porcelain to find matching active worktree
    const worktreeListResult = spawnSync("git", ["worktree", "list", "--porcelain"], {
      cwd: ctx.repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (worktreeListResult.status === 0) {
      const entries = parseGitWorktreeListPorcelain(worktreeListResult.stdout)
      const matchingEntry = entries.find((entry) => {
        const pathMatches = entry.path.toLowerCase().includes(trimmedTarget)
        const branchMatches = entry.branchRef?.toLowerCase().includes(trimmedTarget)
        return pathMatches || branchMatches
      })

      if (matchingEntry != null) {
        return ok(matchingEntry.path)
      }
    }

    return err({
      kind: "WORKTREE_ERROR",
      message: `No active Git worktree found matching "${taskIdOrTarget}"`,
    })
  }

  listWorktrees(cwd: string = process.cwd()): Result<readonly WorktreeEntry[], VcsError> {
    const ctx = this.getContext(cwd)
    if (!ctx.isAvailable || ctx.repoRoot == null) {
      return err({
        kind: "VCS_NOT_AVAILABLE",
        message: "Git repository not detected",
      })
    }

    const worktreeListResult = spawnSync("git", ["worktree", "list", "--porcelain"], {
      cwd: ctx.repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (worktreeListResult.status !== 0) {
      return err({
        kind: "WORKTREE_ERROR",
        message: `Failed to list worktrees: ${worktreeListResult.stderr.trim()}`,
      })
    }

    const rawEntries = parseGitWorktreeListPorcelain(worktreeListResult.stdout)
    const entries: WorktreeEntry[] = rawEntries.map((entry) => ({
      path: entry.path,
      branchRef: entry.branchRef,
      taskId: entry.branchRef != null ? this.extractTaskId(entry.branchRef) : null,
    }))

    return ok(entries)
  }

  removeWorktree(
    targetPath: string,
    force: boolean = false,
    cwd: string = process.cwd(),
  ): Result<void, VcsError> {
    const ctx = this.getContext(cwd)
    if (!ctx.isAvailable || ctx.repoRoot == null) {
      return err({
        kind: "VCS_NOT_AVAILABLE",
        message: "Git repository not detected",
      })
    }

    const args = force
      ? ["worktree", "remove", "--force", targetPath]
      : ["worktree", "remove", targetPath]

    const removeResult = spawnSync("git", args, {
      cwd: ctx.repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (removeResult.status !== 0) {
      return err({
        kind: "WORKTREE_ERROR",
        message: `Failed to remove worktree '${targetPath}': ${removeResult.stderr.trim()}`,
      })
    }

    return ok(undefined)
  }

  switchOrCreateBranch(
    branchName: string,
    cwd: string = process.cwd(),
  ): Result<{ readonly alreadyOnBranch: boolean }, VcsError> {
    const ctx = this.getContext(cwd)
    if (!ctx.isAvailable || ctx.repoRoot == null) {
      return err({
        kind: "VCS_NOT_AVAILABLE",
        message: "Git repository not detected",
      })
    }

    if (ctx.currentBranch === branchName) {
      return ok({ alreadyOnBranch: true })
    }

    const branchCheck = spawnSync("git", ["rev-parse", "--verify", `refs/heads/${branchName}`], {
      cwd: ctx.repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    const branchExists = branchCheck.status === 0

    const checkoutArgs = branchExists ? ["checkout", branchName] : ["checkout", "-b", branchName]

    const checkoutResult = spawnSync("git", checkoutArgs, {
      cwd: ctx.repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (checkoutResult.status !== 0) {
      return err({
        kind: "BRANCH_CONFLICT",
        message: `Failed to checkout branch ${branchName}: ${checkoutResult.stderr.trim()}`,
      })
    }

    return ok({ alreadyOnBranch: false })
  }

  createWorktree(
    targetPath: string,
    branchName: string,
    cwd: string = process.cwd(),
  ): Result<void, VcsError> {
    const ctx = this.getContext(cwd)
    if (!ctx.isAvailable || ctx.repoRoot == null) {
      return err({
        kind: "VCS_NOT_AVAILABLE",
        message: "Git repository not detected",
      })
    }

    if (fs.existsSync(targetPath)) {
      return err({
        kind: "WORKTREE_ERROR",
        message: `Worktree path already exists: ${targetPath}`,
      })
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })

    const branchCheck = spawnSync("git", ["rev-parse", "--verify", `refs/heads/${branchName}`], {
      cwd: ctx.repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    const branchExists = branchCheck.status === 0

    const worktreeArgs = branchExists
      ? ["worktree", "add", targetPath, branchName]
      : ["worktree", "add", "-b", branchName, targetPath]

    const worktreeResult = spawnSync("git", worktreeArgs, {
      cwd: ctx.repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (worktreeResult.status !== 0) {
      return err({
        kind: "WORKTREE_ERROR",
        message: `Failed to create worktree at ${targetPath}: ${worktreeResult.stderr.trim()}`,
      })
    }

    return ok(undefined)
  }

  checkWorkingTreeClean(options?: {
    readonly allowedPathPrefixes?: readonly string[]
    readonly cwd?: string
  }): Result<void, VcsError> {
    const cwd = options?.cwd ?? process.cwd()
    const ctx = this.getContext(cwd)
    return checkGitWorkingTreeClean(ctx, options)
  }

  commitFile(filePath: string, message: string, cwd?: string): Result<void, VcsError> {
    const workingDir = cwd ?? process.cwd()
    const ctx = this.getContext(workingDir)
    return commitSingleGitFile(ctx, filePath, message, workingDir)
  }

  autoMergeAndCleanup(options: {
    readonly taskBranch: string
    readonly baseBranch: string
    readonly isWorktree: boolean
    readonly cwd?: string
    readonly commitMessage?: string
  }): Result<{ readonly worktreeRemoved: boolean }, VcsError> {
    const cwd = options.cwd ?? process.cwd()
    const ctx = this.getContext(cwd)
    if (!ctx.isAvailable || ctx.repoRoot == null) {
      return err({
        kind: "VCS_NOT_AVAILABLE",
        message: "Git repository not detected",
      })
    }

    const repoRoot = ctx.repoRoot
    const commitMsg = options.commitMessage ?? `docs: complete task and move to done`

    // Auto-commit any changes in cwd (the task card move to 03-done) before switching/merging
    const addResult = spawnSync("git", ["add", "-A"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (addResult.status === 0) {
      spawnSync("git", ["commit", "-m", commitMsg], {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
    }

    if (options.isWorktree) {
      const mergeResult = spawnSync(
        "git",
        [
          "merge",
          "--no-ff",
          "-m",
          `Merge branch '${options.taskBranch}' into ${options.baseBranch}`,
          options.taskBranch,
        ],
        { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      )

      if (mergeResult.status !== 0) {
        return err({
          kind: "MERGE_ERROR",
          message: `Failed to merge ${options.taskBranch} into ${options.baseBranch}: ${mergeResult.stderr.trim()}`,
        })
      }

      const removeResult = spawnSync("git", ["worktree", "remove", cwd], {
        cwd: repoRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })

      return ok({ worktreeRemoved: removeResult.status === 0 })
    }

    // Standard in-place branch checkout & merge
    const checkoutBase = spawnSync("git", ["checkout", options.baseBranch], {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (checkoutBase.status !== 0) {
      return err({
        kind: "COMMAND_ERROR",
        message: `Failed to checkout ${options.baseBranch}: ${checkoutBase.stderr.trim()}`,
      })
    }

    const mergeResult = spawnSync(
      "git",
      [
        "merge",
        "--no-ff",
        "-m",
        `Merge branch '${options.taskBranch}' into ${options.baseBranch}`,
        options.taskBranch,
      ],
      { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    )

    if (mergeResult.status !== 0) {
      return err({
        kind: "MERGE_ERROR",
        message: `Failed to merge ${options.taskBranch} into ${options.baseBranch}: ${mergeResult.stderr.trim()}`,
      })
    }

    return ok({ worktreeRemoved: false })
  }
}
