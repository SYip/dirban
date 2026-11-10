# Dirban for VS Code

A folder-based Kanban board and active task tracker built directly into your editor.

Dirban tracks tasks using plain Markdown files in your repository. It keeps you and your autonomous coding agents aligned on the active task without context-switching to browser tabs or SaaS project management tools.

---

## Core Architecture: Directory-as-State

Dirban stores board state directly on disk as a folder tree:

```text
docs/tasks/
├── backlog/         # Planned tasks waiting for planning or dependency resolution
├── 01-todo/         # Active staging queue (customizable)
├── 02-doing/        # Focused / in-progress work (customizable)
├── 03-done/         # Completed tasks (customizable)
└── archive/         # Permanent historical record
```

### The Two Mandated Directories
- **`backlog/`**: Where task specifications live before execution begins. Tasks here can declare dependency blockers (`blocked_by: ["26-001"]`). Dirban's planning tools evaluate readiness and promote unblocked work into your active workflow.
- **`archive/`**: Where finished tasks are permanently preserved flat. Archiving completed work keeps your daily board fast and uncluttered.

### Fully Customizable Workflow
Between `backlog/` and `archive/`, the workflow matches your team's convention:
- **Standard 3-Stage (Default)**: `01-todo` → `02-doing` → `03-done`
- **Linear / Minimal**: `["doing"]`
- **Software Engineering**: `["ready", "dev", "review", "qa", "done"]`
- **Zero-Column Triage**: `[]` (tasks flow directly from `backlog/` to `archive/`)

Configure your stages, focus column, and paths in `.dirban.json` or `.vscode/settings.json`.

---

## Key Features

### 1. Pinned Task Focus View
The **Dirban Focus View** stays pinned at the top of your Activity Bar:
- **Active Task Header**: Instantly view what you or an agent are currently building.
- **Git Branch Alignment**: Green badge when your current branch or worktree matches the active task; amber badge when mismatched.
- **Interactive Acceptance Checklist**: Check off items (`- [ ]`) directly in the sidebar tree to mutate the task file.
- **Quick Action Bar**: One-click actions to preview Markdown, launch the Kanban board, edit the source file, or mark the task done.

### 2. Status Bar Progress
A lightweight status bar item tracks real-time progress:
`$(checklist) 26-001 Implement auth [2/5]`
Clicking the item opens the active task file or side-by-side preview.

### 3. Full Kanban Board Webview
Open a visual, drag-and-drop Kanban board in an editor tab:
- Drag tasks between workflow columns.
- Filter cards by tag, priority (`p0`–`p3`), or search text.
- Click any card to open the task drawer and inspect acceptance criteria.

### 4. Smart Markdown Preview
Clicking a task header opens a side-by-side Markdown preview that focuses existing tabs instead of duplicating editor panes.

---

## Quickstart

1. **Open your project**: If your repository contains a `docs/tasks/` or `tasks/` directory, Dirban detects it automatically.
2. **Open the Kanban Board**: Press `Cmd+Shift+P` (or `Ctrl+Shift+P`) and run:
   ```text
   Dirban: Open Kanban Board
   ```
3. **Open the Focus View**: Click the Dirban icon in the primary Activity Bar to view active work and the project column tree.

---

## Configuration (`settings.json`)

Configure your board in `.vscode/settings.json` (or `.dirban.json` in your repository root):

```json
{
  "dirban.tasksDir": "docs/tasks",
  "dirban.columns": ["01-todo", "02-doing", "03-done"],
  "dirban.focusColumn": "02-doing",
  "dirban.branchStrategy": "checkout",
  "dirban.autoMerge": true,
  "dirban.priorities": ["p0", "p1", "p2", "p3"],
  "dirban.defaultPriority": "p2"
}
```

| Setting | Default | Description |
| :--- | :--- | :--- |
| `dirban.tasksDir` | `"docs/tasks"` | Path to the directory storing task columns. |
| `dirban.columns` | `["01-todo", "02-doing", "03-done"]` | Ordered list of active workflow column directories. |
| `dirban.focusColumn` | `"02-doing"` | The designated active execution column tracked by the Focus View. |
| `dirban.archiveDir` | `"docs/tasks/archive"` | Destination folder where finished tasks are archived. |
| `dirban.branchStrategy` | `"checkout"` | Workspace strategy when starting a task (`"checkout"`, `"worktree"`, or `"none"`). |
| `dirban.autoMerge` | `true` | Automatically squash and merge task branch upon task completion. |
| `dirban.priorities` | `["p0","p1","p2","p3"]` | Recognized priority tiers. |
| `dirban.defaultPriority` | `"p2"` | Fallback priority assigned to new tasks. |

---

## Status & What's Next

Dirban for VS Code is under active development. Current focus areas:

- **Planning View (`dirban.openBoard` & Plan mode)**: Dependency tree visualization, batch task promotions, and automated unblocking rules right in the editor.
- **Archive Explorer**: Fast search and historical review of completed tasks directly from the VS Code sidebar.

Feedback, bug reports, and feature requests are welcome on [GitHub Discussions](https://github.com/SYip/dirban/discussions) and [Issues](https://github.com/SYip/dirban/issues).

---

## Contributing & Development

For instructions on building from source, running tests, and debugging with F5, see **[DEVELOPMENT.md](https://github.com/SYip/dirban/blob/main/packages/vscode-extension/DEVELOPMENT.md)**.

---

## License

[MIT](https://github.com/SYip/dirban/blob/main/LICENSE)
