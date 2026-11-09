import type { CliContext, CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { discoverBoard } from "../../board/discovery.ts"
import { err, ok } from "neverthrow"
import pc from "picocolors"
import { formatPlanView } from "../../cli/formatters.ts"
import { startInteractivePlanTui } from "../../cli/plan-tui.ts"
import { partitionBacklog, promoteTasks } from "./plan.ts"

export interface PlanCommandParams {
  readonly mode: "list" | "promote" | "interactive"
  readonly idsToPromote?: readonly string[]
  readonly toColumn?: string
  readonly readyOnly?: boolean
  readonly blockedOnly?: boolean
}

export const parsePlan: CommandParser<PlanCommandParams> = (ctx) => {
  const isPositionalPromote = ctx.positionals[1] === "promote"
  const positionalIds = isPositionalPromote
    ? ctx.positionals.slice(2).map((s) => s.trim()).filter((s) => s !== "")
    : []

  if (isPositionalPromote && positionalIds.length === 0) {
    return err({ message: "Specify at least one task ID to promote. Usage: dirban plan promote <id...> [--to=<column>]" })
  }

  let idsToPromote: readonly string[] | undefined = undefined

  if (positionalIds.length > 0) {
    idsToPromote = positionalIds
  } else if (ctx.flags.promote != null && ctx.flags.promote.trim() !== "") {
    const rawVal = ctx.flags.promote.trim()
    if (rawVal === "all") {
      idsToPromote = [rawVal]
    } else {
      idsToPromote = rawVal
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    }
  }

  if (idsToPromote != null && idsToPromote.length > 0) {
    return ok({
      mode: "promote",
      idsToPromote,
      toColumn: ctx.flags.to,
    })
  }

  if (ctx.flags.interactive) {
    return ok({ mode: "interactive" })
  }

  return ok({
    mode: "list",
    readyOnly: ctx.flags.ready === true,
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

  // 1. Scriptable promotion:
  if (params.mode === "promote" && params.idsToPromote != null) {
    let ids = params.idsToPromote
    if (ids.length === 1 && ids[0] === "all") {
      const plan = partitionBacklog(board)
      ids = plan.ready.map((item) => item.task.document.id ?? item.task.filename)
      if (ids.length === 0) {
        console.log(pc.yellow("No unblocked tasks ready to promote in backlog."))
        return 0
      }
    }

    const result = promoteTasks(board, ctx.config, ids, params.toColumn)

    if (result.failed.length > 0) {
      for (const fail of result.failed) {
        console.error(pc.red(`✖ Failed to promote ${fail.taskId}: ${fail.error.message}`))
      }
      const errorCount = result.failed.length
      const countMsg = errorCount === 1 ? "1 error found" : `${errorCount} errors found`
      console.error(pc.yellow(`✖ Promotion aborted: ${countMsg}. No tasks were moved.`))
      return 1
    }

    for (const item of result.promoted) {
      console.log(
        pc.green(
          `✔ Successfully promoted task ${item.task.document.id} to ${item.targetColumn}`,
        ),
      )
    }

    return 0
  }

  // 2. Interactive mode:
  if (params.mode === "interactive") {
    await startInteractivePlanTui(ctx.config)
    return 0
  }

  // 3. List modes:
  const plan = partitionBacklog(board)

  if (params.readyOnly) {
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

  // Default: Output formatted terminal list
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
  parse: parsePlan,
  execute: handlePlan,
}
