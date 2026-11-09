---
id: "26-009"
title: "VS Code Extension Focus and Current Task View with Status Bar Integration"
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
  - focus
  - ui
relationships:
  depends_on:
    - "26-008"
  blocks: []
  related_to:
    - "26-003"
---

# VS Code Extension Focus and Current Task View with Status Bar Integration

Integrates the active task focus workflow (`dirban current` / `resolveCurrentTask`) into the VS Code extension interface.

Surfaces the developer's in-progress work directly in the editor chrome with live acceptance criteria tracking, eliminating context switching between editor, terminal, and browser.

## Key Features

1. **Status Bar Item**:
   - Displays active task ID, truncated title, and criteria completion tally in the bottom status bar (e.g. `$(checklist) 26-009 [2/5]`).
   - Clicking opens the full task markdown document or toggles the Focus sidebar panel.

2. **Dedicated Focus Sidebar Pane**:
   - Shows active task metadata (ID, title, priority, assigned owner, current branch/worktree).
   - Renders interactive acceptance criteria checkboxes that can be clicked to toggle state directly via `checkTaskItem`.
   - Real-time progress bar visualizing completion percentage.

3. **Lifecycle Commands**:
   - Command palette shortcuts:
     - `Dirban: Show Current Task`
     - `Dirban: Toggle Acceptance Criterion`
     - `Dirban: Mark Current Task as Done` (triggers `doneTask` with auto-merge/finish).

## Acceptance Criteria

- [ ] Create VS Code Status Bar item powered by `resolveCurrentTask`, updating reactively on file changes or branch switches.
- [ ] Implement `DirbanFocusViewProvider` sidebar pane displaying the active task details and clickable acceptance criteria checkboxes.
- [ ] Implement direct acceptance criteria toggling (`checkTaskItem`) from the Focus sidebar with instantaneous UI update and disk sync.
- [ ] Add command palette actions for `Dirban: Focus Current Task` and `Dirban: Mark Current Task Done`.
- [ ] Handle edge cases gracefully: empty active state ("No active task"), multiple tasks in doing notice, and non-git worktree environments.
