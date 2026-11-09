import type { CliContext, CommandDefinition, CommandHandler } from "../../cli/types.ts"
import { discoverBoard } from "../../board/discovery.ts"
import pc from "picocolors"
import { formatPlanView } from "../../cli/formatters.ts"
import { startInteractivePlanTui } from "../../cli/plan-tui.ts"
import { partitionBacklog, promoteTasks } from "./plan.ts"

export const handlePlan: CommandHandler = async (ctx) => {
  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const board = boardRes.value

  // 1. Scriptable promotion:
  // - Positional syntax: dirban plan promote <id1> <id2> ... [--to=<col>]
  // - Flag syntax: dirban plan --promote=<id1>,<id2> | --promote=all [--to=<col>]
  const isPositionalPromote = ctx.positionals[1] === "promote"
  const positionalIds = isPositionalPromote ? ctx.positionals.slice(2) : []

  let idsToPromote: string[] = []

  if (positionalIds.length > 0) {
    idsToPromote = positionalIds
  } else if (ctx.flags.promote != null && ctx.flags.promote.trim() !== "") {
    const rawVal = ctx.flags.promote.trim()
    if (rawVal === "all" || rawVal === "ready") {
      const plan = partitionBacklog(board)
      idsToPromote = plan.ready.map((item) => item.task.document.id ?? item.task.filename)
      if (idsToPromote.length === 0) {
        console.log(pc.yellow("No unblocked tasks ready to promote in backlog."))
        return 0
      }
    } else {
      idsToPromote = rawVal
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    }
  }

  if (idsToPromote.length > 0) {
    const result = promoteTasks(board, ctx.config, idsToPromote, ctx.flags.to)

    for (const item of result.promoted) {
      console.log(
        pc.green(
          `✔ Successfully promoted task ${item.task.document.id} to ${item.targetColumn}`,
        ),
      )
    }

    if (result.failed.length > 0) {
      for (const fail of result.failed) {
        console.error(pc.red(`✖ Failed to promote ${fail.taskId}: ${fail.error.message}`))
      }
      if (result.promoted.length === 0) {
        const errorCount = result.failed.length
        const countMsg = errorCount === 1 ? "1 error found" : `${errorCount} errors found`
        console.error(pc.yellow(`✖ Promotion aborted: ${countMsg}. No tasks were moved.`))
        return 1
      }
    }

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

export const planCommand: CommandDefinition = {
  name: "plan",
  summary: "View backlog triage and planning (options: --ready, --blocked, --promote=<ids|all>, -i)",
  usage: "dirban plan [options]\n       dirban plan promote <id...> [--to=<column>]",
  options: [
    { flag: "--ready", description: "List only unblocked backlog tasks ready to be scheduled" },
    { flag: "--blocked", description: "List only currently blocked backlog tasks and blocking sources" },
    { flag: "--promote=<ids|all>", description: "Promote unblocked backlog tasks (single ID, comma-separated, or 'all')" },
    { flag: "--to=<column>", description: "Target column for promotion (defaults to first active column)" },
    { flag: "-i, --interactive", description: "Launch interactive terminal planner to triage, multi-select, and promote tasks" },
  ],
  examples: [
    "dirban plan",
    "dirban plan --ready",
    "dirban plan --promote=all",
    "dirban plan promote 26-001 26-002",
    "dirban plan -i",
  ],
  requiresTasksDir: true,
  execute: handlePlan,
}
