import { discoverBoard } from "../../board/discovery.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"
import pc from "picocolors"
import { blockTask, unblockTask } from "./block.ts"

export const handleBlock: CommandHandler = (ctx) => {
  const taskId = ctx.positionals[1]
  const reasons = ctx.positionals.slice(2)

  if (taskId == null || taskId.trim() === "" || reasons.length === 0) {
    console.error(pc.red("Error: Task ID and at least one blocker reason required."))
    console.error(pc.gray("Usage: dirban block <id-or-path> <reason...>"))
    return 1
  }

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const blockRes = blockTask(boardRes.value, taskId, reasons)
  if (blockRes.isErr()) {
    console.error(pc.red(`Block Error: ${blockRes.error.message}`))
    return 1
  }

  const result = blockRes.value
  const id = result.task.document.id
  console.log(
    pc.yellow(
      `⛔ Task ${id} blocked: added [${result.addedBlockers.join(", ")}]`,
    ),
  )
  if (result.demotedToBacklog) {
    console.log(pc.gray(`   Demoted task to backlog column to free active WIP slot.`))
  }
  return 0
}

export const blockCommand: CommandDefinition = {
  name: "block",
  summary: "Record blocker reasons / task dependencies and demote to backlog",
  usage: "dirban block <id-or-path> <reasons...>",
  options: [],
  examples: [
    "dirban block 26-002 26-001",
    "dirban block 26-002 'Waiting on API key' 'PR #42 review'",
  ],
  requiresTasksDir: true,
  execute: handleBlock,
}

export const handleUnblock: CommandHandler = (ctx) => {
  const taskId = ctx.positionals[1]
  const reasonToClear = ctx.positionals[2]

  if (taskId == null || taskId.trim() === "") {
    console.error(pc.red("Error: Task ID required."))
    console.error(pc.gray("Usage: dirban unblock <id-or-path> [reason]"))
    return 1
  }

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const unblockRes = unblockTask(boardRes.value, taskId, reasonToClear)
  if (unblockRes.isErr()) {
    console.error(pc.red(`Unblock Error: ${unblockRes.error.message}`))
    return 1
  }

  const result = unblockRes.value
  const id = result.task.document.id
  console.log(
    pc.green(
      `✔ Task ${id} unblocked: removed [${result.removedBlockers.join(", ")}]`,
    ),
  )
  if (result.remainingBlockers.length > 0) {
    console.log(
      pc.gray(`   Remaining blockers: [${result.remainingBlockers.join(", ")}]`),
    )
  } else {
    console.log(pc.cyan(`   All blockers cleared. Task is ready for planning / promotion.`))
  }
  return 0
}

export const unblockCommand: CommandDefinition = {
  name: "unblock",
  summary: "Remove a resolved blocker from a task",
  usage: "dirban unblock <id-or-path> [reason]",
  options: [],
  examples: [
    "dirban unblock 26-002",
    "dirban unblock 26-002 'Waiting on API key'",
  ],
  requiresTasksDir: true,
  execute: handleUnblock,
}
