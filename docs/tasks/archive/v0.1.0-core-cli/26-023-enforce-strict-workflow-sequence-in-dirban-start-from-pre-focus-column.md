---
id: "26-023"
title: "Enforce strict workflow sequence across dirban lifecycle (start, done, plan)"
type: "task"
status: "done"
priority: "p2"
owner: "developer"
assigned_to: "developer"
created_date: "2026-11-09"
last_updated: "2026-11-09"
tags:
  - workflow
  - lifecycle
  - validation
  - kanban
relationships:
  depends_on:
    - "26-022"
  blocks: []
  related_to:
    - "26-015"
    - "26-022"
---

# Enforce strict workflow sequence across dirban lifecycle (start, done, plan)

## Description

Commands across the Kanban lifecycle (`plan promote`, `start`, `done`) should enforce strict pull-system sequencing to prevent human error and skipping columns:
1. **`dirban start <id>` (Pre-focus queue `focusColumn - 1`)**:
   - Resolves the scheduled queue preceding the active focus column (e.g. `01-todo`).
   - Only tasks residing in this source queue can be started.
   - If in `backlog`: rejects with advice to run `dirban plan promote <id>`.
   - If already in focus column: reports already started.
   - If in completed/archive: reports already completed.
2. **`dirban done [id]` (Focus column only)**:
   - When a specific `taskId` is supplied, it must currently reside in the active focus column (`focusColumn`, e.g. `02-doing`).
   - If in `backlog`: rejects with `Cannot mark task <id> as done: task is in 'backlog'. Run 'dirban plan promote <id>' first.`
   - If in `01-todo`: rejects with `Cannot mark task <id> as done: task is in '01-todo'. Run 'dirban start <id>' first.`
   - If already in `03-done` / `archive`: rejects with `Task <id> is already completed in '<column>'.`
3. **`dirban plan promote <id>` (Backlog only with cross-board awareness)**:
   - When promoting a specific task, if not found in `backlog`, inspects the entire board.
   - If already in `01-todo` (or target queue): reports `Cannot promote task <id>: task is already in '<column>'.`
   - If in `02-doing`: reports `Cannot promote task <id>: task is already in progress in '<column>'.`
   - If in `03-done` / `archive`: reports `Cannot promote task <id>: task is already completed in '<column>'.`

## Acceptance Criteria

- [x] Extend `TaskQueryOptions` in `src/board/discovery.ts` with optional `column` filter.
- [x] Update `startTask` in `src/tasks/lifecycle/start.ts` to strictly require that the target task is in the column preceding the focus column (`resolvePreviousColumn(config, focusCol)`).
- [x] If `startTask` finds the task in another column, return an informative domain error (`INVALID_COLUMN_TRANSITION` / `ALREADY_STARTED`) with clear recovery steps (`dirban plan promote <id>` if in backlog).
- [x] Update `handleStart` in `src/tasks/lifecycle/start.cli.ts` to display user-friendly guidance.
- [x] Add unit test vectors in `src/tasks/lifecycle/start.test.ts` for `start` workflow guards.
- [x] Update `doneTask` in `src/tasks/lifecycle/done.ts` to strictly enforce that the target task is in the active `focusColumn`.
- [x] If `doneTask` finds the task in another column, return an informative domain error (`INVALID_COLUMN_TRANSITION` / `ALREADY_COMPLETED`) with clear recovery steps (e.g. `dirban start <id>` if in todo).
- [x] Update `handleDone` in `src/tasks/lifecycle/done.cli.ts` to display user-friendly guidance.
- [x] Update `promoteTasks` / `resolveBacklogTaskId` in `src/tasks/planning/plan.ts` to provide cross-board awareness and informative errors when a task is already promoted, in doing, or done.
- [x] Update `handlePlan` in `src/tasks/planning/plan.cli.ts` to display clear errors when promote targets non-backlog tasks.
- [x] Add unit test vectors for `doneTask` and `promoteTasks` workflow transition guards.
- [x] Ensure all tests pass (`bun test`) and TypeScript strict check passes (`bun run typecheck`).
