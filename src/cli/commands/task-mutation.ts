import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { createTask } from "../../operations/create.ts"
import { moveTask } from "../../operations/move.ts"
import { checkTaskItem } from "../../operations/check.ts"
import { setTaskMetadata } from "../../operations/set.ts"
import { archiveTasks } from "../../operations/archive.ts"
import type { Priority } from "../../okf/types.ts"
import type { CommandDefinition, CommandHandler } from "./types.ts"

export const handleNew: CommandHandler = (ctx) => {
  const title = ctx.positionals.slice(1).join(" ").trim()
  if (title === "") {
    console.error(
      pc.red('Error: Missing task title. Usage: dirban new "<title>" [options]'),
    )
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
  const priority = (ctx.flags.priority as Priority | undefined) ??
    ctx.config.defaultPriority

  const createRes = createTask(boardRes.value, {
    title,
    column: ctx.flags.column,
    priority,
    assigned_to: ctx.flags.assignee,
    owner: ctx.flags.owner,
    tags,
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

export const handleArchive: CommandHandler = (ctx) => {
  const target = ctx.positionals[1] || "all"

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const archiveRes = archiveTasks(boardRes.value, ctx.config, target, ctx.cwd)
  if (archiveRes.isErr()) {
    console.error(pc.red(`Archive Error: ${archiveRes.error.message}`))
    return 1
  }

  console.log(
    pc.green(
      `✔ Successfully archived ${archiveRes.value.archivedTasks.length} task(s) to ${archiveRes.value.targetDirectory}`,
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
  execute: handleNew,
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

export const archiveCommand: CommandDefinition = {
  name: "archive",
  summary: "Archive completed tasks directly to archive/",
  usage: "dirban archive [<id>|all]",
  options: [],
  examples: [
    "dirban archive all",
    "dirban archive 26-001",
  ],
  requiresTasksDir: true,
  execute: handleArchive,
}

