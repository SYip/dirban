---
id: "26-021"
title: "Refactor commands and operations into cohesive business domain modules"
type: "task"
status: "doing"
priority: "p2"
owner: "developer"
assigned_to: "developer"
created_date: "2026-11-09"
last_updated: "2026-11-09"
tags:
  - refactor
  - architecture
  - domain-driven
  - file-organization
relationships:
  depends_on:
    - "26-020"
  blocks: []
  related_to:
    - "26-014"
---

# Refactor commands and operations into cohesive business domain modules

Align the repository structure with Dirban's domain-driven file naming standards by eliminating the artificial technical split between `src/cli/commands/` and `src/operations/`, grouping domain operations, CLI adapters, and tests by cohesive business feature.

## Background & Rationale

Per `.agents/rules/file-naming.md`:
> *"Organize by Business Domain: Group code, types, and logic around business features/concepts, never by technical artifact types."*

Currently, business logic lives in `src/operations/` (e.g. `start.ts`, `done.ts`, `create.ts`), while CLI representations live in a separate technical hierarchy under `src/cli/commands/` (e.g. `lifecycle.ts`, `task-mutation.ts`). This creates:
1. **Shotgun Surgery**: Changes to a business feature require updating files across separate technical directories (`src/cli/commands/` and `src/operations/`).
2. **Coupling to Presentation Layer**: Features are grouped differently in CLI files than in operations files (e.g. `start` and `done` bundled in `lifecycle.ts` vs isolated in `operations/`).
3. **Impediment to VS Code Integration**: When developing the VS Code extension tree views and commands, operations should be modular domain boundaries reusable across both CLI and editor hosts.

## Architecture & Naming Convention

Domain modules adhere to a clean separation between pure domain operations and presentation adapters:
- `<feature>.ts`: Pure functional domain operations returning `Result<T, OperationError>`. Free of CLI dependencies (no `picocolors`, `console.log`, or `CliContext`).
- `<feature>.cli.ts`: CLI adapter containing `CommandDefinition`, `parse<Feature>`, and `handle<Feature>`.
- `<feature>.test.ts`: Automated unit and acceptance tests.

## Acceptance Criteria

- [x] **Phase 1: Planning & Dependencies Domain (`src/tasks/planning/`)**
  - Relocate `plan.ts`, `block.ts`, `unblock.ts` and `plan.test.ts` to `src/tasks/planning/`.
  - Separate pure operations (`plan.ts`, `block.ts`, `unblock.ts`) from CLI adapters (`plan.cli.ts`, `block.cli.ts`).
- [x] **Phase 2: Card Mutation & CRUD Domain (`src/tasks/mutation/`)**
  - Relocate `create.ts`, `move.ts`, `check.ts`, `set.ts`, `archive.ts` and `mutation.test.ts` to `src/tasks/mutation/`.
  - Separate pure operations from CLI adapters (`create.cli.ts`, `move.cli.ts`, `check.cli.ts`, `set.cli.ts`, `archive.cli.ts`).
- [ ] **Phase 3: Task Execution Lifecycle Domain (`src/tasks/lifecycle/`)**
  - Relocate `start.ts`, `done.ts`, `next.ts`, `current.ts` and their dedicated unit tests (`start.test.ts`, `done.test.ts`, `next.test.ts`, `current.test.ts`) to `src/tasks/lifecycle/`.
  - Separate pure operations from CLI adapters (`start.cli.ts`, `done.cli.ts`, `next.cli.ts`, `current.cli.ts`, `path.cli.ts`).
- [ ] **Phase 4: Project Scaffolding & Setup (`src/tasks/project/`)**
  - Relocate `init.ts`, `project.test.ts` to `src/tasks/project/`.
  - Separate pure operations from CLI adapters (`init.cli.ts`, `next-id.cli.ts`, `priorities.cli.ts`, `help.cli.ts`).
- [ ] **Phase 5: Board Views & CLI Presentation Harness**
  - Add CLI adapters `board.cli.ts` in `src/board/`.
  - Flatten and simplify `src/cli/` to only contain presentation harness files (`router.ts`, `types.ts`, `formatters.ts`, `tui.ts`, `plan-tui.ts`).
  - Remove obsolete `src/operations/` and `src/cli/commands/` folders.
- [ ] **Phase 6: Verification & Test Suite**
  - Run `bun test` ensuring all tests pass across the new domain structure.
  - Run `bun run typecheck` (`tsc --noEmit`) to verify 0 import or type errors.
