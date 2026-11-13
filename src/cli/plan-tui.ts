import * as process from "node:process"
import pc from "picocolors"
import { discoverBoard } from "../board/discovery.ts"
import type { DirbanConfig } from "../config/types.ts"
import { unblockTask } from "../tasks/planning/block.ts"
import { partitionBacklog, promoteTasks } from "../tasks/planning/plan.ts"
import { getPriorityBadge } from "./formatters.ts"

export const startInteractivePlanTui = async (
  config: DirbanConfig,
  workspaceRoot: string = process.cwd(),
): Promise<void> => {
  if (!process.stdin.isTTY) {
    console.error("Standard input is not a terminal TTY.")
    return
  }

  const boardRes = discoverBoard(config, workspaceRoot)
  if (boardRes.isErr()) {
    console.error("Failed to load board:", boardRes.error)
    return
  }

  let board = boardRes.value
  let plan = partitionBacklog(board)
  let selectedIndex = 0
  const selectedTaskIds = new Set<string>()
  let statusMessage = ""

  // Flatten items for list selection
  const getItems = () => [
    ...plan.ready.map((item) => ({ ...item, type: "ready" as const })),
    ...plan.blocked.map((item) => ({ ...item, type: "blocked" as const })),
  ]

  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding("utf8")

  const clearScreen = () => {
    process.stdout.write("\x1b[2J\x1b[H")
  }

  const render = () => {
    clearScreen()
    const items = getItems()

    console.log(
      pc.bold(pc.cyan(`\n=== DIRBAN INTERACTIVE PLANNER (${plan.totalBacklog} backlog tasks) ===`)),
    )
    console.log(
      pc.gray(
        "↑/↓: Navigate | Space: Toggle select | p: Promote (selected/current) | u: Unblock | q: Quit\n",
      ),
    )

    if (statusMessage !== "") {
      console.log(`  ${statusMessage}\n`)
    }

    if (items.length === 0) {
      console.log(pc.dim("  (Backlog is empty)"))
      return
    }

    items.forEach((item, index) => {
      const isCursor = index === selectedIndex
      const taskId = item.task.document.id
      const isMarked = selectedTaskIds.has(taskId)

      const pointer = isCursor ? pc.cyan("▶") : " "
      const checkbox = isMarked ? pc.green("[✔]") : pc.gray("[ ]")
      const priority = item.task.document.priority ?? "p3"
      const badge = getPriorityBadge(priority)
      const id = pc.bold(taskId)
      const title = item.task.document.title
      const statusIcon = item.type === "ready" ? pc.green("✔") : pc.red("✖")

      console.log(`${pointer} ${checkbox} ${statusIcon} ${badge} ${id} - ${title}`)
      if (item.type === "blocked") {
        for (const blocker of item.evaluation.unresolved) {
          console.log(pc.red(`         Blocked by: ${blocker}`))
        }
      } else if (item.evaluation.resolved.length > 0) {
        console.log(pc.gray(`         Resolved: [${item.evaluation.resolved.join(", ")}]`))
      }
    })

    console.log(pc.gray(`\n${"─".repeat(50)}`))
  }

  render()

  return new Promise((resolve) => {
    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.removeListener("data", onKey)
      clearScreen()
      resolve()
    }

    const onKey = (key: string) => {
      const items = getItems()

      // Ctrl+C or 'q' to quit
      if (key === "\u0003" || key === "q" || key === "Q") {
        cleanup()
        return
      }

      // Up arrow or 'k'
      if (key === "\u001b[A" || key === "k") {
        if (selectedIndex > 0) {
          selectedIndex -= 1
        }
        render()
        return
      }

      // Down arrow or 'j'
      if (key === "\u001b[B" || key === "j") {
        if (selectedIndex < items.length - 1) {
          selectedIndex += 1
        }
        render()
        return
      }

      // Space to toggle select
      if (key === " ") {
        const selected = items[selectedIndex]
        if (selected != null) {
          const id = selected.task.document.id
          if (selectedTaskIds.has(id)) {
            selectedTaskIds.delete(id)
          } else {
            selectedTaskIds.add(id)
          }
          render()
        }
        return
      }

      // 'p' or 'P' to promote (selected batch or current item)
      if (key === "p" || key === "P") {
        const ids =
          selectedTaskIds.size > 0
            ? Array.from(selectedTaskIds)
            : items[selectedIndex] != null
              ? [items[selectedIndex].task.document.id]
              : []

        if (ids.length === 0) return

        const batchRes = promoteTasks(board, config, ids)
        const promotedCount = batchRes.promoted.length
        const failedCount = batchRes.failed.length

        if (promotedCount > 0 && failedCount === 0) {
          statusMessage = pc.green(`✔ Successfully promoted ${promotedCount} task(s)!`)
          selectedTaskIds.clear()
        } else if (promotedCount > 0 && failedCount > 0) {
          statusMessage = pc.yellow(
            `✔ Promoted ${promotedCount} task(s), but ${failedCount} failed (${batchRes.failed.map((f) => f.taskId).join(", ")})`,
          )
          for (const item of batchRes.promoted) {
            selectedTaskIds.delete(item.task.document.id)
          }
        } else {
          statusMessage = pc.red(
            `✖ Promotion failed: ${batchRes.failed.map((f) => `${f.taskId} (${f.error.message})`).join("; ")}`,
          )
        }

        const updatedBoard = discoverBoard(config, workspaceRoot)
        if (updatedBoard.isOk()) {
          board = updatedBoard.value
          plan = partitionBacklog(board)
          if (selectedIndex >= getItems().length) {
            selectedIndex = Math.max(0, getItems().length - 1)
          }
        }

        render()
        return
      }

      // 'u' or 'U' to unblock
      if (key === "u" || key === "U") {
        const selected = items[selectedIndex]
        if (selected == null || selected.type !== "blocked") {
          statusMessage = pc.yellow("Selected task is not blocked.")
          render()
          return
        }

        // Attempt automatic unblock of first unresolved blocker
        const firstBlocker = selected.evaluation.unresolved[0]
        const unblockRes = unblockTask(board, selected.task.document.id, firstBlocker)
        if (unblockRes.isErr()) {
          statusMessage = pc.red(`Unblock failed: ${unblockRes.error.message}`)
        } else {
          statusMessage = pc.green(
            `✔ Cleared blocker "${firstBlocker}" from ${selected.task.document.id}`,
          )
          const updatedBoard = discoverBoard(config, workspaceRoot)
          if (updatedBoard.isOk()) {
            board = updatedBoard.value
            plan = partitionBacklog(board)
          }
        }
        render()
        return
      }
    }

    process.stdin.on("data", onKey)
  })
}
