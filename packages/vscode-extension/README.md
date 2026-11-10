# Dirban for VS Code

> **Zero-database, folder-based Kanban board and active task tracker right inside your editor.**

Dirban tracks project tasks using plain Markdown files and directories (`01-todo/`, `02-doing/`, `03-done/`). It keeps you and your AI coding agents focused on the active task without context-switching to browser tabs.

---

## Features

### 1. Pinned Task Focus View
Modeled after VS Code Source Control, the **Dirban Focus View** stays pinned at the top of your sidebar:
- **Active Task Header**: Shows what you or an autonomous agent are currently working on.
- **Git Branch Alignment**: Displays a green indicator when your current branch or worktree matches the active task, or amber if mismatched.
- **Interactive Acceptance Checklist**: Check off items (`- [ ]`) directly in the sidebar tree.
- **Quick Action Bar**: One-click buttons to preview task markdown, open the Kanban board, edit the file, or mark it done.

### 2. Status Bar Progress Indicator
A lightweight status bar item in the bottom tray shows real-time progress:
`$(checklist) 26-001 Implement auth [2/5]`
Clicking the status bar item jumps straight to the active task file or preview.

### 3. Full Kanban Board Webview
Open a visual, drag-and-drop Kanban board directly in an editor tab:
- Drag tasks between workflow columns (`todo` -> `doing` -> `done`).
- Filter cards by tag, priority (`p0`–`p3`), or search query.
- Click any card to open the slide-out task drawer and view acceptance criteria.

### 4. Smart Markdown Preview
Clicking a task header opens a side-by-side Markdown preview that focuses existing tabs instead of opening duplicate preview editors.

---

## Getting Started

1. **Open a project with a task board**: If your repository already has a `docs/tasks/` or `tasks/` directory, Dirban detects it automatically.
2. **Open the Kanban Board**: Press `Cmd+Shift+P` (or `Ctrl+Shift+P`) and run:
   ```text
   Dirban: Open Kanban Board
   ```
3. **Inspect the Focus View**: Open the Dirban icon in the primary Activity Bar to view active work and your project column tree.

---

## Settings (`settings.json`)

Configure your board in `.vscode/settings.json`:

```json
{
  "dirban.tasksDir": "docs/tasks",
  "dirban.branchStrategy": "checkout",
  "dirban.priorities": ["p0", "p1", "p2", "p3"],
  "dirban.defaultPriority": "p2"
}
```

| Setting | Default | Description |
| :--- | :--- | :--- |
| `dirban.tasksDir` | `"docs/tasks"` | Path to the directory storing task columns. |
| `dirban.branchStrategy` | `"checkout"` | Workspace strategy when starting a task (`"checkout"`, `"worktree"`, or `"none"`). |
| `dirban.priorities` | `["p0","p1","p2","p3"]` | Recognized priority tiers. |

---

## Contributing & Local Development

For instructions on building the extension from source, running tests, and debugging with F5, see **[DEVELOPMENT.md](DEVELOPMENT.md)**.

---

## License

[MIT](https://github.com/andrew/dirban/blob/main/LICENSE)
