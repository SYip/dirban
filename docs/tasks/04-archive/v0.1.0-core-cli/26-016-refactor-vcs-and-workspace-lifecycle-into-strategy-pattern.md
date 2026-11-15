---
id: "26-016"
title: "Refactor VCS and Workspace Lifecycle into Strategy Pattern (Directory-Only, Git Branch, Git Worktree)"
type: "task"
status: "doing"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
relationships:
  depends_on:
    - "26-007"
tags:
  - refactor
  - architecture
  - vcs
  - git
  - strategy-pattern
---

# Refactor VCS and Workspace Lifecycle into Strategy Pattern (Directory-Only, Git Branch, Git Worktree)

## Description
Currently, `src/operations/start.ts` and `src/operations/done.ts` interleave two distinct dimensions:
1. **Board Card Transition (Filesystem / Kanban)**: Moving task markdown files between columns or to archive (`focusColumn`, handoff column `focus + 1`, or flat `archive/`).
2. **Workspace & VCS Lifecycle (Environment)**: Managing branch creation, checkout, worktree allocation, merging, and worktree cleanup.

This creates tangled branching conditions with multiple nested `if` statements checking Git availability, branch names, worktree flags, and fallback strings.

This task refactors the VCS and workspace lifecycle into an explicit **Strategy Pattern** with three well-defined lifecycle strategies:
- **`DirectoryOnlyStrategy`**: Pure filesystem operations. Does not invoke git or mutate branches/worktrees. Always succeeds with `gitSkipped: true`.
- **`GitBranchStrategy`**: Handles in-place branch checkouts (`task/<id>-<title>`) on start, and automated squash/merge back into `main` and branch deletion on done.
- **`GitWorktreeStrategy`**: Handles isolated sibling worktree allocation (`../.{repo}.worktrees/<id>-<title>`) on start, and automated merge, worktree removal, and branch cleanup on done.

### CLI Strategy Options & Automatic Runtime Detection
- **Consolidated Parameter**: `dirban start <id> [--strategy <checkout|worktree|directory-only>]`
  - Shorthands: `--worktree` (`--strategy worktree`), `--checkout` (`--strategy checkout`), and `--no-git` (`--strategy directory-only`).
- **Automatic Detection on `done`**: `dirban done [id]` automatically detects the environment:
  - If executed inside a worktree (`vcsCtx.isWorktree`) or a worktree exists for the task -> automatically invokes `GitWorktreeStrategy`.
  - If active on a matching task branch -> automatically invokes `GitBranchStrategy`.
  - If git is absent or `--no-git` is passed -> invokes `DirectoryOnlyStrategy`.
  - Users can still explicitly pass `--strategy <type>` or `--no-git` on `done` to override detection.

## Acceptance Criteria
- [x] Define `WorkspaceLifecycleStrategy` interface with `onStart(task, ctx, options)` and `onDone(task, ctx, options)` returning explicit `Result`.
- [x] Implement `DirectoryOnlyStrategy` for environments without Git or when `--no-git` is specified.
- [x] Implement `GitBranchStrategy` encapsulating in-place branch creation, checkout verification, and merge/cleanup.
- [x] Implement `GitWorktreeStrategy` encapsulating isolated sibling worktree provisioning, path resolution, and worktree removal/pruning.
- [x] Implement strategy selector/factory `resolveWorkspaceStrategy` and runtime detector `detectWorkspaceDoneStrategy` that deterministically picks the correct strategy based on CLI flags (`--strategy`, `--worktree`, `--checkout`, `--no-git`), config (`branchStrategy`), and runtime Git environment (worktree detection, active branch).
- [x] Refactor `startTask` and `doneTask` to delegate VCS lifecycle management to the resolved strategy, separating board transitions from workspace mutations.
- [x] Add unit test vectors in `operations.test.ts` and `src/workspace/strategy.test.ts` verifying each strategy and automatic detection in complete isolation.
- [x] Ensure all existing tests pass and TypeScript typecheck passes with 0 errors.

