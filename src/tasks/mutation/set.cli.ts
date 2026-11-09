import { discoverBoard } from "../../board/discovery.ts"
import type { Priority } from "../../okf/types.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/commands/types.ts"
import pc from "picocolors"
import { setTaskMetadata } from "./set.ts"

export const handleSet: CommandHandler = (ctx) => {
  const taskId = ctx.positionals[1]
  if (taskId == null) {
    console.error(pc.red("Error: Usage: dirban set <id> [options]"))
    return 1
  }

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const tags = ctx.flags.tags != null
    ? ctx.flags.tags.split(",").map((t) => t.trim()).filter((t) => t !== "")
    : undefined
  const priority = ctx.flags.priority as Priority | undefined

  const setRes = setTaskMetadata(boardRes.value, taskId, {
    priority,
    assignee: ctx.flags.assignee,
    owner: ctx.flags.owner,
    title: ctx.flags.title,
    tags,
  })

  if (setRes.isErr()) {
    console.error(pc.red(`Set Error: ${setRes.error.message}`))
    return 1
  }

  console.log(
    pc.green(
      `✔ Updated metadata for ${setRes.value.document.frontmatter.id}`,
    ),
  )
  return 0
}

export const setCommand: CommandDefinition = {
  name: "set",
  summary: "Mutate task frontmatter (priority, assignee, owner, title, tags)",
  usage: "dirban set <id> [options]",
  options: [
    { flag: "--priority=<p0..p3>", description: "Update task priority" },
    { flag: "--assignee=<user>", description: "Assign task to user" },
    { flag: "--owner=<owner>", description: "Update task owner (developer | agent | unassigned)" },
    { flag: "--title=<title>", description: "Update task title" },
    { flag: "--tags=<tag1,tag2>", description: "Set comma-separated tags" },
  ],
  examples: [
    "dirban set 26-001 --priority=p0",
    "dirban set 26-001 --assignee=andrew --tags=core,cli",
  ],
  requiresTasksDir: true,
  execute: handleSet,
}
