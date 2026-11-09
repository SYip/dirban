import { discoverBoard } from "../../board/discovery.ts"
import type { CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { err, ok } from "neverthrow"
import pc from "picocolors"
import { moveTask } from "./move.ts"

export interface MoveCommandParams {
  readonly taskId: string
  readonly targetColumn: string
}

export const parseMove: CommandParser<MoveCommandParams> = (ctx) => {
  const taskId = ctx.positionals[1]?.trim()
  const targetColumn = ctx.positionals[2]?.trim()

  if (taskId == null || taskId === "" || targetColumn == null || targetColumn === "") {
    return err({ message: "Usage: dirban move <id> <target-column>" })
  }

  return ok({ taskId, targetColumn })
}

export const handleMove: CommandHandler = (ctx) => {
  const parseRes = parseMove(ctx)
  if (parseRes.isErr()) {
    console.error(pc.red(`Error: ${parseRes.error.message}`))
    return 1
  }
  const { taskId, targetColumn } = parseRes.value

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const moveRes = moveTask(boardRes.value, taskId, targetColumn)
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
  parse: parseMove,
  execute: handleMove,
}
