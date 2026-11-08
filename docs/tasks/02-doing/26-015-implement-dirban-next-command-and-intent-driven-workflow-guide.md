---
id: "26-015"
title: "Implement dirban next command and intent-driven workflow guide"
type: "task"
status: "doing"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
tags:
  - cli
  - workflow
  - ux
  - docs
relationships:
  depends_on:
    - "26-007"
  blocks: []
  related_to:
    - "26-006"
---

# Implement dirban next command and intent-driven workflow guide

Introduces `dirban next` to answer the question *"What should I focus on next?"* and provides an intent-driven "How to Use" guide mapped across the 3 core phases of work:

## 1. The 3 Core Workflow Phases & User Questions

### Phase 1: Planning (Intake & Triage)
- **"What unblocked tasks can we schedule?"** $\rightarrow$ `dirban plan` (or `dirban plan --ready`)
- **"What is holding up blocked work?"** $\rightarrow$ `dirban plan --blocked`
- **"How do I prioritize/schedule a task for execution?"** $\rightarrow$ `dirban plan --promote=<id>` (moves from backlog into `01-todo`)

### Phase 2: Action (Execution Lifecycle)
- **"What should I focus on next?"** $\rightarrow$ `dirban next` (picks the single highest-priority task from `focusColumn - 1`, e.g. `01-todo`)
- **"How do I start working on it?"** $\rightarrow$ `dirban start <id>` (moves to `focusColumn`, provisions branch or worktree)
- **"What am I currently doing?"** $\rightarrow$ `dirban current` (inspects active task, progress, criteria checklist, and relative path link)
- **"How do I complete my task?"** $\rightarrow$ `dirban done` (advances to `focusColumn + 1`, e.g. `03-done`, auto-merges branch/worktree)

### Phase 3: Review & Inspection
- **"Where do things stand overall?"** $\rightarrow$ `dirban board` (interactive TUI or `--static` overview)
- **"What are the full details and acceptance criteria of a task?"** $\rightarrow$ `dirban view <id>`
- **"Is the task ready for merge / review?"** $\rightarrow$ `/code-review` / automated git checks
- **"What work has already been completed / historical record?"** $\rightarrow$ `dirban archive` (partitions `03-done` into `archive/YYYY/`)

## 2. `dirban next` Command Specification
- Resolves the queue preceding the active focus column (`focusIndex - 1`, e.g. `01-todo`).
- Selects the single top-priority task (P0 $\rightarrow$ P1 $\rightarrow$ P2 $\rightarrow$ P3, ordered by recency).
- If `focus - 1` is empty, informs user that no scheduled tasks remain and suggests running `dirban plan` to promote candidates.
- Outputs task title, ID, priority badge, clickable file link, and a copy-pasteable `dirban start <id>` prompt.
- Includes a `--raw` flag outputting only the task ID for scriptability (e.g. `dirban start $(dirban next --raw)`).

## Acceptance Criteria

### CLI Command `dirban next`
- [x] Implement `handleNext` in `src/cli/commands/lifecycle.ts` and register `next` in `src/cli/commands/router.ts`.
- [x] Target the column immediately preceding `focusColumn` (`focusIndex - 1`, typically `01-todo`).
- [x] Pick the highest-priority task and format a clean terminal view with OSC 8 link and `dirban start <id>` instructions.
- [x] Gracefully handle empty todo columns by suggesting `dirban plan` to promote unblocked backlog tasks.
- [x] Support `--raw` flag to print bare task ID to stdout for shell composition.

### Documentation & Intent-Driven Guide
- [x] Update `README.md` and `docs/cli-reference.md` with a question-and-answer intent mapping table covering Planning, Action, and Review phases.
- [x] Update `dirban help` command summary to list `next`.

### Testing & Verification
- [x] Add unit tests in `src/operations/next.test.ts` and `src/cli/commands/router.test.ts` covering:
  - Vector 1: Standard case with multiple prioritized tasks in todo column.
  - Vector 2: Empty todo column with guidance fallback.
  - Vector 3: `--raw` flag outputting bare ID.
- [x] Ensure all tests pass (`bun test && bun x tsc --noEmit`).
