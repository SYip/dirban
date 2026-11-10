---
id: "26-009"
title: "VS Code Extension Focus and Current Task View with Status Bar Integration"
type: "task"
status: "doing"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-10"
tags:
  - vscode
  - extension
  - focus
  - ui
relationships:
  depends_on:
    - "26-008"
  blocks: []
  related_to:
    - "26-003"
    - "26-029"
    - "26-030"
    - "26-031"
---

# VS Code Extension Focus and Current Task View with Status Bar Integration

Integrates the active task focus workflow (`dirban current` / `resolveCurrentTask`) into the VS Code extension interface, styled after VS Code's native Source Control pane.

Surfaces the developer's in-progress work directly in the editor chrome with live acceptance criteria tracking, one-click preview and edit modes, and focused tree visibility, eliminating context switching between editor, terminal, and browser.

## Key Features

1. **Top Priority Focus Pane (Current Task First in Sidebar)**:
   - Registers `dirban.focusView` as the **top-level primary pane** in the Activity Bar container (above the board columns list), so the first thing the developer sees is their active work.
   - Places the full columns tree (`dirban.treeView`) underneath as the secondary overview pane.
   - Styled after VS Code's native Git Source Control view:
     - **Header Action Bar**:
       - `[ ◫ ]` Open Kanban Board (triggers webview board tab with active task auto-opened).
       - `[ 👁 ]` Open Preview Mode (smart toggle targeting existing preview tabs).
       - `[ ✏ ]` Open Edit Mode (opens the `.md` file directly in the editor).
       - `[ ✓ ]` Mark Task as Done (runs `doneTask` with auto-merge/finish).
       - `[ ↻ ]` Refresh state.
     - **Active Work Context & Color Coding**:
       - Displays task ID, title, priority badge, and current VCS branch.
       - Color-coded branch alignment: green when current Git branch matches task ID, yellow when on an unaligned branch (e.g. `main`), omitted/neutral for `directory-only` or `none` strategy.
     - **Interactive Acceptance Criteria (Like Staged Changes)**:
       - Displays acceptance criteria checkboxes directly in the sidebar tree.
       - Clicking toggles the criterion state immediately on disk via `checkTaskItem`.
       - Direct 1-click preview launch on header click.

2. **Secondary Board Columns Pane at Bottom with Selective Expansion**:
   - Positioned below the Current Task pane in the sidebar container.
   - Sets default collapsed state on columns:
     - **Expanded**: Focus column (`02-doing` or configured `focusColumn`) and pre-focus queue (`01-todo` or `focusColumn - 1`).
     - **Collapsed by default**: All other columns (`backlog`, `03-done`, `archive`, custom extra columns) to keep sidebar clean and focused.

3. **Status Bar Item**:
   - Displays active task ID, truncated title, and criteria completion tally in the bottom status bar (e.g. `$(checklist) 26-009 [2/5]`).
   - Tinted green when branch is aligned, yellow when mismatched.
   - Clicking focuses the task / reveals the preview.

4. **Lifecycle Commands**:
   - Command palette shortcuts:
     - `Dirban: Open Kanban Board`
     - `Dirban: Focus Current Task`
     - `Dirban: Preview Current Task` (smart open without duplicate splits)
     - `Dirban: Edit Current Task` (opens markdown file in editor)
     - `Dirban: Toggle Acceptance Criterion`
     - `Dirban: Mark Current Task as Done` (triggers `doneTask` with auto-merge/finish).

## Acceptance Criteria

- [x] Reorder sidebar container views so `dirban.focusView` (Current Task) is the top primary view, and `dirban.treeView` (All Tasks / Columns) sits below it at the bottom.
- [x] Update `ColumnTreeItem` in sidebar tree to default to collapsed for all columns except the focus column and pre-focus column (`focus - 1`).
- [x] Create VS Code Status Bar item powered by `resolveCurrentTask`, updating reactively on file changes or branch switches with colored branch alignment.
- [x] Implement `DirbanFocusViewProvider` sidebar pane styled like Source Control, displaying active task metadata, colored branch match status, and interactive criteria checkboxes.
- [x] Support both Preview Mode (`showMarkdownPreviewSmart`) and Edit Mode (`vscode.open`) via title bar icon actions and command palette.
- [x] Implement direct acceptance criteria toggling (`checkTaskItem`) from the Focus sidebar with instantaneous UI update and disk sync.
- [x] Add command palette actions for `Dirban: Open Kanban Board`, `Dirban: Focus Current Task`, `Dirban: Preview Current Task`, `Dirban: Edit Current Task`, and `Dirban: Mark Current Task Done`.
- [x] Provide a title bar icon button to launch the Kanban board webview with the active task automatically selected in the drawer.
- [x] Handle edge cases gracefully: empty active state ("No active task in progress"), multiple tasks in doing notice, and non-git worktree environments.
