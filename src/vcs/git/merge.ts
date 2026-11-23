import { spawnSync } from "node:child_process"
import { err, ok, type Result } from "neverthrow"
import type { MergeStrategy } from "../../config/types.ts"
import type { VcsError } from "../types.ts"

export interface MergeBranchOptions {
  readonly taskBranch: string
  readonly baseBranch: string
  readonly commitMessage?: string
}

const integrateSquash = (
  repoRoot: string,
  taskBranch: string,
  baseBranch: string,
  commitMessage?: string,
): Result<void, VcsError> => {
  const squashRes = spawnSync("git", ["merge", "--squash", taskBranch], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  })
  if (squashRes.status !== 0) {
    spawnSync("git", ["reset", "--merge"], { cwd: repoRoot, stdio: "ignore" })
    return err({
      kind: "MERGE_ERROR",
      message: `Failed to squash merge ${taskBranch} into ${baseBranch}: ${squashRes.stderr.trim()}`,
    })
  }

  const msg = commitMessage ?? `chore(task): squash ${taskBranch}`
  const commitRes = spawnSync("git", ["commit", "-m", msg], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  })
  if (commitRes.status !== 0) {
    return err({
      kind: "MERGE_ERROR",
      message: `Failed to commit squashed ${taskBranch}: ${commitRes.stderr.trim()}`,
    })
  }

  spawnSync("git", ["branch", "-D", taskBranch], { cwd: repoRoot, stdio: "ignore" })
  return ok(undefined)
}

const integrateRebase = (
  repoRoot: string,
  taskBranch: string,
  baseBranch: string,
): Result<void, VcsError> => {
  const rebaseRes = spawnSync("git", ["rebase", baseBranch, taskBranch], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  })
  if (rebaseRes.status !== 0) {
    spawnSync("git", ["rebase", "--abort"], { cwd: repoRoot, stdio: "ignore" })
    return err({
      kind: "MERGE_ERROR",
      message: `Failed to rebase ${taskBranch} onto ${baseBranch}: ${rebaseRes.stderr.trim()}`,
    })
  }

  const checkoutRes = spawnSync("git", ["checkout", baseBranch], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  })
  if (checkoutRes.status !== 0) {
    return err({
      kind: "COMMAND_ERROR",
      message: `Failed to checkout ${baseBranch}: ${checkoutRes.stderr.trim()}`,
    })
  }

  const ffRes = spawnSync("git", ["merge", "--ff-only", taskBranch], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  })
  if (ffRes.status !== 0) {
    return err({
      kind: "MERGE_ERROR",
      message: `Failed to fast-forward ${baseBranch} to ${taskBranch}: ${ffRes.stderr.trim()}`,
    })
  }

  spawnSync("git", ["branch", "-d", taskBranch], { cwd: repoRoot, stdio: "ignore" })
  return ok(undefined)
}

const integrateMerge = (
  repoRoot: string,
  taskBranch: string,
  baseBranch: string,
): Result<void, VcsError> => {
  const mergeResult = spawnSync(
    "git",
    ["merge", "--no-ff", "-m", `Merge branch '${taskBranch}' into ${baseBranch}`, taskBranch],
    { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  )

  if (mergeResult.status !== 0) {
    spawnSync("git", ["merge", "--abort"], { cwd: repoRoot, stdio: "ignore" })
    return err({
      kind: "MERGE_ERROR",
      message: `Failed to merge ${taskBranch} into ${baseBranch}: ${mergeResult.stderr.trim()}`,
    })
  }

  return ok(undefined)
}

export const integrateBranch = (
  repoRoot: string,
  taskBranch: string,
  baseBranch: string,
  strategy: MergeStrategy,
  commitMessage?: string,
): Result<void, VcsError> => {
  const strategies: Record<MergeStrategy, () => Result<void, VcsError>> = {
    squash: () => integrateSquash(repoRoot, taskBranch, baseBranch, commitMessage),
    rebase: () => integrateRebase(repoRoot, taskBranch, baseBranch),
    merge: () => integrateMerge(repoRoot, taskBranch, baseBranch),
  }
  return strategies[strategy]()
}

export const mergeWorktreeAndCleanup = (
  repoRoot: string,
  cwd: string,
  options: MergeBranchOptions,
  strategy: MergeStrategy,
): Result<{ readonly worktreeRemoved: boolean }, VcsError> => {
  if (strategy === "rebase") {
    const rebaseRes = spawnSync("git", ["rebase", options.baseBranch], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    if (rebaseRes.status !== 0) {
      spawnSync("git", ["rebase", "--abort"], { cwd, stdio: "ignore" })
      return err({
        kind: "MERGE_ERROR",
        message: `Failed to rebase ${options.taskBranch} onto ${options.baseBranch}: ${rebaseRes.stderr.trim()}`,
      })
    }
    const ffRes = spawnSync("git", ["merge", "--ff-only", options.taskBranch], {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    if (ffRes.status !== 0) {
      return err({
        kind: "MERGE_ERROR",
        message: `Failed to fast-forward ${options.baseBranch} to ${options.taskBranch}: ${ffRes.stderr.trim()}`,
      })
    }
  } else {
    const integrateRes = integrateBranch(
      repoRoot,
      options.taskBranch,
      options.baseBranch,
      strategy,
      options.commitMessage,
    )
    if (integrateRes.isErr()) return err(integrateRes.error)
  }

  const removeResult = spawnSync("git", ["worktree", "remove", cwd], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  })

  const branchDeleteFlag = strategy === "squash" ? "-D" : "-d"
  spawnSync("git", ["branch", branchDeleteFlag, options.taskBranch], {
    cwd: repoRoot,
    stdio: "ignore",
  })

  return ok({ worktreeRemoved: removeResult.status === 0 })
}

export const mergeInPlaceBranch = (
  repoRoot: string,
  options: MergeBranchOptions,
  strategy: MergeStrategy,
): Result<{ readonly worktreeRemoved: boolean }, VcsError> => {
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

  const integrateRes = integrateBranch(
    repoRoot,
    options.taskBranch,
    options.baseBranch,
    strategy,
    options.commitMessage,
  )
  if (integrateRes.isErr()) return err(integrateRes.error)

  return ok({ worktreeRemoved: false })
}
