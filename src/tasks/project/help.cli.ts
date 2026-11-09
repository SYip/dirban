import pc from "picocolors"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"

export const printHelp = (): void => {
  console.log(`
${
    pc.bold(pc.cyan("Dirban (dirban)"))
  } - Zero-Database, Agent-Native Kanban Backed by Git & OKF

${pc.bold("USAGE:")}
  dirban [command] [options]

${pc.bold("COMMANDS (Filesystem / Core):")}
  init                  Initialize board directory structure (backlog, 01-todo, 02-doing, 03-done, archive)
  board                 Display kanban board (Interactive TUI by default in TTY, or static table)
  next [options]        Show next recommended task from todo queue (supports --raw)
  current [id]          Show active task (alias: focus). Detects git branch/worktree or 02-doing
  ready <id...>         Move unblocked backlog task(s) to todo queue
  new <title>           Create a new task with auto-assigned YY-001 ID (alias: create)
  next-id               Print the next available task ID for the current year
  priorities            List available task priority levels and highlight the default
  move <id> <column>    Atomically move a task to target column and record journal
  view <id>             Inspect task metadata, relationships, and acceptance criteria
  check <id> <index>    Toggle acceptance criteria checkbox item (1-based index)
  set <id> [options]    Mutate task frontmatter (priority, assignee, owner, tags)
  archive [<id>|all]    Archive completed tasks directly to archive/
  plan [options]        View backlog triage and planning (options: --unblocked, --blocked, -i)
  block <id> <reasons>  Record blocker reasons / task dependencies and demote to backlog
  unblock <id> [reason] Remove a resolved blocker from a task
  help                  Show this help message

${pc.bold("COMMANDS (Git & Worktree Integration):")}
  start <id>            Start work on task (alias: worktree add). Moves to 02-doing & provisions branch/worktree
  done [id]             Finish task (alias: finish). Moves to 03-done & merges branch/worktree if in git
  path [id|main]        Print absolute filesystem path of a task worktree or main repository

${pc.bold("CURRENT OPTIONS:")}
  --raw                 Print raw Markdown content to stdout for AI agent piping

${pc.bold("START OPTIONS:")}
  --checkout            Create/checkout in-place task branch (default if configured)
  --worktree            Create isolated sibling git worktree

${pc.bold("NEW / CREATE OPTIONS:")}
  --column=<column>     Target column (defaults to backlog or first column)
  --priority=<level>    Task priority (defaults to configured default priority)
  --tags=<tag1,tag2>    Comma-separated list of tags
  --assignee=<user>     Assignee name

${pc.bold("BOARD OPTIONS:")}
  --static              Force static output instead of launching interactive TUI
  --tag=<tag>           Filter tasks by tag
  --owner=<owner>       Filter tasks by owner or assignee
  --search=<query>      Search keyword in title, ID, or body
  --sort=<mode>         Sort mode: priority (default), recency, id

${pc.bold("PLAN OPTIONS:")}
  -u, --unblocked       List only unblocked backlog tasks ready to be scheduled (alias: --no-blocked)
  -b, --blocked         List only currently blocked backlog tasks and blocking sources
  -i, --interactive     Launch interactive terminal planner to triage tasks

${pc.bold("SET OPTIONS:")}
  --priority=<p0..p3>   Update task priority
  --assignee=<user>     Assign task to user
  --owner=<owner>       Update task owner (developer | agent | unassigned)
  --title=<title>       Update task title
  --tags=<tag1,tag2>    Set comma-separated tags

${pc.bold("EXAMPLES:")}
  dirban next-id
  dirban new "Implement search filter"
  dirban new "Fix login bug" --priority=p0 --column=01-ready
  dirban board
  dirban move 26-001 02-in-progress
  dirban check 26-001 2
  dirban set 26-001 --priority=p0 --assignee=andrew
  dirban archive all
`)
}

export const handleHelp: CommandHandler = () => {
  printHelp()
  return 0
}

export const helpCommand: CommandDefinition = {
  name: "help",
  aliases: ["--help", "-h"],
  summary: "Show general help or command-specific usage",
  usage: "dirban help [command]\n       dirban <command> --help",
  options: [],
  examples: [
    "dirban help",
    "dirban help plan",
    "dirban start --help",
  ],
  requiresTasksDir: false,
  execute: handleHelp,
}
