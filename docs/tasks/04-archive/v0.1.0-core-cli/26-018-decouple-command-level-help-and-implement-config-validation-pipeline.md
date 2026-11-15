---
id: "26-018"
title: "Decouple Command-Level Help and Implement Pre-Execution Config Validation Pipeline"
type: "task"
status: "doing"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
relationships:
  depends_on:
    - "26-005"
tags:
  - cli
  - config
  - architecture
  - validation
---

# Decouple Command-Level Help and Implement Pre-Execution Config Validation Pipeline

## Description
Currently, the CLI has two design limitations:
1. **Monolithic Global Help**: `printHelp()` in `system.ts` defines all command descriptions, options, and examples in a single giant string. Running `dirban <cmd> --help` prints the entire global manual rather than focused, command-specific usage.
2. **Missing Pre-Execution Semantic Config Validation**: `loadConfig()` only verifies JSON syntax and defaults. It does not validate domain invariants (e.g. `defaultPriority` must exist in `priorities`, column names must be unique, `tasksDir` must exist for operational commands).

This task introduces a decentralized command definition registry where each command encapsulates its own help/usage, along with a pre-execution validation pipeline.

## Acceptance Criteria
- [x] Define `CommandDefinition` interface with `name`, `aliases`, `summary`, `usage`, `options`, `examples`, and `execute`.
- [x] Refactor command modules (`lifecycle.ts`, `task-mutation.ts`, `board.ts`, `plan.ts`, `system.ts`) to export command definitions encapsulating their own help metadata.
- [x] Implement command-specific help: `dirban <command> --help` or `dirban help <command>` renders targeted usage, flags, and examples for that command.
- [x] Keep global `dirban --help` clean and concise as a high-level command index table with one-line summaries.
- [x] Implement `validateConfig(config, options)` checking:
  - `defaultPriority` is an element of `priorities`.
  - Column names are unique and non-empty.
  - Operational commands (all except `init`, `help`, `--version`) verify that `tasksDir` exists before execution, returning a clean actionable error if uninitialized.
- [x] Add unit test vectors covering command-specific help output and config validation edge cases.
- [x] Ensure all existing tests pass and typecheck passes with 0 errors.

