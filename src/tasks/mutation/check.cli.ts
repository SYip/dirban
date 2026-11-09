import { discoverBoard } from "../../board/discovery.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"
import pc from "picocolors"
import { checkTaskItem } from "./check.ts"

export const handleCheck: CommandHandler = (ctx) => {
  const taskId = ctx.positionals[1]
  const indexStr = ctx.positionals[2]

  if (taskId == null || indexStr == null) {
    console.error(pc.red("Error: Usage: dirban check <id> <index>"))
    return 1
  }

  const index = parseInt(indexStr, 10)
  if (isNaN(index)) {
    console.error(pc.red("Error: Index must be a valid number"))
    return 1
  }

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
  execute: handleCheck,
}
