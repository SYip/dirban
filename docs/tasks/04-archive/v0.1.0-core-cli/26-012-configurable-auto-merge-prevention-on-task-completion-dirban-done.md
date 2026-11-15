---
id: "26-012"
title: "Configurable auto-merge prevention on task completion (dirban done)"
type: "task"
status: "doing"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
tags:
  - cli
  - git
  - config
  - lifecycle
relationships:
  depends_on:
    - "26-007"
  blocks: []
  related_to:
    - "26-003"
    - "26-005"
---

# Configurable auto-merge prevention on task completion (dirban done)

Provides configuration and CLI options to prevent automatic local merging into the base branch (`main`) when completing a task with `dirban done`.

In PR-based team workflows, CI-gated environments, or code-review setups, developers frequently need task branches preserved so they can push and submit a pull request rather than directly merging into the base branch.

## Key Changes

1. **Configuration Setting**:
   - Add optional `autoMerge?: boolean` property to `DirbanConfig` (`.dirban.json` and `.vscode/settings.json` under `dirban.autoMerge`).
   - Default remains `true` (or preserves existing behavior) when omitted, maintaining backward compatibility.

2. **CLI Flags**:
   - Add `--no-merge` (explicitly disable merge on invocation) and `--merge` (force merge regardless of config setting) to `dirban done`.
   - Update `CLI_PARSE_OPTIONS` in `src/cli/commands/types.ts` and `src/cli/commands/lifecycle.ts`.

3. **Lifecycle Behavior on Non-Merge**:
   - Card transitions cleanly to the target completed column (the configured done/handoff column determined by the board workflow) on the filesystem.
   - Task completion move is committed on the current task branch.
   - Local merge into the base branch (`main`) is skipped, and worktree / task branch is kept intact.
   - Outputs a clear informative message: `Git notice: Auto-merge skipped. Changes committed to branch <branch>. Ready to push or PR.`

## Acceptance Criteria

- [x] Add `autoMerge?: boolean` to `DirbanConfig` schema in `src/config/types.ts` and default loading in `src/config/config.ts`.
- [x] Add `--no-merge` and `--merge` flag support to `CLI_PARSE_OPTIONS` and pass resolved preference into `doneTask`.
- [x] Update `doneTask` in `src/operations/done.ts` to respect `autoMerge` option, committing the card completion to the task branch without merging into `baseBranch` or removing the worktree.
- [x] Preserve existing auto-merge behavior when `autoMerge` is true / not explicitly disabled.
- [x] Add unit test vectors in `src/operations/operations.test.ts` verifying `autoMerge: false` skips Git merge while successfully transitioning the card to the configured completed column.
- [x] Verify test suite and typechecks pass (`bun test && bun run typecheck`).
