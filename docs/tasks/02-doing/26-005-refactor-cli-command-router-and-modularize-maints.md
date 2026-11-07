---
id: "26-005"
title: "Refactor CLI command router and modularize main.ts"
type: "task"
status: "01-todo"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-07"
last_updated: "2026-11-07"
tags:
  - cli
  - refactor
  - architecture
relationships:
  depends_on: []
  blocks: []
  related_to:
    - docs/tasks/03-done/26-003-task-execution-lifecycle-and-git-flow.md
---

# Refactor CLI command router and modularize main.ts

Decomposes the monolithic `main.ts` file (~590 lines) and long `runCli` switchboard function into cohesive, domain-grouped CLI command handlers under `src/cli/commands/`.

Relies on standard library `parseArgs` (`node:util`) without adding external CLI framework dependencies, ensuring fast execution and zero runtime bloat.

## Acceptance Criteria

- [x] Create `src/cli/commands/` directory structure with domain-grouped handlers:
  - `types.ts`: Define `CliContext` and `CommandHandler` types.
  - `router.ts`: Command dispatch registry table mapping command names & aliases to handlers.
  - `lifecycle.ts`: Handlers for `current` (alias `focus`), `start` (alias `worktree add`), and `done` (alias `finish`).
  - `task-mutation.ts`: Handlers for `new` (alias `create`), `move`, `check`, `set`, and `archive`.
  - `board.ts`: Handlers for `board` (interactive TUI / static table) and `view`.
  - `system.ts`: Handlers for `init`, `next-id`, `priorities`, and formatted `help`.
- [x] Slim `main.ts` down to `< 70 lines` focusing strictly on CLI entrypoint bootstrapping, flag parsing via `parseArgs`, and routing via `dispatchCommand`.
- [x] Preserve all existing CLI flag options, aliases, stdout outputs, and exit codes.
- [x] Existing and new unit tests pass (`bun test`).
- [x] Strict TypeScript checks pass with zero errors (`bun run typecheck`).
