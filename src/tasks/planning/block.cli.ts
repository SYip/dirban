import { discoverBoard } from "../../board/discovery.ts"
import type { CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { err, ok } from "neverthrow"
import pc from "picocolors"
import { blockTask, unblockTask } from "./block.ts"

export interface BlockCommandParams {
  readonly taskId: string
  readonly reasons: readonly string[]
}

export const parseBlock: CommandParser<BlockCommandParams> = (ctx) => {
  const taskId = ctx.positionals[1]?.trim()
  const reasons = ctx.positionals.slice(2).map((r) => r.trim()).filter((r) => r !== "")

  if (taskId == null || taskId === "" || reasons.length === 0) {
    return err({ message: "Task ID and at least one blocker reason required. Usage: dirban block <id-or-path> <reason...>" })
  }

  return ok({ taskId, reasons })
}

export const handleBlock: CommandHandler = (ctx) => {
  const parseRes = parseBlock(ctx)
  if (parseRes.isErr()) {
    console.error(pc.red(`Error: ${parseRes.error.message}`))
    return 1
  }
  const { taskId, reasons } = parseRes.value

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
  parse: parseBlock,
  execute: handleBlock,
}

export interface UnblockCommandParams {
  readonly taskId: string
  readonly reason?: string
}

export const parseUnblock: CommandParser<UnblockCommandParams> = (ctx) => {
  const taskId = ctx.positionals[1]?.trim()
  const reason = ctx.positionals[2]?.trim()

  if (taskId == null || taskId === "") {
    return err({ message: "Task ID required. Usage: dirban unblock <id-or-path> [reason]" })
  }

  return ok({
    taskId,
    reason: reason !== "" ? reason : undefined,
  })
}

export const handleUnblock: CommandHandler = (ctx) => {
  const parseRes = parseUnblock(ctx)
  if (parseRes.isErr()) {
    console.error(pc.red(`Error: ${parseRes.error.message}`))
    return 1
  }
  const { taskId, reason } = parseRes.value

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const unblockRes = unblockTask(boardRes.value, taskId, reason)
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
  parse: parseUnblock,
  execute: handleUnblock,
}
