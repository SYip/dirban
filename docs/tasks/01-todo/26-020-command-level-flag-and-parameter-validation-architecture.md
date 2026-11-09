---
id: "26-020"
title: "Command-level flag and parameter validation architecture"
type: "task"
status: "todo"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
tags:
  - cli
  - validation
  - architecture
relationships:
  depends_on:
    - "26-012"
  blocks: []
  related_to:
    - "26-014"
---

# Command-level flag and parameter validation architecture

Establish command-level parameter and flag validation across Dirban CLI commands so each command validates its own supported flags, positional arguments, and mutually exclusive combinations prior to execution.

## Background & Rationale

Currently, `util.parseArgs` globally defines CLI options, and configuration validation runs in the router before dispatch. However:
1. Commands do not declare or validate their own mutually exclusive flag combinations (e.g., `--merge` and `--no-merge` on `dirban done`, or `--worktree` and `--no-branch` on `dirban start`).
2. Conflicting or invalid flags are either silently prioritized or handled ad-hoc inside command execution handlers.
3. Placing validation as a first-class step on `CommandDefinition` keeps execution handlers focused purely on operation logic and provides clear, actionable user errors.

## Key Changes

1. **`CommandDefinition` Enhancement**:
   - Add optional `validate?: (ctx: CliContext) => Result<void, CommandValidationError>` to `CommandDefinition` in `src/cli/commands/types.ts`.
   - Define `CommandValidationError` type representing validation failure with an informative message.

2. **Router Integration**:
   - In `dispatchCommand` in `src/cli/commands/router.ts`, invoke `cmdDef.validate(ctx)` after global config validation and before `cmdDef.execute(ctx)`.
   - If validation fails, print formatted error with optional usage guidance and return non-zero exit code (`1`).

3. **Command Validations**:
   - `doneCommand`: Validate mutually exclusive `--merge` and `--no-merge`.
   - `startCommand`: Validate mutually exclusive `--worktree` and `--current` / `--no-branch`.
   - Positionals validation for commands requiring specific arguments.

## Acceptance Criteria

- [ ] Add `validate` hook and `CommandValidationError` to `CommandDefinition` in `src/cli/commands/types.ts`.
- [ ] Update `dispatchCommand` in `src/cli/commands/router.ts` to execute command validation prior to `execute`.
- [ ] Implement validator for `doneCommand` rejecting `--merge` combined with `--no-merge`.
- [ ] Implement validator for `startCommand` rejecting `--worktree` combined with `--no-branch` / `--current`.
- [ ] Add unit test vectors in `src/cli/commands/router.test.ts` verifying command validation halts execution and returns exit code 1 with clean error messages.
- [ ] Verify test suite and typechecks pass (`bun test && bun run typecheck`).
