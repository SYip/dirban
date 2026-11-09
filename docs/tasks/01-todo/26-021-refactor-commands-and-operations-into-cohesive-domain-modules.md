---
id: "26-021"
title: "Refactor commands and operations into cohesive business domain modules"
type: "task"
status: "todo"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
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

## Key Changes

1. **Domain-Driven Directory Structure**:
   Group business features into clear domain modules:
   - `src/tasks/lifecycle/`: `start.ts`, `done.ts`, `current.ts`, `next.ts` (with colocated command definitions or adapters).
   - `src/tasks/mutation/`: `create.ts`, `move.ts`, `check.ts`, `set.ts`, `archive.ts`.
   - `src/tasks/planning/`: `plan.ts`, `block.ts`, `unblock.ts`.
   - `src/cli/`: Presentation harness only (`router.ts`, `formatters.ts`, CLI types).

2. **Colocated Commands & Tests**:
   - Each domain feature exports its core operation function and its optional CLI command definition/parser from the same cohesive domain folder.
   - Test suites remain colocated with the code they verify.

3. **Router Registry**:
   - `src/cli/commands/router.ts` imports command definitions from their respective domain modules for centralized CLI registration and dispatch.

## Acceptance Criteria

- [ ] Consolidate `src/operations/` and `src/cli/commands/` into cohesive business domain directories under `src/tasks/` or top-level domain folders.
- [ ] Colocate CLI command definitions, parsers, and execution handlers with their corresponding domain logic.
- [ ] Keep `src/cli/` strictly as a lightweight presentation runner (router, argument parsing, terminal formatting).
- [ ] Update all relative imports across the codebase and test suites cleanly.
- [ ] Verify test suite and typechecks pass (`bun test && bun run typecheck`).
