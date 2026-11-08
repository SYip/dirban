---
id: "26-006"
title: "Improve CLI view formatting: criteria line breaks and plan links"
type: "task"
status: "doing"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-07"
last_updated: "2026-11-08"
tags:
  - cli
  - tui
  - view
  - formatting
relationships:
  depends_on: []
  blocks: []
  related_to:
    - "26-003"
    - "26-004"
---

# Improve CLI view formatting: criteria line breaks and plan links

Improves readability and developer UX across CLI inspection views (`dirban view`, `dirban current`, `dirban plan`, `dirban start`, and interactive TUI panels):

1. **Relative & Clickable Paths in Inspection & Start Views**:
   - In `dirban current` and `dirban view`, display the workspace-relative path instead of the full absolute path, with OSC 8 clickable hyperlinks to open the markdown file directly.
   - In `dirban start`, include an OSC 8 clickable link and relative path to open the moved task file.
2. **Already-Started Safety Guard**:
   - Prevent redundant checkouts or duplicate setups in `dirban start`. If the active branch matches the task's branch or if an active worktree already exists for the task, fail with an explicit `ALREADY_STARTED` error.
3. **Acceptance Criteria Line Breaks**: Adds an empty line separator between consecutive criteria items in preview and detail inspection views.
4. **Simplified Plan Section Headers**:
   - Change `✔ Ready to Promote (<count>):` $\rightarrow$ `✔ Ready (<count>):`
   - Change `⛔ Blocked / In Limbo (<count>):` $\rightarrow$ `⛔ Blocked (<count>):`
5. **Clickable Terminal Hyperlinks**:
   - In `dirban plan` (and detail views), format task titles/IDs and relative paths using OSC 8 terminal hyperlinks (`\u001b]8;;file://<path>\u0007<label>\u001b]8;;\u0007` or clickable relative paths) so developers can Cmd+click / Ctrl+click to jump directly to the markdown file in their editor.

## Acceptance Criteria

### Relative Paths & Lifecycle Links
- [ ] Display workspace-relative paths rather than full paths in `dirban current` and `dirban view`.
- [ ] Provide clickable link and relative path when a task is started via `dirban start`.
- [ ] Fail `dirban start` with an error if the user is already on the task branch or an active worktree for the task is already created.

### Criteria Line Breaks
- [ ] Update `formatTaskDetail` in `src/cli/formatters.ts` to insert an empty line separator between consecutive acceptance criteria items.
- [ ] Update `formatCurrentTaskView` in `src/cli/formatters.ts` to include the same line break separation between criteria items for consistency.
- [ ] Ensure the interactive TUI detail panel (`src/cli/tui.ts`) preserves and displays the separated criteria items legibly.

### Plan View Header & Link Enhancements
- [ ] In `formatPlanView` (`src/cli/formatters.ts`), simplify section headers:
  - `✔ Ready (<count>):` (was `✔ Ready to Promote`)
  - `⛔ Blocked (<count>):` (was `⛔ Blocked / In Limbo`)
- [ ] Make task entries clickable in terminals supporting OSC 8 hyperlinks (or output relative file paths recognizable by terminal click handlers), allowing direct navigation to the task markdown file on click.
- [ ] Verify unit tests pass and update any snapshot/formatter test vectors checking plan or criteria layout (`bun test && bun run typecheck`).
