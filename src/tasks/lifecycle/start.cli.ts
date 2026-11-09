import { err, ok } from "neverthrow"
import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import {
  formatTerminalLink,
  toRelativePath,
} from "../../cli/formatters.ts"
import type { LifecycleStrategyType } from "../../workspace/types.ts"
import type { CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { startTask } from "./start.ts"

export interface StartCommandParams {
  readonly taskId: string
  readonly strategy?: LifecycleStrategyType
  readonly noGit?: boolean
}

export const parseStart: CommandParser<StartCommandParams> = (ctx) => {
  const isWorktreeCmd = ctx.positionals[0] === "worktree"
  const taskId = isWorktreeCmd ? ctx.positionals[2] : ctx.positionals[1]
  if (taskId == null || taskId.trim() === "") {
    return err({ message: "Missing task ID. Usage: dirban start <id> [--checkout|--worktree]" })
  }

  const isCurrentOrNoBranch = ctx.flags.current || ctx.flags["no-branch"]
  if (ctx.flags.worktree && isCurrentOrNoBranch) {
    return err({ message: "Cannot specify both --worktree and --current / --no-branch." })
  }
  if (ctx.flags.checkout && isCurrentOrNoBranch) {
    return err({ message: "Cannot specify both --checkout and --current / --no-branch." })
  }
  if (ctx.flags.checkout && ctx.flags.worktree) {
    return err({ message: "Cannot specify both --checkout and --worktree." })
  }

  const strategyParam = ctx.flags.strategy
  const isNoneStrategy = strategyParam === "none" || isCurrentOrNoBranch

  const strategy: LifecycleStrategyType | undefined = isNoneStrategy
    ? "none"
    : strategyParam === "worktree" || strategyParam === "checkout" || strategyParam === "directory-only"
    ? strategyParam
    : ctx.flags.worktree
    ? "worktree"
    : ctx.flags.checkout
    ? "checkout"
    : undefined

  const noGit = ctx.flags["no-git"]

  return ok({
    taskId: taskId.trim(),
    strategy,
    noGit,
  })
}

export const handleStart: CommandHandler = (ctx) => {
  const parseRes = parseStart(ctx)
  if (parseRes.isErr()) {
    console.error(pc.red(`Error: ${parseRes.error.message}`))
    return 1
  }
  const params = parseRes.value

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const startRes = startTask(boardRes.value, ctx.config, params.taskId, {
    strategy: params.strategy,
    noGit: params.noGit,
    cwd: ctx.cwd,
  })
  if (startRes.isErr()) {
    console.error(pc.red(`Start Error: ${startRes.error.message}`))
    return 1
  }

  const { task, branchName, strategy: usedStrategy, worktreePath, gitSkipped, gitMessage } = startRes.value
  const taskDisplayName = task.document.id ?? task.filename
  const relPath = toRelativePath(task.filePath)
  const linkedTask = formatTerminalLink(taskDisplayName, task.filePath)

  console.log(
    pc.green(
      `✔ Moved task ${linkedTask} to ${task.column} (${pc.dim(relPath)})`,
    ),
  )

  if (gitSkipped && gitMessage != null) {
    console.log(pc.yellow(`Notice: ${gitMessage}`))
  } else if (usedStrategy === "worktree" && worktreePath != null) {
    console.log(
      pc.green(
        `✔ Created worktree for branch ${pc.cyan(branchName)} at ${pc.cyan(worktreePath)}`,
      ),
    )
  } else {
    console.log(
      pc.green(`✔ Active on branch ${pc.cyan(branchName)} (${usedStrategy})`),
    )
  }
  return 0
}

export const startCommand: CommandDefinition = {
  name: "start",
  aliases: ["worktree add"],
  summary: "Start work on task. Moves to focus column & provisions branch/worktree",
  usage: "dirban start <id> [options]",
  options: [
    { flag: "--strategy <type>", description: "Lifecycle strategy: checkout | worktree | none | directory-only" },
    { flag: "--checkout", description: "Shorthand for --strategy checkout" },
    { flag: "--worktree", description: "Shorthand for --strategy worktree" },
    { flag: "--current", description: "Stay on current branch (shorthand for --strategy none)" },
    { flag: "--no-branch", description: "Alias for --current" },
    { flag: "--no-git", description: "Skip Git operations (shorthand for --strategy directory-only)" },
  ],
  examples: [
    "dirban start 26-001",
    "dirban start 26-001 --strategy worktree",
    "dirban start 26-001 --current",
    "dirban start 26-001 --no-git",
  ],
  requiresTasksDir: true,
  parse: parseStart,
  execute: handleStart,
}
