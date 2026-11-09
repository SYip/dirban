---
id: "26-023"
title: "Enforce strict workflow sequence in dirban start from pre-focus column"
type: "task"
status: "todo"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
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

# Enforce strict workflow sequence in dirban start from pre-focus column

## Description

Currently, `dirban start <id>` can start a task located in any column on the board (including `backlog`, `archive`, or already in `doing`). This breaks standard Kanban pull-system discipline and bypasses triage/blocker evaluation in the backlog:
- A task still in `backlog` might be blocked by unmet dependencies, but `start` would move it into `02-doing` anyway.
- Starting a task already in `02-doing` should produce a clear state message rather than re-triggering branch provisioning.

This task introduces strict workflow transition enforcement to prevent human error:
1. **Pre-Focus Column Sourcing (`focusColumn - 1`)**:
   - `dirban start <id>` resolves the scheduled queue column preceding the active focus column (e.g. `01-todo` when focus is `02-doing`, using `resolvePreviousColumn(config, focusCol)`).
   - Only tasks residing in this source queue can be started.
2. **Actionable State Guidance**:
   - If the task is in `backlog`, reject with:
     `Cannot start task <id>: task is in 'backlog'. Run 'dirban plan promote <id>' first.`
   - If the task is already in the focus column (`02-doing`), report:
     `Task <id> is already in '<focusColumn>'.`
   - If the task is in completed/archive:
     `Cannot start task <id>: task is already completed in '<column>'.`
3. **Column-Scoped Query Resolution in `findTaskByQuery`**:
   - Extend `findTaskByQuery(tasks, query, options?)` in `src/board/discovery.ts` to accept optional `column` scoping.

## Acceptance Criteria

- [ ] Extend `TaskQueryOptions` in `src/board/discovery.ts` with optional `column` filter.
- [ ] Update `startTask` in `src/tasks/lifecycle/start.ts` to strictly require that the target task is in the column preceding the focus column (`resolvePreviousColumn(config, focusCol)`).
- [ ] If the task is found in another column, return an informative domain error (`INVALID_COLUMN_TRANSITION` / `ALREADY_STARTED`) with clear recovery steps (`dirban plan promote <id>` if in backlog).
- [ ] Update `handleStart` in `src/tasks/lifecycle/start.cli.ts` to display user-friendly guidance.
- [ ] Add unit test vectors in `src/tasks/lifecycle/start.test.ts`:
  1. Starting a task in `01-todo` succeeds and moves to `02-doing`.
  2. Starting a task in `backlog` fails with guidance to promote it first.
  3. Starting a task already in `02-doing` fails cleanly.
  4. Starting a task in a custom workflow (e.g. `develop` -> `review`) strictly respects `focusColumn - 1`.
- [ ] Ensure all tests pass (`bun test`) and TypeScript strict check passes (`bun run typecheck`).
