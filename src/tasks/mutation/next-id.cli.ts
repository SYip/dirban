import { discoverBoard } from "../../board/discovery.ts"
import { calculateNextTaskId } from "../mutation/create.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"
import pc from "picocolors"

export const handleNextId: CommandHandler = (ctx) => {
  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const nextId = calculateNextTaskId(boardRes.value)
  console.log(nextId)
  return 0
}

export const nextIdCommand: CommandDefinition = {
  name: "next-id",
  summary: "Print the next available task ID for the current year",
  usage: "dirban next-id",
  options: [],
  examples: [
    "dirban next-id",
    "export ID=$(dirban next-id)",
  ],
  requiresTasksDir: true,
  execute: handleNextId,
}
