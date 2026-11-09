import * as fs from "node:fs"
import * as process from "node:process"
import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { formatCurrentTaskView } from "../../cli/formatters.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/commands/types.ts"
import { resolveCurrentTask } from "./current.ts"

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
