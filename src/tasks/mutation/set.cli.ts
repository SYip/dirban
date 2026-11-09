import { discoverBoard } from "../../board/discovery.ts"
import type { Priority } from "../../okf/types.ts"
import type { CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { err, ok } from "neverthrow"
import pc from "picocolors"
import { setTaskMetadata } from "./set.ts"

export interface SetCommandParams {
  readonly taskId: string
  readonly priority?: Priority
  readonly assignee?: string
  readonly owner?: string
  readonly title?: string
  readonly tags?: readonly string[]
}

export const parseSet: CommandParser<SetCommandParams> = (ctx) => {
  const taskId = ctx.positionals[1]?.trim()
  if (taskId == null || taskId === "") {
    return err({ message: "Usage: dirban set <id> [options]" })
  }

  const tags = ctx.flags.tags != null
    ? ctx.flags.tags.split(",").map((t) => t.trim()).filter((t) => t !== "")
    : undefined
  const priority = ctx.flags.priority as Priority | undefined

  return ok({
    taskId,
    priority,
    assignee: ctx.flags.assignee,
    owner: ctx.flags.owner,
    title: ctx.flags.title,
    tags,
  })
}

export const handleSet: CommandHandler = (ctx) => {
  const parseRes = parseSet(ctx)
  if (parseRes.isErr()) {
    console.error(pc.red(`Error: ${parseRes.error.message}`))
    return 1
  }
  const params = parseRes.value

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const setRes = setTaskMetadata(boardRes.value, params.taskId, {
    priority: params.priority,
    assignee: params.assignee,
    owner: params.owner,
    title: params.title,
    tags: params.tags,
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
  parse: parseSet,
  execute: handleSet,
}
