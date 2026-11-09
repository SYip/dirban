import * as process from "node:process"
import { spawn } from "node:child_process"
import pc from "picocolors"
import { discoverBoard, findTaskWithFuzzy } from "./discovery.ts"
import { formatBoardStatic, formatTaskDetail } from "../cli/formatters.ts"
import { startInteractiveTui } from "../cli/tui.ts"
import type { CommandDefinition, CommandHandler } from "../cli/types.ts"

export const handleBoard: CommandHandler = async (ctx) => {
  if (!ctx.flags.static && process.stdin.isTTY) {
    await startInteractiveTui(ctx.config)
    return 0
  }

  const sortMode = ctx.flags.sort === "recency" || ctx.flags.sort === "id"
    ? ctx.flags.sort
    : "priority"
  const boardRes = discoverBoard(ctx.config, ctx.cwd, {
    tag: ctx.flags.tag,
    owner: ctx.flags.owner,
    search: ctx.flags.search,
    sortMode,
  })

  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  console.log(formatBoardStatic(boardRes.value))
  return 0
}

export const handleView: CommandHandler = async (ctx) => {
  const taskId = ctx.positionals[1]
  if (taskId == null || taskId.trim() === "") {
    console.error(
      pc.red("Error: Missing task ID. Usage: dirban view <id>"),
    )
    return 1
  }

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const lookupResult = findTaskWithFuzzy(boardRes.value, taskId)
  if (lookupResult.kind === "NOT_FOUND") {
    console.error(pc.red(`Task not found: ${taskId}`))
    return 1
  }

  if (lookupResult.kind === "AMBIGUOUS") {
    console.error(
      pc.yellow(
        `Ambiguous task query "${taskId}". Multiple tasks matched:\n` +
        lookupResult.matches.map((m) => `  - ${pc.bold(m.document.id)}: ${m.document.title} (${pc.dim(m.column)})`).join("\n") +
        `\nPlease specify a more precise task ID or filename.`,
      ),
    )
    return 1
  }

  const task = lookupResult.task

  console.log(formatTaskDetail(task))

  if (ctx.flags.open) {
    const editor = process.env.EDITOR || "code"
    await new Promise<void>((resolve) => {
      const child = spawn(editor, [task.filePath], { stdio: "inherit" })
      child.on("close", () => resolve())
    })
  }
  return 0
}

export const boardCommand: CommandDefinition = {
  name: "board",
  summary: "Display kanban board (Interactive TUI by default in TTY, or static table)",
  usage: "dirban board [options]",
  options: [
    { flag: "--static, -s", description: "Force static output instead of launching interactive TUI" },
    { flag: "--tag=<tag>", description: "Filter tasks by tag" },
    { flag: "--owner=<owner>", description: "Filter tasks by owner or assignee" },
    { flag: "--search=<query>", description: "Search keyword in title, ID, or body" },
    { flag: "--sort=<mode>", description: "Sort mode: priority (default), recency, id" },
  ],
  examples: [
    "dirban board",
    "dirban board --static",
    "dirban board --tag=cli --sort=recency",
  ],
  requiresTasksDir: true,
  execute: handleBoard,
}

export const viewCommand: CommandDefinition = {
  name: "view",
  summary: "Inspect task metadata, relationships, and acceptance criteria",
  usage: "dirban view <id|fuzzy-slug> [options]",
  options: [
    { flag: "--open", description: "Open the task Markdown file in your default editor ($EDITOR or code)" },
  ],
  examples: [
    "dirban view 26-001",
    "dirban view search-filter",
    "dirban view 26-001 --open",
  ],
  requiresTasksDir: true,
  execute: handleView,
}

