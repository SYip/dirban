---
id: "26-007"
title: "Configurable Focus Column with Automated Todo and Done Relative Transitions"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-07"
last_updated: "2026-11-07"
tags:
  - config
  - workflow
  - operations
---

# Configurable Focus Column with Automated Todo and Done Relative Transitions

## Description
Currently, `dirban start`, `dirban current`, and `dirban done` rely on heuristic substring matching (`"02-doing"`, `"doing"`, `"progress"`, `"03-done"`). This breaks whenever users configure custom workflows (e.g., `["todo", "develop", "test", "production"]`).

By introducing a configurable `focusColumn` (with auto-detection fallback), roles focus on a single active column:
- `focusColumn`: The primary active work stage (e.g. `develop` or `02-doing`).
- `start`: Moves work into `focusColumn`.
- `current`: Resolves active tasks in `focusColumn`.
- `done`: Advances completed work to `focus + 1` (the handoff stage, e.g. `test` or `03-done`).

## Acceptance Criteria
- [ ] Add optional `focusColumn?: string` to `DirbanConfig` schema and parsing logic in `src/config/`.
- [ ] Implement focus column resolution helper that respects explicit `config.focusColumn`, falls back to substring match (`doing` / `progress`), or defaults to `columns[1]` (or middle column).
- [ ] Update `dirban start` operation to move target task into resolved `focusColumn`.
- [ ] Update `dirban current` operation to track active tasks in resolved `focusColumn`.
- [ ] Update `dirban done` operation to transition task to relative `focus + 1` column (or last column if focus is at end).
- [ ] Add unit tests verifying custom workflows (e.g. `["todo", "develop", "test", "production"]` with `focusColumn: "develop"`).
- [ ] Verify existing default workflow (`backlog`, `01-todo`, `02-doing`, `03-done`) continues working without breaking changes.
