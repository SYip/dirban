import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { toRelativePath } from "../../cli/formatters.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"
import { getVcsProvider } from "../../vcs/index.ts"
import { auditWorktrees, pruneWorktrees } from "./worktree.ts"

const STATUS_BADGE_MAP: Readonly<Record<string, (s: string) => string>> = {
  active: pc.green,
  blocked: pc.yellow,
  completed: pc.cyan,
  orphan: pc.red,
}

export const handleWorktreeList: CommandHandler = (ctx) => {
  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const vcs = getVcsProvider(ctx.cwd)
  const auditRes = auditWorktrees(boardRes.value, vcs, ctx.cwd)
  if (auditRes.isErr()) {
    console.error(pc.red(`Worktree Error: ${auditRes.error.message}`))
    return 1
  }

  const entries = auditRes.value
  if (entries.length === 0) {
    console.log(pc.gray("No active task worktrees found."))
    return 0
  }

  console.log(pc.bold("\nActive Git Worktrees:\n"))
  for (const wt of entries) {
    const colorFn = STATUS_BADGE_MAP[wt.status] ?? pc.white
    const badge = colorFn(`[${wt.status.toUpperCase()}]`.padEnd(11))
    const idLabel = wt.taskId != null ? pc.cyan(wt.taskId) : pc.gray("(no-id)")
    const dirtyTag = wt.isDirty ? pc.red(" (dirty)") : ""
    const relPath = toRelativePath(wt.path, ctx.cwd)
    console.log(`  ${badge} ${idLabel.padEnd(18)} ${relPath}${dirtyTag}`)
  }
  console.log()
  return 0
}

export const handlePrune: CommandHandler = (ctx) => {
  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const vcs = getVcsProvider(ctx.cwd)
  const force = ctx.flags.force === true
  const pruneRes = pruneWorktrees(boardRes.value, vcs, { cwd: ctx.cwd, force })
  if (pruneRes.isErr()) {
    console.error(pc.red(`Prune Error: ${pruneRes.error.message}`))
    return 1
  }

  const { removed, skippedDirty, failed } = pruneRes.value
  if (removed.length === 0 && skippedDirty.length === 0 && failed.length === 0) {
    console.log(pc.gray("No completed or orphaned worktrees to prune."))
    return 0
  }

  for (const wt of removed) {
    console.log(pc.green(`✔ Pruned ${wt.status} worktree: ${toRelativePath(wt.path, ctx.cwd)}`))
  }
  for (const wt of skippedDirty) {
    console.log(
      pc.yellow(
        `⚠ Skipped dirty worktree (pass --force to remove): ${toRelativePath(wt.path, ctx.cwd)}`,
      ),
    )
  }
  for (const failure of failed) {
    console.error(
      pc.red(
        `✖ Failed to prune ${toRelativePath(failure.worktree.path, ctx.cwd)}: ${failure.message}`,
      ),
    )
  }

  return failed.length > 0 ? 1 : 0
}

export const handleWorktree: CommandHandler = (ctx) => {
  const subcommand = ctx.positionals[1]?.trim().toLowerCase()
  if (subcommand === "prune") {
    return handlePrune(ctx)
  }
  return handleWorktreeList(ctx)
}

export const worktreeCommand: CommandDefinition = {
  name: "worktree",
  summary: "List or prune task Git worktrees",
  usage: "dirban worktree [list|prune] [--force]",
  execute: handleWorktree,
}

export const pruneCommand: CommandDefinition = {
  name: "prune",
  summary: "Remove completed or orphaned task Git worktrees",
  usage: "dirban prune [--force]",
  execute: handlePrune,
}
