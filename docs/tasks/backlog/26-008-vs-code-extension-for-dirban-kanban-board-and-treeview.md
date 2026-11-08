---
id: "26-008"
title: "VS Code Extension for Dirban Kanban Board and TreeView"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
tags:
  - vscode
  - extension
  - ui
  - board
relationships:
  depends_on:
    - "26-011"
  blocks:
    - "26-009"
    - "26-010"
  related_to:
    - docs/decisions/2026-11-07-progressive-enhancement-optional-dependencies.md
    - "26-005"
---

# VS Code Extension for Dirban Kanban Board and TreeView

Builds the official Dirban VS Code extension (Phase 2 Roadmap) providing an integrated developer GUI inside the editor alongside the terminal CLI.

The extension leverages the existing zero-database TypeScript core (`src/board`, `src/config`, `src/operations`) to present tasks directly inside VS Code's Activity Bar and interactive Webview.

## Key Features

1. **Activity Bar TreeView**:
   - Lists Kanban columns dynamically: mandatory special partitions (`backlog` and `archive`) plus configured active flow columns from `config.columns` (e.g. `01-todo`, `02-doing`, `03-done`).
   - Displays task items under each column displaying ID, priority badge, and title.
   - Quick actions on tree items: open markdown file, toggle acceptance criteria, move to next column.

2. **Interactive Kanban Webview (Vue 3)**:
   - Visual Kanban board view built with Vue 3 SFCs rendering columns side-by-side.
   - Smooth drag-and-drop task movement between column lanes using `vuedraggable` (`sortablejs`) executing atomic filesystem moves (`moveTask`).
   - Task preview drawer displaying acceptance criteria checkboxes with real-time toggle.

3. **Required Packages**:
   - `vuedraggable`: `^4.1.0` (or `sortablejs` with Vue 3 bindings) for multi-column drag-and-drop.
   - `@vueuse/core`: (optional utility hooks for responsive board resizing & hotkeys).

4. **Reactive Filesystem Watching**:
   - Uses `vscode.workspace.createFileSystemWatcher` to track markdown file additions, edits, renames, and deletions.
   - Automatically refreshes TreeView and Webview state when external edits or CLI commands execute without requiring manual reloads.

4. **Configuration Integration**:
   - Contributes `dirban.*` configuration schema to VS Code settings (`dirban.tasksDir`, `dirban.columns`, `dirban.priorities`, `dirban.defaultPriority`).
   - Reads workspace configuration smoothly via the existing configuration resolver.

## Acceptance Criteria

- [ ] Implement `DirbanTreeDataProvider` registering a custom TreeView in the VS Code Activity Bar showing columns (`backlog`, user-configured `config.columns`, and `archive`) and tasks.
- [ ] Implement Webview Kanban board panel with interactive drag-and-drop column transitions.
- [ ] Connect reactive file system watcher (`vscode.workspace.createFileSystemWatcher`) to live-sync UI when files are moved or edited by CLI/git.
- [ ] Provide commands in command palette:
  - `Dirban: Open Board`
  - `Dirban: Create Task`
  - `Dirban: Focus Current Task`
  - `Dirban: Refresh Board`
- [ ] Integrate workspace configuration reading from `.vscode/settings.json` (`dirban.*`) and `.dirban.json`.
- [ ] Verify TreeView and Kanban Webview inside the VS Code Extension Development Host.
