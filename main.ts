#!/usr/bin/env bun
import { parseArgs } from "node:util"
import * as process from "node:process"
import { spawn } from "node:child_process"
import pc from "picocolors"
import { loadConfig } from "./src/config/config.ts"
import { discoverBoard, findTaskByIdOrName } from "./src/board/discovery.ts"
import { formatBoardStatic, formatTaskDetail } from "./src/cli/formatters.ts"
import { startInteractiveTui } from "./src/cli/tui.ts"
import { moveTask } from "./src/operations/move.ts"
import { checkTaskItem } from "./src/operations/check.ts"
import { setTaskMetadata } from "./src/operations/set.ts"
import { archiveTasks } from "./src/operations/archive.ts"
import type { Priority } from "./src/okf/types.ts"

const PRINT_HELP = () => {
  console.log(`
${
    pc.bold(pc.cyan("Dirban (dirban)"))
  } - Zero-Database, Agent-Native Kanban Backed by Git & OKF

${pc.bold("USAGE:")}
  dirban [command] [options]

${pc.bold("COMMANDS:")}
  board                 Display kanban board (Interactive TUI by default in TTY, or static table)
  move <id> <column>    Atomically move a task to target column and record journal
  view <id>             Inspect task metadata, relationships, and acceptance criteria
  check <id> <index>    Toggle acceptance criteria checkbox item (1-based index)
  set <id> [options]    Mutate task frontmatter (priority, assignee, owner, tags)
  archive [<id>|all]    Archive completed tasks to archive/YYYY/
  help                  Show this help message

${pc.bold("BOARD OPTIONS:")}
  --static              Force static output instead of launching interactive TUI
  --tag=<tag>           Filter tasks by tag
  --owner=<owner>       Filter tasks by owner or assignee
  --search=<query>      Search keyword in title, ID, or body
  --sort=<mode>         Sort mode: priority (default), recency, id

${pc.bold("SET OPTIONS:")}
  --priority=<p0..p3>   Update task priority
  --assignee=<user>     Assign task to user
  --owner=<owner>       Update task owner (developer | agent | unassigned)
  --title=<title>       Update task title
  --tags=<tag1,tag2>    Set comma-separated tags

${pc.bold("EXAMPLES:")}
  dirban board
  dirban board --static
  dirban move 26-001 02-in-progress
  dirban check 26-001 2
  dirban set 26-001 --priority=p0 --assignee=andrew
  dirban archive all
`)
}

