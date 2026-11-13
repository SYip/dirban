import { err, ok } from "neverthrow"
import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { logError, logTip, logWarning, toRelativePath } from "../../cli/formatters.ts"
import type { CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import type { LifecycleStrategyType } from "../../workspace/types.ts"
import { type DoneTaskError, doneTask } from "./done.ts"

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
  const isNoneStrategy = strategyParam === "none" || ctx.flags.current || ctx.flags["no-branch"]

  const strategy: LifecycleStrategyType | undefined = isNoneStrategy
    ? "none"
    : strategyParam === "worktree"
        || strategyParam === "checkout"
        || strategyParam === "directory-only"
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

export const printDoneError = (err: DoneTaskError): void => {
  switch (err.kind) {
    case "INVALID_COLUMN_TRANSITION":
      logWarning(`Cannot complete task: ${err.message}`)
      if (err.suggestion != null) {
        logTip(err.suggestion)
      }
      break
    case "ALREADY_COMPLETED":
      logWarning(err.message)
      break
    default:
      logError(err.message, "Done")
      break
  }
}

export const handleDone: CommandHandler = (ctx) => {
  const parseRes = parseDone(ctx)
  if (parseRes.isErr()) {
    logError(parseRes.error.message)
    return 1
  }
  const params = parseRes.value

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    logError(boardRes.error.message, "Board")
    return 1
  }

  const doneRes = doneTask(boardRes.value, ctx.config, params.taskId, {
    cwd: ctx.cwd,
    strategy: params.strategy,
    noGit: params.noGit,
    noMerge: params.noMerge,
  })
  if (doneRes.isErr()) {
    printDoneError(doneRes.error)
    return 1
  }

  const { task, uncheckedCount, mergedBranch, baseBranch, worktreeRemoved, gitSkipped, message } =
    doneRes.value
  const taskIdDisplay = task.document.id ?? task.filename
  const relPath = toRelativePath(task.filePath, ctx.cwd)
  console.log(pc.green(`✔ Completed task ${taskIdDisplay}: ${pc.cyan(relPath)}`))

  if (uncheckedCount > 0) {
    console.log(pc.yellow(`Notice: ${uncheckedCount} acceptance criteria remain unchecked.`))
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

export const doneCommand: CommandDefinition = {
  name: "done",
  aliases: ["finish"],
  summary: "Finish task (alias: finish). Moves to next column or archive & merges git branch",
  usage: "dirban done [id] [options]",
  options: [
    {
      flag: "--strategy <type>",
      description:
        "Override auto-detected lifecycle strategy: checkout | worktree | none | directory-only",
    },
    {
      flag: "--merge",
      description: "Force merge into base branch even if autoMerge is disabled in config",
    },
    {
      flag: "--no-merge",
      description: "Preserve active branch/worktree without merging into base branch",
    },
    { flag: "--no-git", description: "Skip Git merge & cleanup" },
  ],
  examples: ["dirban done", "dirban done 26-001", "dirban done 26-001 --no-merge", "dirban finish"],
  requiresTasksDir: true,
  parse: parseDone,
  execute: handleDone,
}
