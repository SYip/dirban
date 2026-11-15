---
id: "26-030"
title: "Smart Tab Focusing for Inactive Markdown Preview Across Editor Groups"
type: "task"
status: "backlog"
priority: "p3"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-10"
last_updated: "2026-11-10"
tags:
  - vscode
  - extension
  - preview
  - editor-groups
relationships:
  depends_on:
    - "26-009"
  blocks: []
  related_to: []
---

# Smart Tab Focusing for Inactive Markdown Preview Across Editor Groups

Enhance the Markdown preview opening workflow (`showMarkdownPreviewSmart`) to focus an existing preview tab even when it is currently in an inactive tab group or behind another active tab in the same group.

## Objective & Scope

Currently, `showMarkdownPreviewSmart` checks if a matching preview tab is already active and focused. However, if the preview tab is open in Editor Group 1 but hidden behind another document, invoking the preview command may open a duplicate preview in Editor Group 2 beside the current editor instead of revealing the already open preview tab in Group 1.

### Improvements to Investigate

1. **Cross-Group Tab Selection**:
   - Locate the target preview tab across `vscode.window.tabGroups.all`.
   - Switch focus to the tab's containing `TabGroup` (e.g. `workbench.action.focusFirstEditorGroup`, `workbench.action.focusSecondEditorGroup`, etc.).
   - Switch the active tab in that group to the target tab (e.g. via `workbench.action.openEditorAtIndex` or tab selection).

2. **Prevent Duplicate Side-by-Side Splits**:
   - If a preview tab already exists anywhere in the window, reveal it in its existing column/group rather than opening a new split beside.

## Acceptance Criteria

- [ ] Detect open preview tabs in all `vscode.window.tabGroups.all` regardless of whether they are the currently active tab.
- [ ] If the preview is already open in any editor group, focus that group and reveal the tab.
- [ ] Only execute `markdown.showPreviewToSide` when no preview tab for the file exists in any editor group.
