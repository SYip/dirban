import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { blockTask, unblockTask } from "../../operations/block.ts"
import { partitionBacklog, promoteTask } from "../../operations/plan.ts"
import { formatPlanView } from "../formatters.ts"
import { startInteractivePlanTui } from "../plan-tui.ts"
import type { CommandHandler } from "./types.ts"

export const handlePlan: CommandHandler = async (ctx) => {
  const boardRes = discoverBoard(ctx.config)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const board = boardRes.value

  // 1. Scriptable promotion flag: dirban plan --promote=<id> [--to=<col>]
  if (ctx.flags.promote != null && ctx.flags.promote.trim() !== "") {
    const promoteRes = promoteTask(board, ctx.config, ctx.flags.promote.trim(), ctx.flags.to)
    if (promoteRes.isErr()) {
      console.error(pc.red(`Promote Error: ${promoteRes.error.message}`))
      return 1
    }
    console.log(
      pc.green(
        `✔ Successfully promoted task ${promoteRes.value.task.document.id} to ${promoteRes.value.targetColumn}`,
      ),
    )
    return 0
  }

  const plan = partitionBacklog(board)

  // 2. Scriptable flag: dirban plan --ready (lists only unblocked tasks)
  if (ctx.flags.ready) {
    for (const item of plan.ready) {
      console.log(`${item.task.document.id}\t${item.task.document.title}`)
    }
    return 0
  }

  // 3. Scriptable flag: dirban plan --blocked (lists only blocked tasks and blockers)
  if (ctx.flags.blocked) {
    for (const item of plan.blocked) {
      const blockers = item.evaluation.unresolved.join(";")
      console.log(`${item.task.document.id}\t${item.task.document.title}\t${blockers}`)
    }
    return 0
  }

  // 4. Interactive mode: dirban plan --interactive / -i
  if (ctx.flags.interactive) {
    await startInteractivePlanTui(ctx.config)
    return 0
  }

  // 5. Default: Output formatted terminal list
  console.log(formatPlanView(plan))
  return 0
}

export const handleBlock: CommandHandler = (ctx) => {
  const taskId = ctx.positionals[1]
  const reasons = ctx.positionals.slice(2)

  if (taskId == null || taskId.trim() === "" || reasons.length === 0) {
    console.error(pc.red("Error: Task ID and at least one blocker reason required."))
    console.error(pc.gray("Usage: dirban block <id-or-path> <reason...>"))
    return 1
  }

  const boardRes = discoverBoard(ctx.config)
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

export const handleUnblock: CommandHandler = (ctx) => {
  const taskId = ctx.positionals[1]
  const reasonToClear = ctx.positionals[2]

  if (taskId == null || taskId.trim() === "") {
    console.error(pc.red("Error: Task ID required."))
    console.error(pc.gray("Usage: dirban unblock <id-or-path> [reason]"))
    return 1
  }

  const boardRes = discoverBoard(ctx.config)
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

