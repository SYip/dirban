---
id: "26-022"
title: "Standardize unified task ID resolution and query parser across all commands"
type: "task"
status: "done"
priority: "p2"
owner: "developer"
assigned_to: "developer"
created_date: "2026-11-09"
last_updated: "2026-11-09"
tags:
  - architecture
  - task-lookup
  - parser
  - ux
relationships:
  depends_on:
    - "26-019"
    - "26-021"
  blocks: []
  related_to:
    - "26-019"
    - "26-020"
---

# Standardize unified task ID resolution and query parser across all commands

## Description

Currently, task lookup is fragmented and inconsistent across commands:
- `dirban plan promote` has short suffix resolution (`001`, `1`) with ambiguity detection in `src/tasks/planning/plan.ts`.
- `dirban view` uses `findTaskWithFuzzy` in `src/board/discovery.ts`.
- `dirban start`, `move`, `check`, `set`, and `block` rely on `findTaskExact` / `findTaskByIdOrName`, which fails when users input short IDs (`001`, `1`).
- Domain logic currently mixes input validation (checking for empty query strings) with search algorithms, violating the "Parse, Don't Validate" boundary principle.

This task unifies task resolution into a standardized, reusable lookup engine in `src/board/discovery.ts` and enforces strict boundary parsing:
1. **Parser Responsibility**: Command parsers validate and normalize raw input strings before reaching domain logic. Domain functions assume queries are valid and non-empty.
2. **Standard 3-Tier Resolution**:
   - **Tier 1 (Exact)**: Matches exact task ID (`26-001`, `task.26-001`) or exact filename stem.
   - **Tier 2 (Numeric Suffix)**: Matches numeric suffix (`001`, `1`) to allow fast terminal interaction. Ambiguous matches return an explicit `AMBIGUOUS_TASK_ID` error listing candidate IDs.
   - **Tier 3 (Fuzzy/Slug)**: Optional for discovery and read-only commands (`view`).
3. **Consistent User Experience**: Short IDs (`dirban start 1`, `dirban move 1 02-doing`, `dirban check 1 2`) work consistently everywhere on the board.

## Acceptance Criteria

- [x] Create a unified query resolution function `findTaskByQuery(tasks, query, options?)` in `src/board/discovery.ts` returning `Result<BoardTask, LookupError>`.
- [x] Support Tier 1 (exact ID/filename) and Tier 2 (numeric suffix like `001` or `1`), with explicit `AMBIGUOUS` error containing all matched candidates.
- [x] Move query sanitization and empty-string validation into command parsers (`parsePlan`, `parseStart`, `parseMove`, etc.), removing defensive empty checks from pure domain operations.
- [x] Refactor `resolveBacklogTaskId` in `src/tasks/planning/plan.ts` to delegate directly to `findTaskByQuery`.
- [x] Update other commands (`start`, `move`, `check`, `set`, `block`, `view`) to leverage the unified lookup so short task IDs work consistently everywhere.
- [x] Add unit test vectors verifying:
  1. Exact ID resolution across board tasks.
  2. Short numeric suffix resolution (`001` -> `26-001`, `1` -> `26-001`).
  3. Ambiguity detection when multiple tasks share the same numeric suffix.
  4. Scope filtering (e.g., scoping search to backlog vs all board tasks).
- [x] Ensure all tests pass (`bun test`) and TypeScript strict check passes (`bun run typecheck`).
