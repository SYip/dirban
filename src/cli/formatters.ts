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
  const fm = task.document.frontmatter
  const badge = getPriorityBadge(fm.priority)
  const idStr = pc.bold(fm.id)
  const prefix = isSelected ? pc.cyan("▶ ") : "  "

  const line1 = `${prefix}${badge} ${idStr}`
  const line2 = `   ${fm.title}`

  const completedAc =
    task.document.acceptanceCriteria.filter((c) => c.checked).length
  const totalAc = task.document.acceptanceCriteria.length
  const acBar = totalAc > 0
    ? ` ${renderProgressBar(completedAc, totalAc, 8)}`
    : ""
  const tagsStr = fm.tags.length > 0
    ? pc.gray(` [${fm.tags.join(",")}]`)
    : ""

  const line3 = `   ${pc.dim(fm.assigned_to)}${tagsStr}${acBar}`
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
  const fm = task.document.frontmatter
  const lines: string[] = []

  lines.push(
    pc.bold(
      pc.cyan(`\n═══════════════════════════════════════════════════════`),
    ),
  )
  lines.push(
    `${getPriorityBadge(fm.priority)} ${pc.bold(pc.white(fm.title))} (${
      pc.green(fm.id)
    })`,
  )
  lines.push(pc.gray(`Path: ${task.filePath}`))
  lines.push(
    pc.bold(
      pc.cyan(`───────────────────────────────────────────────────────`),
    ),
  )

  lines.push(`${pc.bold("Column:")}      ${task.column}`)
  lines.push(`${pc.bold("Owner:")}       ${fm.owner}`)
  lines.push(`${pc.bold("Assigned:")}    ${fm.assigned_to}`)
  lines.push(`${pc.bold("Created:")}     ${fm.created_date}`)
  lines.push(`${pc.bold("Updated:")}     ${fm.last_updated}`)
  if (fm.tags.length > 0) {
    lines.push(`${pc.bold("Tags:")}        ${fm.tags.join(", ")}`)
  }

  if (fm.relationships.depends_on.length > 0) {
    lines.push(
      `${pc.bold("Depends On:")}  ${
        fm.relationships.depends_on.join(", ")
      }`,
    )
  }
  if (fm.relationships.blocks.length > 0) {
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
    for (const j of task.document.executionJournal) {
      lines.push(`  ${j}`)
    }
  }

  lines.push(
    pc.bold(
      pc.cyan(`═══════════════════════════════════════════════════════\n`),
    ),
  )
  return lines.join("\n")
}
