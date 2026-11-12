import type { CliContext, CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { discoverBoard } from "../../board/discovery.ts"
import { err, ok } from "neverthrow"
import pc from "picocolors"
import { toRelativePath } from "../../cli/formatters.ts"
import { partitionBacklog, promoteTasks } from "../planning/plan.ts"

export interface ReadyCommandParams {
  readonly ids: readonly string[]
  readonly toColumn?: string
}

export const parseReady: CommandParser<ReadyCommandParams> = (ctx) => {
  const ids = ctx.positionals.slice(1).map((s) => s.trim()).filter((s) => s !== "")

  if (ids.length === 0) {
    return err({
      message: "Specify at least one task ID to ready (or 'all'). Usage: dirban ready <id...> [--to=<column>]",
    })
  }

  return ok({
    ids,
    toColumn: ctx.flags.to,
  })
}

export const handleReady: CommandHandler = (ctx) => {
  const parseRes = parseReady(ctx)
  if (parseRes.isErr()) {
    console.error(pc.red(`Error: ${parseRes.error.message}`))
    return 1
  }

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const board = boardRes.value
  let ids = parseRes.value.ids

  if (ids.length === 1 && ids[0] === "all") {
    const plan = partitionBacklog(board)
    ids = plan.ready.map((item) => item.task.document.id ?? item.task.filename)
    if (ids.length === 0) {
      console.log(pc.yellow("No unblocked tasks ready in backlog."))
      return 0
    }
  }

  const result = promoteTasks(board, ctx.config, ids, parseRes.value.toColumn)

  if (result.failed.length > 0) {
    for (const fail of result.failed) {
      console.error(pc.red(`✖ Failed to ready ${fail.taskId}: ${fail.error.message}`))
    }
    const errorCount = result.failed.length
    const countMsg = errorCount === 1 ? "1 error found" : `${errorCount} errors found`
    console.error(pc.yellow(`✖ Ready operation aborted: ${countMsg}. No tasks were moved.`))
    return 1
  }

  if (ids.length > 1) {
    console.log(
      pc.green(
        `✔ Successfully readied ${result.promoted.length} task(s) to ${result.promoted[0]?.targetColumn ?? "todo"}`,
      ),
    )
  } else {
    for (const item of result.promoted) {
      const relPath = toRelativePath(item.task.filePath, ctx.cwd)
      console.log(
        pc.green(
          `✔ Readied task ${item.task.document.id}: ${pc.cyan(relPath)}`,
        ),
      )
    }
  }

  return 0
}

export const readyCommand: CommandDefinition = {
  name: "ready",
  summary: "Move unblocked backlog task(s) to todo queue (transition task from backlog to active queue)",
  usage: "dirban ready <id...> [--to=<column>]\n       dirban ready all",
  options: [
    { flag: "--to=<column>", description: "Target column for task (defaults to first active column, e.g. 01-todo)" },
  ],
  examples: [
    "dirban ready 26-001",
    "dirban ready 001 002",
    "dirban ready all",
    "dirban ready 001 --to=01-todo",
  ],
  requiresTasksDir: true,
  parse: parseReady,
  execute: handleReady,
}
