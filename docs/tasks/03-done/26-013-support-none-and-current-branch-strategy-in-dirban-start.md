---
id: "26-013"
title: "Support 'none' and current-branch strategy in dirban start and done"
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
  depends_on: []
  blocks: []
  related_to:
    - "26-003"
    - "26-005"
    - "26-007"
    - "26-012"
---

# Support 'none' / current-branch strategy and no-merge in dirban start and done

Allows users to manage tasks through `dirban start` and `dirban done` while remaining on their current Git branch, without creating, switching, or auto-merging Git branches or worktrees.

Furthermore, even when working on task branches or in multi-stage workflows (e.g. `todo` -> `develop` -> `qa` -> `done`), teams frequently do NOT want `dirban done` to automatically merge or delete branches prematurely. This task adds first-class support for `noMerge` (or `autoMerge: false`) in both configuration and CLI flags.

Supports trunk-based development, pre-created feature branches, multi-stage pipelines, and workflows where branch switching or premature merging adds friction.

## Key Changes

1. **Config Expansion**:
   - Expand `BranchStrategy` in `src/config/types.ts`:
     ```ts
     export type BranchStrategy = "checkout" | "worktree" | "none"
     ```
   - Add `autoMerge?: boolean` to `DirbanConfig` (defaults to `true` when omitted).
   - Support `"branchStrategy": "none"` and `"autoMerge": false` in `.dirban.json` and `.vscode/settings.json`.

2. **CLI Flags**:
   - `dirban start`:
     - Add `--no-branch` (alias: `--current`, `--strategy none`) flag to stay on the current branch.
   - `dirban done`:
     - Add `--no-merge` flag in `CLI_PARSE_OPTIONS` (`src/cli/commands/types.ts`) to move the card to the next column/archive while preserving the branch/worktree without merging into `main`.

3. **Lifecycle Behavior on `dirban start`**:
   - Card transitions to the active work column (e.g. `02-doing` or resolved focus column).
   - Skips branch creation and worktree provisioning when `strategy === "none"`.
   - Detects the current active branch and reports:
     `✔ Moved task <id> to <column>`
     `Git notice: Staying on current branch <branch> (strategy: none).`

4. **Lifecycle Behavior on `dirban done`**:
   - When `--no-merge` is passed, or when `config.autoMerge === false`, or when `strategy === "none"`:
     - Card transitions to the completed column / next column on the filesystem.
     - Skips Git auto-merge into base branch and skips branch deletion/cleanup.
     - Preserves worktrees and branches intact for downstream review, PR creation, or multi-stage QA.
     - Reports clean status:
       `✔ Completed task <id> (moved to <column>)`
       `Git notice: Branch <branch> retained without merging (--no-merge).`

## Acceptance Criteria

- [x] Expand `BranchStrategy` type in `src/config/types.ts` to include `"none"`.
- [x] Add `autoMerge?: boolean` to `DirbanConfig` and parse it from `.dirban.json` and `.vscode/settings.json`.
- [x] Add `--no-merge` flag to `CLI_PARSE_OPTIONS` and `CliFlags` (`src/cli/commands/types.ts`).
- [x] Add `--no-branch` / `--current` flag parsing in `src/cli/commands/types.ts` and wire into `handleStart` in `src/cli/commands/lifecycle.ts`.
- [x] Update `WorkspaceLifecycleStrategy` / `doneTask` options to accept `noMerge?: boolean`.
- [x] Ensure `GitBranchStrategy` and `GitWorktreeStrategy` respect `options.noMerge || config.autoMerge === false` before executing `autoMergeAndCleanup`, keeping branch and worktree intact when merge is disabled.
- [x] Update `startTask` and workspace strategies to handle `strategy === "none"`, staying on current branch and reporting active branch.
- [x] Add unit test vectors in `src/workspace/strategy.test.ts` and `src/operations/operations.test.ts` verifying:
  1. `start` with `strategy === "none"` keeps current branch without error.
  2. `done` with `--no-merge` skips merge and keeps branch/worktree intact.
  3. `done` with `config.autoMerge: false` skips merge by default.
- [x] Verify test suite and typechecks pass (`bun test && bun x tsc --noEmit`).
