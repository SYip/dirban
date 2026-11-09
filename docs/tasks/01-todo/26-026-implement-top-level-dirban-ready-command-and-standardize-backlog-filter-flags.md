---
id: "26-026"
title: "Implement Top-Level dirban ready Command and Standardize Backlog Filter Flags"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-09"
last_updated: "2026-11-09"
tags:
  - cli
  - ux
  - workflow
  - lifecycle
relationships:
  depends_on: []
  blocks: []
  related_to:
    - "src/tasks/planning/plan.cli.ts"
    - "src/cli/router.ts"
---

# Implement Top-Level dirban ready Command and Standardize Backlog Filter Flags

Establishes a cohesive, natural 5-verb task lifecycle (`new` -> `ready` -> `start` -> `done` -> `archive`) by introducing a top-level `dirban ready <id...>` command to promote backlog tasks into the active todo queue, while eliminating command/flag collision by renaming `dirban plan --ready` to `dirban plan --unblocked` (with `--no-blocked` alias).

## Problem Statement

1. **Verbose and Unintuitive Promotion**: Promoting tasks currently requires `dirban plan --promote=<ids>` or `dirban plan promote <ids>`, which is long to type and relies on internal project jargon ("promote").
2. **Flag Collision**: If `ready` is introduced as a mutation verb, having `dirban plan --ready` act as a read-only filter creates semantic ambiguity for users.
3. **Workflow Symmetry**: The natural lifecycle progression is `new` -> `ready` -> `start` -> `done` -> `archive`. Having a dedicated `dirban ready` completes this symmetrical 1-word verb model.

## Requirements

1. **Top-Level `dirban ready` Command**:
   - Syntax: `dirban ready <id...> [--to=<column>]` and `dirban ready all`.
   - Supports numeric shorthand (`025` -> `26-025`), multiple batch IDs, and `all`.
   - Moves unblocked tasks from `backlog` into `01-todo` (or configured `--to` column).
   - Keeps `dirban plan -r <id>` and `dirban plan -p <id>` as shortcuts.
2. **Backlog Filter Standardization in `dirban plan`**:
   - Rename filter flag `--ready` to `--unblocked` (filtering only unblocked tasks).
   - Support `--no-blocked` as an alias for `--unblocked`.
   - Maintain backward compatibility for `--ready` as a deprecated filter alias.
3. **Error & Help Guidance Updates**:
   - Update error suggestions in `dirban start` and `dirban done` (e.g., when a task is in `backlog`, suggest `dirban ready <id>` instead of `dirban plan promote <id>`).
   - Update help outputs, formatters, and documentation to feature `dirban ready`.

## Acceptance Criteria

- [ ] Add top-level `dirban ready` command supporting single task IDs, multiple space-separated IDs, numeric short suffixes, and `all`.
- [ ] Support optional `--to=<column>` parameter on `dirban ready`.
- [ ] Add short flags `-r` and `-p` for promotion within `dirban plan` (`dirban plan -r <id>`, `dirban plan -p <id>`).
- [ ] Rename `dirban plan --ready` filter to `--unblocked` and add alias `--no-blocked` (keeping `--ready` as backward-compatible alias).
- [ ] Update `dirban start` and `dirban done` backlog guard error messages and suggestions to recommend `dirban ready <id>`.
- [ ] Update CLI help documentation (`dirban --help`, `dirban help plan`, `dirban help ready`).
- [ ] Add unit tests verifying `dirban ready`, batch execution, `--unblocked`, `--no-blocked`, and error suggestions.
- [ ] Run full test suite and typechecks (`mise exec -- bun test && mise exec -- bun run typecheck`).
