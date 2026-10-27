# CLI & Developer Reference

This document provides a comprehensive command reference for the **Dirban (`dirban`)** command-line interface, interactive Terminal UI (TUI), and development tooling.

---

## 1. User CLI Reference (`dirban`)

The `dirban` command provides deterministic, scriptable task and board operations.

### Synopsis

```bash
dirban [command] [options]
```

If run without arguments in an interactive terminal, `dirban` launches the interactive TUI (`dirban board`).

---

### Commands

#### `init`
Initializes the Kanban board directory structure on disk (`backlog/`, `01-todo/`, `02-doing/`, `03-done/`, and `archive/`) and configures settings.

- If `.vscode/` exists in the workspace, it automatically adds `"dirban.*"` settings to `.vscode/settings.json`.
- Otherwise, it creates `.dirban.json`.

```bash
# Auto-detects (.vscode/settings.json if .vscode exists, else .dirban.json)
dirban init

# Explicitly force configuration target
dirban init --config=vscode
dirban init --config=dirban
```

#### `next-id`
Prints the next available sequential task ID formatted as `YY-001` (derived from existing tasks in the workspace for the current year).

```bash
# Print next available ID
dirban next-id
# Output: 26-002
```

#### `priorities`
Lists all configured priority levels and highlights the workspace default priority.

```bash
dirban priorities
# Output:
# Available priorities: p0, p1, p2 (default), p3
```

#### `new "<title>"` (alias: `create`)
Creates a new Markdown task file with an auto-assigned `YY-001` ID, slugified filename, and structured frontmatter.

```bash
# Create a task in the default backlog column
dirban new "Implement search filter across board"

# Create with specific priority and target column
dirban new "Fix critical token expiry bug" --priority=p0 --column=01-todo

# Create with tags and assignee
dirban new "OAuth2 backend integration" --tags=auth,api --assignee=andrew
```

#### `board`
Displays the Kanban board. Launches the interactive TUI if stdin is an interactive TTY, or formats a static table if `--static` is passed.

```bash
# Launch interactive TUI
dirban board

# Render static board table to stdout
dirban board --static

# Filter tasks by tag
dirban board --tag=cli

# Filter tasks by owner or assignee
dirban board --owner=developer
dirban board --owner=agent

# Search keyword across title, ID, or task body
dirban board --search="fuzzy"

# Sort tasks within columns (modes: priority [default], recency, id)
dirban board --sort=recency
dirban board --sort=id
```

#### `view <id>`
Inspects metadata, tags, priority, dependencies, and acceptance criteria checklist for a task.

```bash
dirban view 26-001

# Inspect and open the Markdown file in your default $EDITOR / VS Code
dirban view 26-001 --open
```

#### `move <id> <target-column>`
Atomically moves a task file to the target column directory and records the transition journal.

```bash
dirban move 26-001 02-in-progress
dirban move 26-001 03-done
```

> **Note**: Because the directory *is* the state, you can also move tasks using standard Unix commands:
> ```bash
> mv docs/tasks/01-ready/26-001-task.md docs/tasks/02-in-progress/
> ```

#### `check <id> <index>`
Toggles an acceptance criteria checklist item (`- [ ]` $\leftrightarrow$ `- [x]`) by its 1-based index.

```bash
# Toggles the 1st checkbox in task 26-001
dirban check 26-001 1
```

#### `set <id> [options]`
Mutates frontmatter metadata for a task while preserving all body content and structure.

```bash
# Set priority (p0, p1, p2, p3)
dirban set 26-001 --priority=p0

# Set assignee or owner
dirban set 26-001 --assignee=andrew
dirban set 26-001 --owner=agent

# Update title
dirban set 26-001 --title="Implement fuzzy search across board"

# Update tags (comma-separated)
dirban set 26-001 --tags=cli,search,ux
```

#### `archive [<id>|all]`
Partitions completed tasks into terminal archive storage (`archive/YYYY/`).

```bash
# Archive a specific completed task
dirban archive 26-001

# Archive all tasks currently in the done column
dirban archive all
```

#### `help` / `--help` / `-h`
Displays usage syntax and flags.

#### `--version` / `-v`
Outputs the current version string.

---

## 2. Interactive Terminal UI (TUI) Keybindings

When running `dirban board` in a terminal TTY, the interactive TUI is launched.

| Key | Action |
| :--- | :--- |
| `←` / `h` | Move focus to previous column |
| `→` / `l` | Move focus to next column |
| `↑` / `k` | Move focus to previous task card |
| `↓` / `j` | Move focus to next task card |
| `m` | Open interactive modal to move selected task to another column |
| `Space` | Toggle the first incomplete acceptance criteria checklist item |
| `v` / `Enter` | Open full task detail preview overlay (press `ESC` or `Enter` to return) |
| `q` / `Ctrl+C` | Exit the TUI |

---

## 3. Developer CLI Reference

For contributors developing the Dirban engine:

### Prerequisites
- **Runtime**: [Bun](https://bun.sh) (v1.2+)
- **TypeScript**: v5.8+

### Development Scripts

| Command | Description |
| :--- | :--- |
| `bun run dirban [args]` | Runs the CLI directly from TypeScript source (`main.ts`) |
| `bun test` | Runs the full vector-based test suite via Bun's native test runner |
| `bun run typecheck` | Runs TypeScript compiler checks without emitting files (`tsc --noEmit`) |
| `bun run build` | Compiles `main.ts` into a standalone, zero-dependency native executable (`./dirban`) |
| `bun link` | Symlinks the local `dirban` executable into your global bin PATH |
| `bun run seed-tasks.ts` | Populates sample tasks across columns for local development and TUI testing |

---

## 4. Configuration Schema (`.dirban.json`)

Dirban automatically resolves configuration from `.dirban.json` located in the workspace root:

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tasksDir` | `string` | `"docs/tasks"` | Root directory containing column subdirectories |
| `columns` | `string[]` | `["backlog", "01-todo", "02-doing", "03-done"]` | Ordered list of active column folder names |
| `priorities` | `string[]` | `["p0", "p1", "p2", "p3"]` | Ordered list of priority levels (index 0 is highest priority) |
| `defaultPriority` | `string` | `"p2"` | Default priority assigned to newly created tasks (must be in `priorities`) |
| `archiveDir` | `string` | `"docs/tasks/archive"` | Directory where archived tasks are moved |

### Custom Priority Example (`.dirban.json`)

You can define semantic priority levels instead of standard P-tiers:

```json
{
  "tasksDir": "docs/tasks",
  "columns": ["backlog", "01-todo", "02-doing", "03-done"],
  "priorities": ["urgent", "high", "normal", "low"],
  "defaultPriority": "normal"
}
```

Or inside `.vscode/settings.json`:
```json
{
  "dirban.tasksDir": "docs/tasks",
  "dirban.priorities": ["urgent", "high", "normal", "low"],
  "dirban.defaultPriority": "normal"
}
```