export const runCli = async (args: readonly string[]): Promise<number> => {
  const { values: flags, positionals } = parseArgs({
    args: [...args],
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      static: { type: "boolean", short: "s" },
      open: { type: "boolean" },
      tag: { type: "string" },
      owner: { type: "string" },
      search: { type: "string" },
      sort: { type: "string" },
      priority: { type: "string" },
      assignee: { type: "string" },
      title: { type: "string" },
      tags: { type: "string" },
    },
    allowPositionals: true,
  })

  if (flags.help || positionals[0] === "help") {
    PRINT_HELP()
    return 0
  }

  if (flags.version) {
    console.log("dirban v0.1.0 (Phase 1)")
    return 0
  }

  const configRes = loadConfig()
  if (configRes.isErr()) {
    console.error(pc.red(`Configuration Error: ${configRes.error.message}`))
    return 1
  }
  const config = configRes.value

  const command = positionals[0] || "board"

  if (command === "board") {
    if (!flags.static && process.stdin.isTTY) {
      await startInteractiveTui(config)
      return 0
    }

    const sortMode = flags.sort === "recency" || flags.sort === "id"
      ? flags.sort
      : "priority"
    const boardRes = discoverBoard(config, process.cwd(), {
      tag: flags.tag,
      owner: flags.owner,
      search: flags.search,
      sortMode,
    })

    if (boardRes.isErr()) {
      console.error(pc.red(`Board Error: ${boardRes.error.message}`))
      return 1
    }

    console.log(formatBoardStatic(boardRes.value))
    return 0
  }

  if (command === "view") {
    const taskId = positionals[1]
    if (taskId == null || taskId.trim() === "") {
      console.error(
        pc.red("Error: Missing task ID. Usage: dirban view <id>"),
      )
      return 1
    }

    const boardRes = discoverBoard(config)
    if (boardRes.isErr()) {
      console.error(pc.red(`Board Error: ${boardRes.error.message}`))
      return 1
    }

    const task = findTaskByIdOrName(boardRes.value, taskId)
    if (task == null) {
      console.error(pc.red(`Task not found: ${taskId}`))
      return 1
    }

    console.log(formatTaskDetail(task))

    if (flags.open) {
      const editor = process.env.EDITOR || "code"
      await new Promise<void>((resolve) => {
        const child = spawn(editor, [task.filePath], { stdio: "inherit" })
        child.on("close", () => resolve())
      })
    }
    return 0
  }

  if (command === "move") {
    const taskId = positionals[1]
    const targetCol = positionals[2]

    if (taskId == null || targetCol == null) {
      console.error(
        pc.red("Error: Usage: dirban move <id> <target-column>"),
      )
      return 1
    }

    const boardRes = discoverBoard(config)
    if (boardRes.isErr()) {
      console.error(pc.red(`Board Error: ${boardRes.error.message}`))
      return 1
    }

    const moveRes = moveTask(boardRes.value, taskId, targetCol)
    if (moveRes.isErr()) {
      console.error(pc.red(`Move Error: ${moveRes.error.message}`))
      return 1
    }

    console.log(
      pc.green(
        `✔ Moved task ${moveRes.value.document.frontmatter.id} to ${moveRes.value.column}`,
      ),
    )
    return 0
  }

  if (command === "check") {
    const taskId = positionals[1]
    const indexStr = positionals[2]

    if (taskId == null || indexStr == null) {
      console.error(pc.red("Error: Usage: dirban check <id> <index>"))
      return 1
    }

    const index = parseInt(indexStr, 10)
    if (isNaN(index)) {
      console.error(pc.red("Error: Index must be a valid number"))
      return 1
    }

    const boardRes = discoverBoard(config)
    if (boardRes.isErr()) {
      console.error(pc.red(`Board Error: ${boardRes.error.message}`))
      return 1
    }

    const checkRes = checkTaskItem(boardRes.value, taskId, index)
    if (checkRes.isErr()) {
      console.error(pc.red(`Check Error: ${checkRes.error.message}`))
      return 1
    }

    const targetAc = checkRes.value.document.acceptanceCriteria.find((a) =>
      a.index === index
    )
    const stateStr = targetAc?.checked ? pc.green("[x]") : pc.red("[ ]")
    console.log(
      pc.green(
        `✔ Updated criterion #${index} to ${stateStr} for task ${checkRes.value.document.frontmatter.id}`,
      ),
    )
    return 0
  }

  if (command === "set") {
    const taskId = positionals[1]
    if (taskId == null) {
      console.error(pc.red("Error: Usage: dirban set <id> [options]"))
      return 1
    }

    const boardRes = discoverBoard(config)
    if (boardRes.isErr()) {
      console.error(pc.red(`Board Error: ${boardRes.error.message}`))
      return 1
    }

    const tags = flags.tags != null
      ? flags.tags.split(",").map((t) => t.trim()).filter((t) => t !== "")
      : undefined
    const priority = flags.priority as Priority | undefined

    const setRes = setTaskMetadata(boardRes.value, taskId, {
      priority,
      assignee: flags.assignee,
      owner: flags.owner,
      title: flags.title,
      tags,
    })

    if (setRes.isErr()) {
      console.error(pc.red(`Set Error: ${setRes.error.message}`))
      return 1
    }

    console.log(
      pc.green(
        `✔ Updated metadata for ${setRes.value.document.frontmatter.id}`,
      ),
    )
    return 0
  }

  if (command === "archive") {
    const target = positionals[1] || "all"

    const boardRes = discoverBoard(config)
    if (boardRes.isErr()) {
      console.error(pc.red(`Board Error: ${boardRes.error.message}`))
      return 1
    }

    const archiveRes = archiveTasks(boardRes.value, config, target)
    if (archiveRes.isErr()) {
      console.error(pc.red(`Archive Error: ${archiveRes.error.message}`))
      return 1
    }

    console.log(
      pc.green(
        `✔ Successfully archived ${archiveRes.value.archivedTasks.length} task(s) to ${archiveRes.value.targetDirectory}`,
      ),
    )
    return 0
  }

  console.error(
    pc.red(
      `Unknown command: ${command}. Run "dirban --help" for available commands.`,
    ),
  )
  return 1
}

// Bun / Node main execution check
if (import.meta.main || process.argv[1]?.endsWith("main.ts")) {
  const exitCode = await runCli(process.argv.slice(2))
  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}
