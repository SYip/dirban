---
id: "26-034"
title: "Fix webview task creation, remove redundant focus view board button, and add tree view drag-and-drop & actions"
status: "backlog"
priority: "p1"
created: "2026-11-11"
tags:
  - vscode-extension
  - webview
  - treeview
  - drag-and-drop
  - ux
blocked_by: []
---

# 26-034: Fix Webview Task Creation, Remove Redundant Focus View Board Button, and Add Tree View Drag-and-Drop & Actions

## Problem Statement
Users have identified three key usability and functionality issues in the VS Code extension:
1. **Task creation in Kanban webview fails**: The "New Task" button in `BoardTopBar.vue` uses the browser `prompt()` dialog, which is blocked or restricted inside VS Code Webview sandbox iframes. Furthermore, when creating tasks, it passes column `"backlog"`, which is outside the active board columns or not properly handled if `docs/tasks/backlog/` path resolution does not align with `board.tasksDir`.
2. **Redundant Kanban view icon on Current Task view**: In the sidebar header menu, `dirban.openBoard` is currently shown on both `dirban.focusView` and `dirban.treeView` (`when == dirban.focusView || view == dirban.treeView`). Having the Kanban board button in the "Current Task" header creates visual clutter and redundancy because the adjacent "All Tasks" header already provides the Kanban board launcher.
3. **Sidebar "All Tasks" TreeView lacks drag-and-drop & inline action buttons**: In the "All Tasks" tree view, tasks cannot be moved between columns without opening the full webview. VS Code's `TreeDragAndDropController` API allows native dragging of tree items between column parent nodes. In addition, task items in the tree view lack inline hover action buttons (e.g., Start/Focus, Mark Done, Preview, Open File).

## Acceptance Criteria
- [ ] Replace `prompt()` in Webview with a native VS Code QuickPick / InputBox dialog triggered via message passing (`type: "requestCreateTask"`), or an in-webview modal form supporting title and priority.
- [ ] Ensure created tasks are placed cleanly in `backlog/` or the first column (`config.columns[0]`), properly written to disk, and the board updates reactively.
- [ ] Remove `dirban.openBoard` from `dirban.focusView` in `package.json` `menus["view/title"]` so it only appears in `dirban.treeView` (`when: "view == dirban.treeView"`).
- [ ] Implement `vscode.TreeDragAndDropController` in `DirbanTreeDataProvider` to enable dragging tasks between column folders in the "All Tasks" sidebar tree view.
- [ ] Add inline action buttons on hover for task tree items in `menus["view/item/context"]` (e.g. Start Task, Mark Done, Open Preview).
- [ ] Verify with tests and build validation (`bun run build:extension` passes cleanly).
