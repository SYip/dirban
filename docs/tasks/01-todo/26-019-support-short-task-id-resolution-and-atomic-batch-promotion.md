---
id: "26-019"
title: "Support Short Task ID Resolution and Atomic All-or-Nothing Batch Validation in Plan Promotion"
type: "task"
status: "todo"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
tags:
  - planning
  - cli
  - validation
  - batch-operations
relationships:
  depends_on:
    - "26-017"
  blocks: []
  related_to:
    - "26-004"
    - "26-017"
---

# Support Short Task ID Resolution and Atomic All-or-Nothing Batch Validation in Plan Promotion

## Description

Currently in `dirban plan --promote=<ids>` and `dirban plan promote <ids>`, users must specify the full task ID (e.g. `26-001` or `task.26-001`). Entering just the short suffix like `001` or `1` is not resolved. In daily command-line usage, typing `dirban plan promote 001 002` is much faster and more natural than typing full prefixes (`26-001 26-002`).

Furthermore, batch promotion currently operates best-effort: if multiple tasks are requested (e.g. `dirban plan promote 001 002 999`), valid tasks are moved immediately even if one task fails (e.g. not found, blocked, or ambiguous). In batch workflow operations, partial failure can leave the board in an unintended split state.

This task introduces:
1. **Short Task ID Suffix Resolution**:
   - Allows users to specify short IDs like `001` or `1` to match `26-001` in the backlog.
   - Detects duplicates/ambiguities: if multiple backlog tasks match the short ID (e.g. `25-001` and `26-001`), the CLI must fail with an explicit duplicate/ambiguous error, showing the candidates and requiring the full ID.
2. **Atomic / All-or-Nothing Pre-Validation for Batch Promotion**:
   - Before executing any file moves, all target IDs in the batch must be resolved, validated, and checked for blockers.
   - If *any* task fails validation (not found, duplicate/ambiguous short ID, or blocked by dependencies), **no tasks are moved**.
   - Clear, consolidated error messages are displayed for all failing items.

## Key Changes

1. **Short ID Resolution in Backlog (`resolveBacklogTaskId`)**:
   - Matches exact ID first (`26-001`, `task.26-001`, filename).
   - If no exact match, matches by numeric suffix:
     - Handles normalized suffix (e.g. `001` matching `26-001`, or numeric `1` matching `-001` / `-1`).
   - If exactly 1 backlog task matches, returns `ok(task)`.
   - If > 1 backlog tasks match, returns `err({ kind: "AMBIGUOUS_TASK_ID", id: query, matches })`.
   - If 0 matches, returns `err({ kind: "TASK_NOT_FOUND", id: query })`.

2. **Atomic Batch Validation in `promoteTasks`**:
   - Two-phase execution:
     - **Phase 1 (Validation)**: Resolves each requested ID and evaluates whether it is blocked. Accumulates all errors.
     - **Phase 2 (Execution)**: Only if validation passes with 0 errors, performs the filesystem moves (`moveTask`) for each task.
   - If any error occurs in Phase 1, aborts with 0 tasks moved.

3. **CLI Feedback**:
   - Clear error output when ambiguity occurs:
     `✖ Ambiguous short task ID '001': matches multiple tasks [25-001, 26-001]. Please specify full task ID.`
   - Clean report when batch validation fails:
     `✖ Promotion aborted: 2 errors found. No tasks were moved.`

## Acceptance Criteria

- [ ] Implement `resolveBacklogTaskId(backlogTasks, query)` supporting exact IDs and short numeric suffixes (`001`, `1`).
- [ ] Return an explicit `AMBIGUOUS_TASK_ID` error when a short ID matches multiple tasks in the backlog, listing all matching IDs.
- [ ] Refactor `promoteTasks` in `src/operations/plan.ts` into a two-phase atomic execution (validate all tasks before moving any).
- [ ] Ensure that if any task in a multi-task promotion fails validation (not found, ambiguous, or blocked), **0 tasks are moved**.
- [ ] Update `handlePlan` in `src/cli/commands/plan.ts` to output clear error details and exit with non-zero code on failure.
- [ ] Add unit test vectors in `src/operations/operations.test.ts` (or `src/operations/plan.test.ts`):
  1. Promoting with short ID `001` resolves to `26-001` cleanly.
  2. Duplicate short ID in backlog fails with `AMBIGUOUS_TASK_ID` and does not move the card.
  3. Batch promotion with one invalid/blocked ID aborts the entire batch without moving any valid task.
- [ ] Ensure all existing tests pass and TypeScript check passes (`bun test && bun x tsc --noEmit`).
