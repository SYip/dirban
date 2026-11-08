---
id: "26-013"
title: "Support 'none' and current-branch strategy in dirban start and done"
type: "task"
status: "backlog"
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
  depends_on: []
  blocks: []
  related_to:
    - "26-003"
    - "26-005"
    - "26-007"
    - "26-012"
---

# Support 'none' and current-branch strategy in dirban start and done

Allows users to manage tasks through `dirban start` and `dirban done` while remaining on their current Git branch, without creating, switching, or auto-merging Git branches or worktrees.

Supports trunk-based development, pre-created feature branches, and pure filesystem Kanban workflows where branch switching adds friction.

## Key Changes

1. **Config Expansion**:
   - Expand `BranchStrategy` in `src/config/types.ts`:
     ```ts
     export type BranchStrategy = "checkout" | "worktree" | "none"
     ```
   - Support `"branchStrategy": "none"` in `.dirban.json` and `.vscode/settings.json`.

2. **CLI Flags**:
   - Add `--no-branch` (alias: `--current`) flag to `dirban start` in `CLI_PARSE_OPTIONS` (`src/cli/commands/types.ts`).
   - CLI invocation example: `dirban start 26-001 --no-branch` (or `--current`).

3. **Lifecycle Behavior on `dirban start`**:
   - Card transitions to the active work column (e.g. `02-doing` or resolved focus column).
   - Skips branch creation and worktree provisioning.
   - Detects the current active branch and reports:
     `✔ Moved task <id> to <column>`
     `Git notice: Staying on current branch <branch> (strategy: none).`

4. **Lifecycle Behavior on `dirban done`**:
   - When `strategy === "none"` (or if on a non-task branch / base branch):
     - Card transitions to the completed column on the filesystem.
     - Commits task completion on the current branch (if in a Git repo).
     - Skips Git auto-merge into base branch and skips branch deletion/cleanup.
     - Reports clean status without "Not currently on task branch" warning noise:
       `✔ Completed task <id> (moved to <column>)`
       `Git notice: Card completion recorded on branch <branch> (branch strategy: none).`

## Acceptance Criteria

- [ ] Expand `BranchStrategy` type in `src/config/types.ts` to include `"none"`.
- [ ] Add `--no-branch` / `--current` flag parsing in `src/cli/commands/types.ts` and wire into `handleStart` in `src/cli/commands/lifecycle.ts`.
- [ ] Update `startTask` in `src/operations/start.ts` to handle `strategy === "none"` cleanly, skipping branch creation/checkout and reporting the current active branch.
- [ ] Update `doneTask` in `src/operations/done.ts` to respect `strategy === "none"` (or `config.branchStrategy === "none"`), committing the completed card directly to the active branch without merging or branch deletion.
- [ ] Add unit test vectors in `src/operations/operations.test.ts` verifying `strategy: "none"` across both `startTask` and `doneTask`.
- [ ] Verify test suite and typechecks pass (`bun test && bun run typecheck`).
