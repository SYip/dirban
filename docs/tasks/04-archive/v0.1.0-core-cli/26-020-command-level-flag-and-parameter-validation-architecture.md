---
id: "26-020"
title: "Type-safe CLI command parser and validation architecture"
type: "task"
status: "doing"
priority: "p2"
owner: "developer"
assigned_to: "developer"
created_date: "2026-11-08"
last_updated: "2026-11-09"
tags:
  - cli
  - validation
  - architecture
  - type-safety
relationships:
  depends_on:
    - "26-012"
  blocks: []
  related_to:
    - "26-014"
    - "26-018"
---

# Type-safe CLI command parser and validation architecture

Establish a type-safe "Parse, don't validate" architecture for Dirban CLI commands so each command validates its raw inputs, rejects conflicting or invalid flags, and passes a guaranteed, strongly-typed parameter object to its execution handler.

## Background & Rationale

Currently, `util.parseArgs` globally defines CLI options, and commands receive raw, untyped `flags` and `positionals` arrays.
1. Command handlers are cluttered with defensive checks (e.g. `if (!title) ...`, checking whether flags conflict, parsing strings into domain types).
2. Conflicting flags (e.g. `--merge` and `--no-merge` on `dirban done`, or `--worktree` and `--no-branch` on `dirban start`) either trigger arbitrary precedence or silently proceed.
3. Placing a pure typed parser function (`parse: (ctx: CliContext) => Result<T, CommandValidationError>`) on `CommandDefinition` separates validation/parsing from business execution. Handlers receive guaranteed valid, domain-ready parameters with 0 defensive boilerplate.

## Key Changes

1. **`CommandDefinition` Enhancement**:
   - Update `CommandDefinition` in `src/cli/commands/types.ts` to support typed parsing:
     ```ts
     export interface CommandValidationError {
       readonly message: string
     }

     export interface CommandDefinition<T = CliContext> {
       readonly name: string
       readonly summary: string
       readonly usage: string
       readonly aliases?: readonly string[]
       readonly options?: readonly CommandOption[]
       readonly requiresTasksDir?: boolean
       readonly parse?: (ctx: CliContext) => Result<T, CommandValidationError>
       readonly execute: (params: T, ctx: CliContext) => Promise<number> | number
     }
     ```

2. **Router Integration**:
   - In `dispatchCommand` in `src/cli/commands/router.ts`:
     - Run global config validation.
     - If `cmdDef.parse` is defined, execute it. If it returns an `Err`, print the error message and command usage, then return exit code `1`.
     - Pass the parsed, type-safe `T` directly into `cmdDef.execute(params, ctx)`.

3. **Command Parsers**:
   - `doneCommand`: Parse and validate into typed `DoneParams`, rejecting conflicting `--merge` and `--no-merge`.
   - `startCommand`: Parse and validate into typed `StartParams`, rejecting `--worktree` combined with `--no-branch` / `--current`.
   - `newCommand`: Parse and validate required `title` and optional priority.

## Acceptance Criteria

- [x] Add `CommandValidationError` and generic `CommandDefinition<T>` with `parse` hook to `src/cli/commands/types.ts`.
- [x] Update `dispatchCommand` in `src/cli/commands/router.ts` to execute `cmdDef.parse` before `cmdDef.execute`, halting on validation errors.
- [x] Implement `parseDone` for `doneCommand` returning typed `DoneParams` and rejecting `--merge` combined with `--no-merge`.
- [x] Implement `parseStart` for `startCommand` returning typed `StartParams` and rejecting `--worktree` combined with `--no-branch` / `--current`.
- [x] Implement `parseNew` for `newCommand` returning typed `NewParams` and validating title presence.
- [x] Add unit test vectors in `src/cli/commands/router.test.ts` verifying parser rejection halts execution and returns exit code 1 with clean messages.
- [x] Verify test suite and typechecks pass (`bun test && bun run typecheck`).
