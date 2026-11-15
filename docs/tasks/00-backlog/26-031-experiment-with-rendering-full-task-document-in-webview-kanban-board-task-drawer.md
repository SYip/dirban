---
id: "26-031"
title: "Experiment with Rendering Full Task Document in Webview Kanban Board Task Drawer"
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
  - webview
  - task-drawer
  - ui
  - experiment
relationships:
  depends_on:
    - "26-008"
  blocks: []
  related_to:
    - "26-009"
    - "26-029"
---

# Experiment with Rendering Full Task Document in Webview Kanban Board Task Drawer

Enhance the slide-out `TaskDrawer.vue` in the webview Kanban board to render the complete OKF markdown task document (objective & scope, context, verification plan, execution journal, and custom sections) rather than displaying only metadata fields and the acceptance criteria checklist.

## Objective & Scope

Currently, opening a task card in the Kanban board slides open `TaskDrawer.vue`, which shows the task title, a 4-item metadata grid (Column, Owner, Status, Updated), and the acceptance criteria list. Developers who want to read the full task context, objective, architecture notes, or verification steps are forced to click "Open File" to view the markdown file in an editor tab.

This task explores rendering the full markdown content directly inside the task drawer while preserving interactive checklist items and quick lifecycle actions.

### Key Enhancements

1. **Full Section Rendering**:
   - Render `objectiveScope`, `verificationPlan`, `executionJournal`, and any custom markdown sections present in `TaskDocument.otherSections` or parsed body.
   - Maintain styled typography matching VS Code's editor font, headings, code blocks, and blockquotes.

2. **Interactive Acceptance Criteria**:
   - Keep acceptance criteria checkboxes interactive within the full rendered view with immediate disk synchronization via `checkTaskItem`.

3. **Scrollable Layout & Pinned Controls**:
   - Ensure the drawer header (ID, title, priority, open file) and lifecycle action footer (ready, start, done, archive buttons) remain pinned while the document body scrolls smoothly.

## Acceptance Criteria

- [ ] Update `TaskDrawer.vue` to render all parsed sections from `TaskDocument` (`objectiveScope`, `verificationPlan`, `executionJournal`, and other markdown sections).
- [ ] Format markdown body sections with clean typography matching VS Code native design tokens.
- [ ] Preserve interactive acceptance criteria checkbox toggling with live disk sync.
- [ ] Ensure smooth scrolling for long task documents while keeping the drawer header and action footer pinned.
