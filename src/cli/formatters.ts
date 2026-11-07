import pc from "picocolors"
import type { Board, BoardTask } from "../board/types.ts"

export const getPriorityBadge = (priority: string): string => {
  switch (priority) {
    case "p0":
      return pc.bgRed(pc.white(" P0 "))
    case "p1":
      return pc.bgYellow(pc.black(" P1 "))
    case "p2":
      return pc.bgBlue(pc.white(" P2 "))
    case "p3":
      return pc.bgBlack(pc.white(" P3 "))
    default:
      return pc.gray(` [${priority}] `)
  }
}

export const renderProgressBar = (
  completed: number,
  total: number,
  width = 12,
): string => {
  if (total === 0) {
    return pc.gray("[No Criteria]")
  }
  const ratio = Math.min(Math.max(completed / total, 0), 1)
  const filledCount = Math.round(ratio * width)
  const emptyCount = width - filledCount
  const filledBar = pc.green("█".repeat(filledCount))
  const emptyBar = pc.gray("░".repeat(emptyCount))
  return `[${filledBar}${emptyBar}] ${completed}/${total}`
}

export const formatTaskCard = (
  task: BoardTask,
  isSelected = false,
): readonly string[] => {
  const doc = task.document
  const priority = doc.priority ?? doc.frontmatter.priority ?? "p3"
  const badge = getPriorityBadge(priority)
  const id = doc.id ?? doc.frontmatter.id ?? task.filename
  const title = doc.title ?? doc.frontmatter.title ?? id
  const idStr = pc.bold(id)
  const prefix = isSelected ? pc.cyan("▶ ") : "  "

  const line1 = `${prefix}${badge} ${idStr}`
  const line2 = `   ${title}`

  const completedAc =
    task.document.acceptanceCriteria.filter((c) => c.checked).length
  const totalAc = task.document.acceptanceCriteria.length
  const acBar = totalAc > 0
    ? ` ${renderProgressBar(completedAc, totalAc, 8)}`
    : ""
  const tags = doc.tags ?? doc.frontmatter.tags ?? []
  const tagsStr = tags.length > 0
    ? pc.gray(` [${tags.join(",")}]`)
    : ""

  const assignee = doc.assigned_to ?? doc.frontmatter.assigned_to
  const assigneeStr = assignee != null && assignee !== "" && assignee !== "unassigned"
    ? `${pc.dim(assignee)} `
    : ""

  const line3 = `   ${assigneeStr}${tagsStr}${acBar}`
  return Object.freeze([line1, line2, line3])
}

export const formatBoardStatic = (board: Board): string => {
  const lines: string[] = []
  lines.push(
    pc.bold(
      pc.cyan(
        `\n=== DIRBAN KANBAN BOARD (${board.totalTasks} tasks) ===\n`,
      ),
    ),
  )

  for (const col of board.columns) {
    const colHeader = pc.bold(
      pc.yellow(`■ ${col.name} (${col.tasks.length})`),
    )
    lines.push(colHeader)
    lines.push(pc.gray("─".repeat(50)))

    if (col.tasks.length === 0) {
      lines.push(pc.dim("  (empty)"))
    } else {
      for (const task of col.tasks) {
        const cardLines = formatTaskCard(task)
        lines.push(...cardLines)
        lines.push("")
      }
    }
    lines.push("")
  }

  return lines.join("\n")
}

export const formatTaskDetail = (task: BoardTask): string => {
  const doc = task.document
  const fm = task.document.frontmatter
  const priority = doc.priority ?? fm.priority ?? "p3"
  const title = doc.title ?? fm.title ?? task.filename
  const id = doc.id ?? fm.id ?? task.filename
  const lines: string[] = []

  lines.push(
    pc.bold(
      pc.cyan(`\n═══════════════════════════════════════════════════════`),
    ),
  )
  lines.push(
    `${getPriorityBadge(priority)} ${pc.bold(pc.white(title))} (${
      pc.green(id)
    })`,
  )
  lines.push(pc.gray(`Path: ${task.filePath}`))
  lines.push(
    pc.bold(
      pc.cyan(`───────────────────────────────────────────────────────`),
    ),
  )

  lines.push(`${pc.bold("Column:")}      ${task.column}`)
  if (doc.owner != null && doc.owner !== "") {
    lines.push(`${pc.bold("Owner:")}       ${doc.owner}`)
  }
  if (doc.assigned_to != null && doc.assigned_to !== "" && doc.assigned_to !== "unassigned") {
    lines.push(`${pc.bold("Assigned:")}    ${doc.assigned_to}`)
  }
  if (doc.created_date != null && doc.created_date !== "") {
    lines.push(`${pc.bold("Created:")}     ${doc.created_date}`)
  }
  if (doc.last_updated != null && doc.last_updated !== "") {
    lines.push(`${pc.bold("Updated:")}     ${doc.last_updated}`)
  }
  const tags = doc.tags ?? fm.tags ?? []
  if (tags.length > 0) {
    lines.push(`${pc.bold("Tags:")}        ${tags.join(", ")}`)
  }

  if (fm.relationships?.depends_on != null && fm.relationships.depends_on.length > 0) {
    lines.push(
      `${pc.bold("Depends On:")}  ${
        fm.relationships.depends_on.join(", ")
      }`,
    )
  }
  if (fm.relationships?.blocks != null && fm.relationships.blocks.length > 0) {
    lines.push(
      `${pc.bold("Blocks:")}      ${fm.relationships.blocks.join(", ")}`,
    )
  }

  if (task.document.objectiveScope !== "") {
    lines.push(`\n${pc.bold("Objective & Scope:")}`)
    lines.push(task.document.objectiveScope)
  }

  lines.push(`\n${pc.bold("Acceptance Criteria:")}`)
  const acList = task.document.acceptanceCriteria
  if (acList.length === 0) {
    lines.push(pc.dim("  (none defined)"))
  } else {
    const completed = acList.filter((a) => a.checked).length
    lines.push(`  Progress: ${renderProgressBar(completed, acList.length, 16)}`)
    for (const item of acList) {
      const box = item.checked ? pc.green("[x]") : pc.red("[ ]")
      lines.push(`  ${box} #${item.index}: ${item.text}`)
    }
  }

  if (task.document.executionJournal.length > 0) {
    lines.push(`\n${pc.bold("Execution Journal:")}`)
    for (const journalEntry of task.document.executionJournal) {
      lines.push(`  ${journalEntry}`)
    }
  }

  lines.push(
    pc.bold(
      pc.cyan(`═══════════════════════════════════════════════════════\n`),
    ),
  )
  return lines.join("\n")
}

