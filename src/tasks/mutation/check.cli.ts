import { discoverBoard } from "../../board/discovery.ts"
import type { CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { err, ok } from "neverthrow"
import pc from "picocolors"
import { checkTaskItem } from "./check.ts"

export interface CheckCommandParams {
  readonly taskId: string
  readonly index: number
}

export const parseCheck: CommandParser<CheckCommandParams> = (ctx) => {
  const taskId = ctx.positionals[1]?.trim()
  const indexStr = ctx.positionals[2]?.trim()

  if (taskId == null || taskId === "" || indexStr == null || indexStr === "") {
    return err({ message: "Usage: dirban check <id> <index>" })
  }

  const index = parseInt(indexStr, 10)
  if (isNaN(index) || index < 1) {
    return err({ message: "Index must be a positive number" })
  }

  return ok({ taskId, index })
}

export const handleCheck: CommandHandler = (ctx) => {
  const parseRes = parseCheck(ctx)
  if (parseRes.isErr()) {
    console.error(pc.red(`Error: ${parseRes.error.message}`))
    return 1
  }
  const { taskId, index } = parseRes.value

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const checkRes = checkTaskItem(boardRes.value, taskId, index)
  if (checkRes.isErr()) {
    console.error(pc.red(`Check Error: ${checkRes.error.message}`))
    return 1
  }

  const targetAc = checkRes.value.document.acceptanceCriteria.find((a) =>
    a.index === index
  )
  const stateStr = targetAc?.checked ? pc.green("[x]") : pc.red("[ ]")
  console.log(
    pc.green(
      `✔ Updated criterion #${index} to ${stateStr} for task ${checkRes.value.document.frontmatter.id}`,
    ),
  )
  return 0
}

export const checkCommand: CommandDefinition = {
  name: "check",
  summary: "Toggle acceptance criteria checkbox item (1-based index)",
  usage: "dirban check <id> <index>",
  options: [],
  examples: [
    "dirban check 26-001 1",
    "dirban check 26-001 2",
  ],
  requiresTasksDir: true,
  parse: parseCheck,
  execute: handleCheck,
}
