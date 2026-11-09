import type { CliContext, CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { discoverBoard } from "../../board/discovery.ts"
import { ok } from "neverthrow"
import pc from "picocolors"
import { formatPlanView } from "../../cli/formatters.ts"
import { startInteractivePlanTui } from "../../cli/plan-tui.ts"
import { partitionBacklog } from "./plan.ts"

export interface PlanCommandParams {
  readonly mode: "list" | "interactive"
  readonly unblockedOnly?: boolean
  readonly blockedOnly?: boolean
}

export const parsePlan: CommandParser<PlanCommandParams> = (ctx) => {
  if (ctx.flags.interactive) {
    return ok({ mode: "interactive" })
  }

  const isUnblocked =
    ctx.flags.unblocked === true ||
    ctx.flags["no-blocked"] === true ||
    ctx.flags.ready === true

  return ok({
    mode: "list",
    unblockedOnly: isUnblocked,
    blockedOnly: ctx.flags.blocked === true,
  })
}

export const handlePlan: CommandHandler = async (ctx) => {
  const parseRes = parsePlan(ctx)
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

  const board = boardRes.value

  // 1. Interactive triage TUI mode:
  if (params.mode === "interactive") {
    await startInteractivePlanTui(ctx.config)
    return 0
  }

  // 2. Query / List inspection modes:
  const plan = partitionBacklog(board)

  if (params.unblockedOnly) {
    for (const item of plan.ready) {
      console.log(`${item.task.document.id}\t${item.task.document.title}`)
    }
    return 0
  }

  if (params.blockedOnly) {
    for (const item of plan.blocked) {
      const blockers = item.evaluation.unresolved.join(";")
      console.log(`${item.task.document.id}\t${item.task.document.title}\t${blockers}`)
    }
    return 0
  }

  // Default: Formatted terminal tree list
  console.log(formatPlanView(plan))
  return 0
}

export const planCommand: CommandDefinition = {
  name: "plan",
  summary: "View backlog triage and dependency planning (options: --unblocked, --blocked, -i)",
  usage: "dirban plan [options]",
  options: [
    { flag: "-u, --unblocked", description: "List only unblocked backlog tasks ready to be scheduled (alias: --no-blocked)" },
    { flag: "-b, --blocked", description: "List only currently blocked backlog tasks and blocking sources" },
    { flag: "-i, --interactive", description: "Launch interactive terminal planner to triage tasks" },
  ],
  examples: [
    "dirban plan",
    "dirban plan --unblocked",
    "dirban plan --blocked",
    "dirban plan -i",
  ],
  requiresTasksDir: true,
  parse: parsePlan,
  execute: handlePlan,
}
