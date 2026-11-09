import { discoverBoard } from "../../board/discovery.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"
import pc from "picocolors"
import { moveTask } from "./move.ts"

export const handleMove: CommandHandler = (ctx) => {
  const taskId = ctx.positionals[1]
  const targetCol = ctx.positionals[2]

  if (taskId == null || targetCol == null) {
    console.error(
      pc.red("Error: Usage: dirban move <id> <target-column>"),
    )
    return 1
  }

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const moveRes = moveTask(boardRes.value, taskId, targetCol)
  if (moveRes.isErr()) {
    console.error(pc.red(`Move Error: ${moveRes.error.message}`))
    return 1
  }

  console.log(
    pc.green(
      `✔ Moved task ${moveRes.value.document.frontmatter.id} to ${moveRes.value.column}`,
    ),
  )
  return 0
}

export const moveCommand: CommandDefinition = {
  name: "move",
  summary: "Atomically move a task to target column and record journal",
  usage: "dirban move <id> <target-column>",
  options: [],
  examples: [
    "dirban move 26-001 02-doing",
    "dirban move 26-001 03-done",
  ],
  requiresTasksDir: true,
  execute: handleMove,
}
