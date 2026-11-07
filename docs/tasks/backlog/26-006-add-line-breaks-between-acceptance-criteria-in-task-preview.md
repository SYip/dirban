---
id: "26-006"
title: "Add line breaks between acceptance criteria in task preview"
type: "task"
status: "01-todo"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-07"
last_updated: "2026-11-07"
tags:
  - cli
  - tui
  - view
  - formatting
relationships:
  depends_on: []
  blocks: []
  related_to:
    - docs/tasks/03-done/26-003-task-execution-lifecycle-and-git-flow.md
---

# Add line breaks between acceptance criteria in task preview

Improves readability in task preview and detail inspection views (`dirban view`, `dirban current`, and interactive TUI detail pane) by adding a line break between individual acceptance criteria items.

Currently, criteria are rendered consecutively on adjacent lines, which becomes visually dense and hard to scan when criteria descriptions span multiple lines or include sub-details.

## Acceptance Criteria

- [ ] Update `formatTaskDetail` in `src/cli/formatters.ts` to insert an empty line separator between consecutive acceptance criteria items.
- [ ] Update `formatCurrentTaskView` in `src/cli/formatters.ts` to include the same line break separation between criteria items for consistency.
- [ ] Ensure the interactive TUI detail panel (`src/cli/tui.ts`) preserves and displays the separated criteria items legibly.
- [ ] Verify unit tests pass and update any snapshot/formatter test vectors checking criteria layout.
