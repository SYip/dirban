import * as process from "node:process"
import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { formatNextTaskView } from "../../cli/formatters.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/commands/types.ts"
import { resolveNextTask } from "./next.ts"

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
