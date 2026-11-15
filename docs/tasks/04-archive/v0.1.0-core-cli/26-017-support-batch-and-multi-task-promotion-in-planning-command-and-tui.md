---
id: "26-017"
title: "Support Batch and Multi-Task Promotion in Planning Command and TUI"
type: "task"
status: "doing"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
relationships:
  depends_on:
    - "26-004"
tags:
  - planning
  - cli
  - tui
  - batch-operations
---

# Support Batch and Multi-Task Promotion in Planning Command and TUI

## Description
Currently, `dirban plan --promote=<id>` only accepts a single task ID. When planning a sprint or milestone triage, developers and agents often need to promote several ready tasks into the active pipeline (`01-todo`) at once.

This task expands `dirban plan` to support batch/multi-task promotion across CLI arguments, flags, and the interactive planning TUI:
1. **Comma-Separated & Multi-ID Flags**:
   - `dirban plan --promote=26-001,26-002,26-003`
2. **Promote All Ready Tasks**:
   - `dirban plan --promote=all` or `dirban plan --promote-ready` (promotes all backlog tasks whose dependencies are satisfied).
3. **Subcommand / Positional Syntax**:
   - `dirban plan promote <id1> <id2> ...`
4. **Interactive TUI Multi-Selection**:
   - In `dirban plan -i`, allow multi-selecting tasks with `Space` and pressing `p` or `Enter` to promote all selected tasks simultaneously.

## Acceptance Criteria
- [x] Update `handlePlan` to accept comma-separated IDs in `--promote=<id1>,<id2>,...`.
- [x] Support `--promote=all` to promote all currently ready (unblocked) backlog tasks in priority order.
- [x] Support positional syntax `dirban plan promote <id1> <id2> ... [--to=<column>]`.
- [x] Provide clear CLI output listing each promoted task and any failures if blocked or not found.
- [x] Enable multi-task selection (toggle with `Space`, promote with `p`) in interactive plan TUI (`dirban plan -i`).
- [x] Add unit tests verifying batch promotion with multiple task IDs and `--promote=all`.
- [x] Verify error handling when one of the specified tasks is blocked or not found (atomic report or best-effort promotion with summary).

