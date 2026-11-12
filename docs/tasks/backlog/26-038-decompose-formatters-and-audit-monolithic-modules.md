---
id: 26-038
title: Decompose formatters and audit monolithic modules into cohesive domain components
status: backlog
priority: p2
assignee: unassigned
tags:
  - refactor
  - architecture
  - cli
  - maintainability
created: 2026-11-12T11:48:00Z
updated: 2026-11-12T11:48:00Z
relationships:
  depends_on: []
---

# Decompose formatters and audit monolithic modules into cohesive domain components

## Problem Statement
Several files in the codebase have evolved into multi-concern "god objects" / monolithic utility buckets:

1. **`src/cli/formatters.ts` (~383 lines)**:
   Houses both fundamental terminal formatting primitives (ANSI colors, OSC 8 hyperlinks, relative path conversions, progress bars) and domain-specific view layouts (`formatBoardView`, `formatTaskDetail`, `formatCurrentTaskView`, `formatPlanView`, `formatNextTaskView`).

2. **`src/vcs/git.ts` (~404 lines)**:
   Contains all raw shell git execution, worktree lifecycle, merge orchestrations, status parsing, branch slugification, and task ID extraction in a single class without modular sub-services.

3. **`src/board/discovery.ts` (~335 lines)**:
   Blends file discovery, column directory walking, filesystem repair / healing, task ID parsing, and multi-mode fuzzy/exact query matching (`resolveTaskIdOrQuery`).

4. **`src/cli/tui.ts` (~418 lines)**:
   Monolithic terminal UI event loop handling keyboard navigation, rendering loops, and task selection.

## Proposed Solution
1. **Decompose `src/cli/formatters.ts`**:
   - Extract core terminal primitives to `src/cli/terminal.ts` or `src/cli/primitives.ts` (`formatTerminalLink`, `toRelativePath`, `formatTaskPathLink`, `getPriorityBadge`, `renderProgressBar`, `formatAcceptanceCriteriaList`).
   - Move domain-specific formatters into their respective domain modules:
     - `src/tasks/lifecycle/current.formatter.ts` (`formatCurrentTaskView`)
     - `src/tasks/lifecycle/next.formatter.ts` (`formatNextTaskView`)
     - `src/tasks/planning/plan.formatter.ts` (`formatPlanView`)
     - `src/board/board.formatter.ts` (`formatBoardView`, `formatTaskDetail`)
   - Re-export for backwards compatibility or update call sites.

2. **Audit & Modularize Secondary God Objects**:
   - Extract query resolution (`resolveTaskIdOrQuery`, `findTaskExact`, `findTaskByIdOrName`) from `src/board/discovery.ts` into `src/board/query.ts`.
   - Separate `src/vcs/git.ts` into targeted helpers (worktrees, branch manipulation, merge routines).

## Acceptance Criteria
- [ ] Extract core terminal and link primitives from `src/cli/formatters.ts` into a lightweight shared primitives module.
- [ ] Colocate domain view formatters into their respective domains (`current.formatter.ts`, `next.formatter.ts`, `plan.formatter.ts`, `board.formatter.ts`).
- [ ] Decompose `src/board/discovery.ts` by extracting task resolution / search logic to `src/board/query.ts`.
- [ ] Update imports across CLI handlers and tests without breaking public API contracts.
- [ ] Ensure all unit and integration tests pass with 100% vector coverage.
