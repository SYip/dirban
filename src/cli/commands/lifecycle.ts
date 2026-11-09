import * as fs from "node:fs"
import * as path from "node:path"
import * as process from "node:process"
import { err, ok } from "neverthrow"
import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import {
  formatCurrentTaskView,
  formatNextTaskView,
  formatTerminalLink,
  toRelativePath,
} from "../formatters.ts"
import { resolveCurrentTask } from "../../operations/current.ts"
import { resolveNextTask } from "../../operations/next.ts"
import { startTask } from "../../operations/start.ts"
import { doneTask } from "../../operations/done.ts"
import { getVcsProvider } from "../../vcs/index.ts"
import type { LifecycleStrategyType } from "../../workspace/types.ts"
import type { CommandDefinition, CommandHandler, CommandParser, CommandValidationError } from "./types.ts"

export const handleCurrent: CommandHandler = (ctx) => {
  const explicitId = ctx.positionals[1]
  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const currentRes = resolveCurrentTask(boardRes.value, ctx.config, explicitId, ctx.cwd)
  if (currentRes.isErr()) {
    console.log(currentRes.error.message)
    return 0
  }

  const { task, multipleInDoing, doingCount } = currentRes.value

  if (ctx.flags.raw) {
    try {
      const rawContent = fs.readFileSync(task.filePath, "utf-8")
      process.stdout.write(rawContent)
      return 0
    } catch (readErr) {
      console.error(
        pc.red(
          `Failed to read task file: ${readErr instanceof Error ? readErr.message : "Unknown error"}`,
        ),
      )
      return 1
    }
  }

  if (multipleInDoing) {
    console.log(
      pc.yellow(
        `Notice: Multiple tasks in doing (${doingCount}). Selected highest-priority task.`,
      ),
    )
  }

  console.log(formatCurrentTaskView(task))
  return 0
}

export const handleNext: CommandHandler = (ctx) => {
  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const nextRes = resolveNextTask(boardRes.value, ctx.config)
  if (nextRes.isErr()) {
    console.log(pc.yellow(nextRes.error.message))
    return 0
  }

  const { task, sourceColumn, queueCount } = nextRes.value
  const taskId = task.document.id ?? task.filename

  if (ctx.flags.raw) {
    process.stdout.write(taskId)
    return 0
  }

  console.log(formatNextTaskView(task, sourceColumn, queueCount, ctx.cwd))
  return 0
}

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

export interface DoneCommandParams {
  readonly taskId?: string
  readonly strategy?: LifecycleStrategyType
  readonly noGit?: boolean
  readonly noMerge?: boolean
}

export const parseDone: CommandParser<DoneCommandParams> = (ctx) => {
  if (ctx.flags.merge && ctx.flags["no-merge"]) {
    return err({ message: "Cannot specify both --merge and --no-merge." })
  }

  const taskId = ctx.positionals[1]
  const strategyParam = ctx.flags.strategy
  const isNoneStrategy =
    strategyParam === "none" || ctx.flags.current || ctx.flags["no-branch"]

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
  const noMerge = ctx.flags.merge === true ? false : ctx.flags["no-merge"]

  return ok({
    taskId,
    strategy,
    noGit,
    noMerge,
  })
}

export const handleDone: CommandHandler = (ctx) => {
  const parseRes = parseDone(ctx)
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

  const doneRes = doneTask(boardRes.value, ctx.config, params.taskId, {
    cwd: ctx.cwd,
    strategy: params.strategy,
    noGit: params.noGit,
    noMerge: params.noMerge,
  })
  if (doneRes.isErr()) {
    console.error(pc.red(`Done Error: ${doneRes.error.message}`))
    return 1
  }

  const { task, uncheckedCount, mergedBranch, baseBranch, worktreeRemoved, gitSkipped, message } = doneRes.value
  console.log(
    pc.green(
      `✔ Completed task ${task.document.id ?? task.filename} (moved to ${task.column})`,
    ),
  )

  if (uncheckedCount > 0) {
    console.log(
      pc.yellow(
        `Notice: ${uncheckedCount} acceptance criteria remain unchecked.`,
      ),
    )
  }

  if (!gitSkipped && mergedBranch != null && baseBranch != null) {
    console.log(
      pc.green(`✔ Auto-merged branch ${pc.cyan(mergedBranch)} into ${pc.cyan(baseBranch)}`),
    )
    if (worktreeRemoved) {
      console.log(pc.green(`✔ Removed completed worktree directory`))
    }
  } else if (message != null) {
    console.log(pc.dim(`Git notice: ${message}`))
  }

  return 0
}

export const handlePath: CommandHandler = (ctx) => {
  const target = ctx.positionals[1]
  const vcsProvider = getVcsProvider()
  const pathResult = vcsProvider.resolveWorktreePath(target)

  if (pathResult.isErr()) {
    console.error(pc.red(`Error: ${pathResult.error.message}`))
    return 1
  }

  // Print raw path to stdout (clean for command substitution like `cd $(dirban path)`)
  console.log(pathResult.value)
  return 0
}

export const currentCommand: CommandDefinition = {
  name: "current",
  aliases: ["focus"],
  summary: "Show active task (alias: focus). Detects git branch/worktree or focus column",
  usage: "dirban current [id] [options]",
  options: [
    { flag: "--raw", description: "Print raw Markdown content to stdout for AI agent piping" },
  ],
  examples: [
    "dirban current",
    "dirban focus",
    "dirban current --raw",
  ],
  requiresTasksDir: true,
  execute: handleCurrent,
}

export const nextCommand: CommandDefinition = {
  name: "next",
  summary: "Show next recommended task to work on from todo queue",
  usage: "dirban next [options]",
  options: [
    { flag: "--raw", description: "Print bare task ID to stdout for shell composition (e.g. dirban start $(dirban next --raw))" },
  ],
  examples: [
    "dirban next",
    "dirban next --raw",
    "dirban start $(dirban next --raw)",
  ],
  requiresTasksDir: true,
  execute: handleNext,
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

export const doneCommand: CommandDefinition = {
  name: "done",
  aliases: ["finish"],
  summary: "Finish task (alias: finish). Moves to next column or archive & merges git branch",
  usage: "dirban done [id] [options]",
  options: [
    { flag: "--strategy <type>", description: "Override auto-detected lifecycle strategy: checkout | worktree | none | directory-only" },
    { flag: "--merge", description: "Force merge into base branch even if autoMerge is disabled in config" },
    { flag: "--no-merge", description: "Preserve active branch/worktree without merging into base branch" },
    { flag: "--no-git", description: "Skip Git merge & cleanup" },
  ],
  examples: [
    "dirban done",
    "dirban done 26-001",
    "dirban done 26-001 --no-merge",
    "dirban finish",
  ],
  requiresTasksDir: true,
  parse: parseDone,
  execute: handleDone,
}

export const pathCommand: CommandDefinition = {
  name: "path",
  summary: "Print absolute filesystem path of a task worktree or main repository",
  usage: "dirban path [id|main]",
  options: [],
  examples: [
    "cd $(dirban path)",
    "cd $(dirban path 26-001)",
  ],
  requiresTasksDir: false,
  execute: handlePath,
}

