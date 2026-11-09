import pc from "picocolors"
import type { CommandDefinition, CommandHandler } from "../../cli/commands/types.ts"

export const handlePriorities: CommandHandler = (ctx) => {
  const listFormatted = ctx.config.priorities
    .map((p) =>
      p === ctx.config.defaultPriority
        ? `${pc.bold(pc.green(p))} ${pc.gray("(default)")}`
        : pc.cyan(p)
    )
    .join(", ")

  console.log(`${pc.bold("Available priorities:")} ${listFormatted}`)
  return 0
}

export const prioritiesCommand: CommandDefinition = {
  name: "priorities",
  summary: "List available task priority levels and highlight the default",
  usage: "dirban priorities",
  options: [],
  examples: [
    "dirban priorities",
  ],
  requiresTasksDir: false,
  execute: handlePriorities,
}
