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

## Acceptance Criteria

- [x] **Phase 1: Planning & Dependencies Domain (`src/tasks/planning/`)**
  - Relocate `plan.ts`, `block.ts`, `unblock.ts` and `plan.test.ts` to `src/tasks/planning/`.
  - Colocate `planCommand`, `blockCommand`, and `unblockCommand` with their respective handlers and schemas.
- [ ] **Phase 2: Card Mutation & CRUD Domain (`src/tasks/mutation/`)**
  - Relocate `create.ts`, `move.ts`, `check.ts`, `set.ts`, `archive.ts` and `mutation.test.ts` to `src/tasks/mutation/`.
  - Colocate `newCommand`, `moveCommand`, `checkCommand`, `setCommand`, and `archiveCommand` with their respective handlers and `parseNew`.
- [ ] **Phase 3: Task Execution Lifecycle Domain (`src/tasks/lifecycle/`)**
  - Relocate `start.ts`, `done.ts`, `next.ts`, `current.ts` and their dedicated unit tests (`start.test.ts`, `done.test.ts`, `next.test.ts`, `current.test.ts`) to `src/tasks/lifecycle/`.
  - Colocate `startCommand`, `doneCommand`, `nextCommand`, `currentCommand`, and `pathCommand` with their respective parsers and handlers.
- [ ] **Phase 4: Project Scaffolding & Setup (`src/tasks/project/`)**
  - Relocate `init.ts`, `project.test.ts` to `src/tasks/project/`.
  - Colocate `initCommand`, `nextIdCommand`, `prioritiesCommand`, and `helpCommand`.
- [ ] **Phase 5: Board Views & CLI Presentation Harness**
  - Colocate `boardCommand` and `viewCommand` in `src/board/`.
  - Flatten and simplify `src/cli/` to only contain presentation harness files (`router.ts`, `types.ts`, `formatters.ts`, `tui.ts`, `plan-tui.ts`).
  - Remove obsolete `src/operations/` and `src/cli/commands/` folders.
- [ ] **Phase 6: Verification & Test Suite**
  - Run `bun test` ensuring all 75 tests pass across the new domain structure.
  - Run `bun run typecheck` (`tsc --noEmit`) to verify 0 import or type errors.
