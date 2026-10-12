import pc from "picocolors"
import * as process from "node:process"
import type { DirbanConfig } from "../config/types.ts"
import { discoverBoard } from "../board/discovery.ts"
import type { BoardTask } from "../board/types.ts"
import { checkTaskItem } from "../operations/check.ts"
import { moveTask } from "../operations/move.ts"
import { formatTaskDetail, getPriorityBadge } from "./formatters.ts"

interface TuiState {
  columnIndex: number
  taskIndex: number
  detailOverlay: boolean
}

export const startInteractiveTui = async (
  config: DirbanConfig,
  workspaceRoot: string = process.cwd(),
): Promise<void> => {
  if (!process.stdin.isTTY) {
    console.error(
      "Standard input is not a terminal TTY. Run with --static instead.",
    )
    return
  }

  let boardResult = discoverBoard(config, workspaceRoot)
  if (boardResult.isErr()) {
    console.error("Failed to load board:", boardResult.error)
    return
  }

  let board = boardResult.value
  const state: TuiState = {
    columnIndex: 0,
    taskIndex: 0,
    detailOverlay: false,
  }

  // Raw mode for direct keystroke listening
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding("utf8")

  const clearScreen = () => {
    // ESC [ 2J (clear screen), ESC [ H (cursor home)
    process.stdout.write("\x1b[2J\x1b[H")
  }

  const render = () => {
    clearScreen()

    if (state.detailOverlay) {
      const col = board.columns[state.columnIndex]
      const currentTask = col?.tasks[state.taskIndex]
      if (currentTask != null) {
        console.log(formatTaskDetail(currentTask))
        console.log(
          pc.dim("Press [ESC], [Enter], or [v] to return to board."),
        )
      } else {
        state.detailOverlay = false
      }
      return
    }

    const { columns, totalTasks } = board
    const termCols = process.stdout.columns || 120
    const termRows = process.stdout.rows || 30

    console.log(
      pc.bold(
        pc.cyan(`=== DIRBAN KANBAN (${totalTasks} tasks) ===`),
      ) +
        pc.gray(
          "  [←/→/h/l: Column] [↑/↓/j/k: Task] [m: Move] [Space: Check] [v/Enter: Full View] [q: Quit]",
        ),
    )
    console.log("")

    const numCols = Math.max(columns.length, 1)
    const gap = 1
    const totalGaps = (numCols - 1) * gap
    const usableWidth = Math.max(termCols - totalGaps, numCols * 18)

    // Dynamic column widths:
    // If screen is narrow (< 130 cols), expand the active column to ~40-45% width
    const colWidths: number[] = []
    if (usableWidth < 130 && numCols > 1) {
      const activeWidth = Math.min(
        Math.floor(usableWidth * 0.42),
        usableWidth - (numCols - 1) * 18,
      )
      const inactiveWidth = Math.max(
        Math.floor((usableWidth - activeWidth) / (numCols - 1)),
        18,
      )
      for (let i = 0; i < numCols; i++) {
        colWidths.push(i === state.columnIndex ? activeWidth : inactiveWidth)
      }
    } else {
      const equalWidth = Math.max(Math.floor(usableWidth / numCols), 20)
      for (let i = 0; i < numCols; i++) {
        colWidths.push(equalWidth)
      }
    }

    const stripAnsi = (str: string): string =>
      str.replace(/\x1b\[[0-9;]*m/g, "")

    const padOrTruncate = (str: string, width: number): string => {
      const stripped = stripAnsi(str)
      if (stripped.length > width) {
        return stripped.slice(0, Math.max(width - 1, 0)) + "…"
      }
      return str + " ".repeat(Math.max(width - stripped.length, 0))
    }

    // Available vertical rows for the card viewport (excluding title, header, preview pane)
    const previewPaneHeight = 6
    const topBarHeight = 3
    const maxViewportLines = Math.max(
      termRows - previewPaneHeight - topBarHeight - 2,
      6,
    )

    // Lines per card = 3 (top line, title line, divider)
    const LINES_PER_CARD = 3
    const maxVisibleCards = Math.max(
      Math.floor((maxViewportLines - 2) / LINES_PER_CARD),
      1,
    )

    // Build headers and windowed body lines for each column
    const headerLines: string[][] = []
    const viewportLines: string[][] = []

    for (let cIdx = 0; cIdx < columns.length; cIdx++) {
      const col = columns[cIdx]
      const colW = colWidths[cIdx] ?? 20
      const isCurrentCol = cIdx === state.columnIndex

      if (col == null) {
        headerLines.push(["", ""])
        viewportLines.push([])
        continue
      }

      // Sticky Header
      const headerText = ` ${col.name} (${col.tasks.length}) `
      const headerBox = isCurrentCol
        ? pc.bold(
          pc.bgCyan(
            pc.black(padOrTruncate(`▶${headerText}`, colW)),
          ),
        )
        : pc.bold(pc.yellow(padOrTruncate(`■${headerText}`, colW)))

      const headerBorder = pc.gray("─".repeat(colW))
      headerLines.push([headerBox, headerBorder])

      // Windowed cards
      const colBodyLines: string[] = []
      if (col.tasks.length === 0) {
        colBodyLines.push(padOrTruncate(pc.dim(" (empty)"), colW))
      } else {
        // Calculate scroll offset for this column
        const currentTaskIdx = isCurrentCol ? state.taskIndex : 0
        let scrollOffset = 0
        if (col.tasks.length > maxVisibleCards) {
          if (currentTaskIdx >= maxVisibleCards) {
            scrollOffset = currentTaskIdx - maxVisibleCards + 1
          }
        }

        const visibleTasks = col.tasks.slice(
          scrollOffset,
          scrollOffset + maxVisibleCards,
        )
        const hiddenAbove = scrollOffset
        const hiddenBelow = col.tasks.length -
          (scrollOffset + visibleTasks.length)

        if (hiddenAbove > 0) {
          colBodyLines.push(
            pc.cyan(padOrTruncate(` ▲ ${hiddenAbove} more above`, colW)),
          )
        }

        for (let idx = 0; idx < visibleTasks.length; idx++) {
          const task = visibleTasks[idx]
          if (task == null) continue

          const actualIdx = scrollOffset + idx
          const isCurrentTask = isCurrentCol && actualIdx === state.taskIndex
          const badge = getPriorityBadge(task.document.frontmatter.priority)
          const id = task.document.frontmatter.id.replace(
            /^task\.[^.]+\.[^.]+\./,
            "",
          )
          const ac = task.document.acceptanceCriteria
          const acDone = ac.filter((x) => x.checked).length
          const acStr = ac.length > 0 ? ` ${acDone}/${ac.length}` : ""

          const titlePrefix = isCurrentTask ? pc.cyan("▶ ") : "  "
          const topCardLine = `${titlePrefix}${badge} ${id}${acStr}`
          const titleLine = `   ${task.document.frontmatter.title}`

          if (isCurrentTask) {
            colBodyLines.push(
              pc.bold(
                pc.bgBlack(padOrTruncate(topCardLine, colW)),
              ),
            )
            colBodyLines.push(
              pc.bold(
                pc.bgBlack(padOrTruncate(titleLine, colW)),
              ),
            )
          } else {
            colBodyLines.push(padOrTruncate(topCardLine, colW))
            colBodyLines.push(pc.dim(padOrTruncate(titleLine, colW)))
          }
          colBodyLines.push(
            pc.gray(
              padOrTruncate("  · · · · · · · · · · · · · ·", colW),
            ),
          )
        }

        if (hiddenBelow > 0) {
          colBodyLines.push(
            pc.cyan(padOrTruncate(` ▼ ${hiddenBelow} more below`, colW)),
          )
        }
      }

      viewportLines.push(colBodyLines)
    }

    // 1. Print Sticky Column Headers (Row 0: title box, Row 1: divider border)
    for (let hRow = 0; hRow < 2; hRow++) {
      const hParts: string[] = []
      for (let cIdx = 0; cIdx < numCols; cIdx++) {
        hParts.push(headerLines[cIdx]?.[hRow] ?? "")
      }
      console.log(hParts.join(" "))
    }

    // 2. Print Windowed Card Rows
    const maxBodyHeight = Math.min(
      Math.max(...viewportLines.map((c) => c.length), 1),
      maxViewportLines,
    )

    for (let row = 0; row < maxBodyHeight; row++) {
      const lineParts: string[] = []
      for (let cIdx = 0; cIdx < numCols; cIdx++) {
        const colW = colWidths[cIdx] ?? 20
        const line = viewportLines[cIdx]?.[row] ?? " ".repeat(colW)
        lineParts.push(line)
      }
      console.log(lineParts.join(" "))
    }

    // Bottom Selected Task Full Preview Pane
    const selectedCol = board.columns[state.columnIndex]
    const selectedTask = selectedCol?.tasks[state.taskIndex]

    console.log(pc.cyan("\n" + "═".repeat(termCols)))
    if (selectedTask != null) {
      const fm = selectedTask.document.frontmatter
      const badge = getPriorityBadge(fm.priority)
      console.log(
        `${badge} ${pc.bold(pc.white(fm.title))} [${
          pc.green(fm.id)
        }]`,
      )
      const tags = fm.tags.length > 0 ? `Tags: ${fm.tags.join(", ")} | ` : ""
      console.log(
        pc.gray(
          `Column: ${selectedTask.column} | Assignee: ${fm.assigned_to} | ${tags}Updated: ${fm.last_updated}`,
        ),
      )

      if (selectedTask.document.acceptanceCriteria.length > 0) {
        const acStr = selectedTask.document.acceptanceCriteria
          .slice(0, 3)
          .map((
            a,
          ) => (a.checked
            ? pc.green(`[✓] #${a.index} ${a.text}`)
            : pc.red(`[ ] #${a.index} ${a.text}`))
          )
          .join("   ")
        console.log(pc.dim("Criteria: ") + acStr)
      }
    } else {
      console.log(pc.dim("No task selected in this column."))
    }
  }

  const reloadBoard = () => {
    boardResult = discoverBoard(config, workspaceRoot)
    if (boardResult.isOk()) {
      board = boardResult.value
      // Clamp taskIndex
      const col = board.columns[state.columnIndex]
      if (col != null && col.tasks.length > 0) {
        if (state.taskIndex >= col.tasks.length) {
          state.taskIndex = col.tasks.length - 1
        }
      } else {
        state.taskIndex = 0
      }
    }
  }

  render()

  return new Promise<void>((resolve) => {
    const onData = (chunk: string | Buffer) => {
      const key = chunk.toString()

      // Exit on q, ESC (single byte 0x1b), or Ctrl+C (0x03)
      if (key === "q" || key === "\u0003") {
        cleanup()
        resolve()
        return
      }

      if (state.detailOverlay) {
        if (key === "\u001b" || key === "\r" || key === "\n" || key === "v") {
          state.detailOverlay = false
          render()
        }
        return
      }

      const col = board.columns[state.columnIndex]
      const currentTask: BoardTask | undefined = col?.tasks[state.taskIndex]

      // Left column: h or Left arrow (\u001b[D)
      if (key === "h" || key === "\u001b[D") {
        if (state.columnIndex > 0) {
          state.columnIndex -= 1
          state.taskIndex = 0
        }
      } // Right column: l or Right arrow (\u001b[C)
      else if (key === "l" || key === "\u001b[C") {
        if (state.columnIndex < board.columns.length - 1) {
          state.columnIndex += 1
          state.taskIndex = 0
        }
      } // Up card: k or Up arrow (\u001b[A)
      else if (key === "k" || key === "\u001b[A") {
        if (state.taskIndex > 0) {
          state.taskIndex -= 1
        }
      } // Down card: j or Down arrow (\u001b[B)
      else if (key === "j" || key === "\u001b[B") {
        if (col != null && state.taskIndex < col.tasks.length - 1) {
          state.taskIndex += 1
        }
      } // View detail: Enter or v
      else if (key === "\r" || key === "\n" || key === "v") {
        if (currentTask != null) {
          state.detailOverlay = true
        }
      } // Move card: m (cycles to next column or wraps)
      else if (key === "m") {
        if (currentTask != null && board.columns.length > 1) {
          const nextColIndex = (state.columnIndex + 1) % board.columns.length
          const nextCol = board.columns[nextColIndex]
          if (nextCol != null) {
            moveTask(board, currentTask.document.frontmatter.id, nextCol.name)
            reloadBoard()
            state.columnIndex = nextColIndex
            state.taskIndex = nextCol.tasks.length - 1
          }
        }
      } // Toggle checkbox: Space
      else if (key === " ") {
        if (
          currentTask != null &&
          currentTask.document.acceptanceCriteria.length > 0
        ) {
          const firstUnchecked = currentTask.document.acceptanceCriteria.find((
            a,
          ) => !a.checked)
          const targetIndex = firstUnchecked != null ? firstUnchecked.index : 1
          checkTaskItem(board, currentTask.document.frontmatter.id, targetIndex)
          reloadBoard()
        }
      }

      render()
    }

    const cleanup = () => {
      process.stdin.removeListener("data", onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      clearScreen()
    }

    process.stdin.on("data", onData)
  })
}
