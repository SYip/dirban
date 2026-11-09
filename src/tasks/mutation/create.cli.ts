import { discoverBoard } from "../../board/discovery.ts"
import type { Priority } from "../../okf/types.ts"
import type { CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { err, ok } from "neverthrow"
import pc from "picocolors"
import { createTask } from "./create.ts"

export interface NewCommandParams {
  readonly title: string
  readonly column?: string
  readonly priority?: Priority
  readonly assignee?: string
  readonly owner?: string
  readonly tags?: readonly string[]
}

export const parseNew: CommandParser<NewCommandParams> = (ctx) => {
  const title = ctx.positionals.slice(1).join(" ").trim()
  if (title === "") {
    return err({ message: 'Missing task title. Usage: dirban new "<title>" [options]' })
  }

  const tags = ctx.flags.tags != null
    ? ctx.flags.tags.split(",").map((t) => t.trim()).filter((t) => t !== "")
    : undefined

  const priority = (ctx.flags.priority as Priority | undefined) ?? ctx.config.defaultPriority

  return ok({
    title,
    column: ctx.flags.column,
    priority,
    assignee: ctx.flags.assignee,
    owner: ctx.flags.owner,
    tags,
  })
}

export const handleNew: CommandHandler = (ctx) => {
  const parseRes = parseNew(ctx)
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

  const createRes = createTask(boardRes.value, {
    title: params.title,
    column: params.column,
    priority: params.priority,
    assigned_to: params.assignee,
    owner: params.owner,
    tags: params.tags ? [...params.tags] : undefined,
  })

  if (createRes.isErr()) {
    console.error(pc.red(`Create Error: ${createRes.error.message}`))
    return 1
  }

  console.log(
    pc.green(
      `✔ Created task ${pc.bold(createRes.value.id)} in ${createRes.value.column}: ${pc.cyan(createRes.value.filePath)}`,
    ),
  )
  return 0
}

export const newCommand: CommandDefinition = {
  name: "new",
  aliases: ["create"],
  summary: "Create a new task with auto-assigned YY-001 ID (alias: create)",
  usage: "dirban new <title> [options]",
  options: [
    { flag: "--column=<col>", description: "Target column (defaults to backlog or first column)" },
    { flag: "--priority=<p>", description: "Task priority (defaults to configured default priority)" },
    { flag: "--tags=<tag1,tag2>", description: "Comma-separated list of tags" },
    { flag: "--assignee=<user>", description: "Assignee name" },
    { flag: "--owner=<owner>", description: "Task owner (developer | agent | unassigned)" },
  ],
  examples: [
    "dirban new 'Implement search filter'",
    "dirban new 'Fix login bug' --priority=p0 --column=01-todo",
  ],
  requiresTasksDir: true,
  parse: parseNew,
  execute: handleNew,
}