export const formatCurrentTaskView = (task: BoardTask): string => {
  const doc = task.document
  const fm = doc.frontmatter
  const priority = doc.priority ?? fm.priority ?? "p3"
  const title = doc.title ?? fm.title ?? task.filename
  const id = doc.id ?? fm.id ?? task.filename
  const lines: string[] = []

  lines.push(
    `${getPriorityBadge(priority)} ${pc.bold(pc.white(title))} (${pc.green(id)})`,
  )
  lines.push(pc.gray(`Column: ${task.column} | Path: ${task.filePath}`))

  const acList = doc.acceptanceCriteria
  lines.push(`\n${pc.bold("Acceptance Criteria:")}`)
  if (acList.length === 0) {
    lines.push(pc.dim("  (none defined)"))
  } else {
    const completed = acList.filter((a) => a.checked).length
    lines.push(`  Progress: ${renderProgressBar(completed, acList.length, 16)}`)
    for (const item of acList) {
      const box = item.checked ? pc.green("[x]") : pc.red("[ ]")
      lines.push(`  ${box} #${item.index}: ${item.text}`)
    }
  }

  return lines.join("\n")
}

export const formatPlanView = (
  plan: {
    readonly ready: readonly {
      readonly task: BoardTask
      readonly evaluation: { readonly resolved: readonly string[] }
    }[]
    readonly blocked: readonly {
      readonly task: BoardTask
      readonly evaluation: { readonly unresolved: readonly string[] }
    }[]
    readonly totalBacklog: number
  },
): string => {
  const lines: string[] = []

  lines.push(
    pc.bold(
      pc.cyan(`\n=== DIRBAN PLANNING & TRIAGE (${plan.totalBacklog} backlog tasks) ===\n`),
    ),
  )

  // Ready section
  lines.push(pc.bold(pc.green(`✔ Ready to Promote (${plan.ready.length}):`)))
  lines.push(pc.gray("─".repeat(50)))
  if (plan.ready.length === 0) {
    lines.push(pc.dim("  (no unblocked tasks in backlog)"))
  } else {
    for (const item of plan.ready) {
      const priority = item.task.document.priority ?? "p3"
      const badge = getPriorityBadge(priority)
      const idStr = pc.bold(item.task.document.id)
      const title = item.task.document.title
      lines.push(`  ${badge} ${idStr} - ${title}`)
      if (item.evaluation.resolved.length > 0) {
        lines.push(
          pc.gray(`     Dependencies resolved: [${item.evaluation.resolved.join(", ")}]`),
        )
      }
    }
  }

  lines.push("")

  // Blocked section
  lines.push(pc.bold(pc.yellow(`⛔ Blocked / In Limbo (${plan.blocked.length}):`)))
  lines.push(pc.gray("─".repeat(50)))
  if (plan.blocked.length === 0) {
    lines.push(pc.dim("  (no blocked tasks in backlog)"))
  } else {
    for (const item of plan.blocked) {
      const priority = item.task.document.priority ?? "p3"
      const badge = getPriorityBadge(priority)
      const idStr = pc.bold(item.task.document.id)
      const title = item.task.document.title
      lines.push(`  ${badge} ${idStr} - ${title}`)
      for (const blocker of item.evaluation.unresolved) {
        lines.push(pc.red(`     ✖ Blocked by: ${blocker}`))
      }
    }
  }

  lines.push("")
  lines.push(pc.gray("Promote an unblocked task with:"))
  lines.push(pc.cyan("  dirban plan --promote=<id>"))
  lines.push(pc.gray("Unblock reasons with:"))
  lines.push(pc.cyan("  dirban unblock <id> [reason]"))
  lines.push("")

  return lines.join("\n")
}
