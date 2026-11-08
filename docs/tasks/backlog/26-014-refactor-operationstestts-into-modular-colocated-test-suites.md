---
id: "26-014"
title: "Refactor operations.test.ts into modular colocated test suites"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
tags:
  - testing
  - refactoring
  - operations
relationships:
  depends_on: []
  blocks: []
  related_to:
    - "26-006"
---

# Refactor operations.test.ts into modular colocated test suites

Decomposes the monolithic `src/operations/operations.test.ts` (over 700 lines, 14 test vectors) into modular, colocated test suites as required by `.agents/rules/tests.md`:

1. **Card Mutation Tests** (`src/operations/mutation.test.ts`):
   - Vector 1 (Move), Vector 2 (Check), Vector 3 (Set).
2. **Project & Lifecycle Storage Tests** (`src/operations/project.test.ts`):
   - Vector 4 (Archive), Vector 5 (Next ID), Vector 6 (Create), Vector 7 (Init), Vector 8 (VSCode workspace).
3. **Task Lifecycle Tests** (`src/operations/lifecycle.test.ts`):
   - Vector 10 (Current task resolution), Vector 11 (Start and Done lifecycle, including ALREADY_STARTED guards).
4. **Planning & Dependency Tests** (`src/operations/plan.test.ts`):
   - Vector 12 (Block & Demotion), Vector 13 (Unblock & Dependency Resolution), Vector 14 (Plan & Promote).
5. **VCS Provider Tests** (`src/vcs/git.test.ts`):
   - Vector 9 (Branch names, worktree derivation, ID extraction, worktree porcelain parsing).

## Acceptance Criteria

- [ ] Split `src/operations/operations.test.ts` into cohesive, domain-scoped test files:
  - `src/operations/mutation.test.ts`
  - `src/operations/project.test.ts`
  - `src/operations/lifecycle.test.ts`
  - `src/operations/plan.test.ts`
  - `src/vcs/git.test.ts`
- [ ] Remove `src/operations/operations.test.ts` once all 14 test vectors are partitioned.
- [ ] Ensure all 14 test vectors maintain strict assertions and preserve identical coverage.
- [ ] Verify test suite and type checking pass (`bun test && bun run typecheck`).
