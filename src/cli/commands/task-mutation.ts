import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { createTask } from "../../operations/create.ts"
import { moveTask } from "../../operations/move.ts"
import { checkTaskItem } from "../../operations/check.ts"
import { setTaskMetadata } from "../../operations/set.ts"
import { archiveTasks } from "../../operations/archive.ts"
import type { Priority } from "../../okf/types.ts"
import type { CommandHandler } from "./types.ts"

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

