---
id: 26-037
title: Standardize Clickable File and Worktree Paths Across All CLI Lifecycle Commands
status: backlog
priority: p2
assignee: unassigned
tags:
  - cli
  - ux
  - dx
  - terminal
  - formatting
created: 2026-11-12T11:20:00Z
updated: 2026-11-12T11:20:00Z
relationships:
  depends_on: []
---

# Standardize Clickable File and Worktree Paths Across All CLI Lifecycle Commands

## Problem Statement
When running lifecycle and mutation commands in the terminal (such as `dirban new`, `dirban start`, `dirban ready`, `dirban block`, `dirban move`, `dirban done`, and `dirban archive`), the CLI currently outputs status text and task IDs (e.g. `✔ Successfully started task 26-036 on branch task/26-036-eval...`), but often omits the exact relative file path on disk.

In modern terminal emulators (VS Code integrated terminal, iTerm2, Ghostty, Warp, Alacritty), printed relative file paths are automatically detected as clickable hyperlinks (`Cmd+Click` or `Ctrl+Click` to open the file directly in the editor). Furthermore, AI agents parsing CLI stdout need the exact file path to immediately perform tool calls (such as reading or updating criteria) without needing an extra exploratory `ls` command.

## Proposed Solution
Standardize CLI success and status output across all mutation and lifecycle commands so they consistently display the normalized relative file path (and worktree path where applicable):

1. **`dirban new`**:
   - `✔ Created task 26-037: docs/tasks/backlog/26-037-my-task.md`
2. **`dirban ready`**:
   - `✔ Readied task 26-037: docs/tasks/01-todo/26-037-my-task.md`
3. **`dirban start`**:
   - `✔ Started task 26-037: docs/tasks/02-doing/26-037-my-task.md`
   - If worktree strategy is active: `  Worktree: ../.dirban.worktrees/26-037 (cd <path>)`
4. **`dirban block`**:
   - `⛔ Blocked task 26-037: docs/tasks/backlog/26-037-my-task.md`
5. **`dirban unblock`**:
   - `✔ Unblocked task 26-037: docs/tasks/backlog/26-037-my-task.md`
6. **`dirban move`**:
   - `✔ Moved task 26-037 to '03-done': docs/tasks/03-done/26-037-my-task.md`
7. **`dirban done`**:
   - `✔ Completed task 26-037: docs/tasks/03-done/26-037-my-task.md`
8. **`dirban archive`**:
   - `✔ Archived task 26-037: docs/tasks/archive/2026/26-037-my-task.md`
9. **`dirban current`**:
   - In formatted output: include clickable `File: docs/tasks/02-doing/26-037-my-task.md`

## Technical Details
- Format paths relative to `ctx.cwd` using `path.relative(ctx.cwd, task.filePath)`.
- Ensure paths use POSIX forward slashes (`/`) across all platforms (including Windows) so terminal URL parsers recognize them cleanly.
- Dim or highlight file paths with a clean terminal styling (e.g. `pc.cyan(relativePath)` or `pc.underline(relativePath)`).

## Acceptance Criteria
- [x] Audit and update CLI handlers in `src/tasks/lifecycle/` (`start.cli.ts`, `ready.cli.ts`, `done.cli.ts`, `current.cli.ts`).
- [x] Audit and update CLI handlers in `src/tasks/mutation/` (`create.cli.ts`, `move.cli.ts`, `archive.cli.ts`).
- [x] Audit and update CLI handlers in `src/tasks/planning/` (`block.cli.ts`).
- [x] Ensure all file paths output are relative to the working directory and formatted with forward slashes.
- [x] Output worktree folder paths on `dirban start` when worktree strategy is used.
- [x] Verify test suite covers updated console output and formatters.
