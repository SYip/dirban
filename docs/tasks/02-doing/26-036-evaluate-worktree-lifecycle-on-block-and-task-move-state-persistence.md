---
id: 26-036
title: Evaluate Worktree Lifecycle on Block and Task Move State Persistence Across Base and Task Branches
status: done
priority: p2
assignee: unassigned
tags:
  - git
  - worktree
  - lifecycle
  - architecture
  - concurrency
created: 2026-11-12T11:06:00Z
updated: 2026-11-12T13:17:00Z
relationships:
  depends_on: []
---

# Evaluate Worktree Lifecycle on Block and Task Move State Persistence Across Base and Task Branches

## Problem Statement
When using `branchStrategy: "worktree"`, two architectural tensions arise around Git branch isolation vs. shared board state:

### 1. Worktree & Branch Lifecycle on Task Block
When a task in progress is blocked (`dirban block <id> <reasons...>`):
- Currently, `dirban block` only demotes the task file in the current working directory to `docs/tasks/backlog/` and writes blocker metadata to frontmatter.
- The Git worktree and task branch (`task/<id>-<slug>`) are deliberately **not** deleted.
- **Tension**:
  - If we automatically prune the worktree, uncommitted agent edits, spike code, or partial criteria work might be permanently lost, or Git will reject removal if files are dirty.
  - If the worktree is kept, it continues consuming disk space, and Git retains a lock on the branch name. Furthermore, if the blocker modification happened in the target/base branch while the task branch was untouched, resuming and merging later risks git merge conflicts.
- **Key question**: When a task is blocked, should Dirban:
  - Keep the worktree (current behavior) with an explicit `dirban prune` / manual cleanup command?
  - Auto-commit dirty worktree state (`wip: task blocked`) before safely removing the worktree?
  - Keep the task branch but prune the worktree directory, recreating the worktree on `dirban start` when unblocked?

### 2. Task Move State Persistence (Target/Base Branch vs. Task Branch)
When an agent or developer starts a task (`dirban start <id>`) with `branchStrategy: "worktree"`:
- The task is moved on disk into `docs/tasks/02-doing/`.
- **Tension**: Which Git branch actually owns and commits that file move?
  - If the move is committed in the **task branch**, the base branch (`main`) still sees the file in `01-todo/` until the task branch merges back. Other concurrent sessions checking out `main` don't see the card in `doing` from their filesystem view (they only collide if they attempt to checkout the same branch/worktree).
  - If the move is committed in the **target/base branch** (`main`):
    - Other sessions immediately see the task in `02-doing/` on `main`.
    - However, creating a commit directly on `main` when starting work may pollute base git history or conflict if multiple agents start tasks concurrently.
    - When the task is later merged from its feature branch, Git must cleanly handle the file path changes without conflicting.

---

## Architectural Decision Summary
Detailed decision records:
- [2026-11-12-worktree-lifecycle-and-state-persistence.md](../../decisions/2026-11-12-worktree-lifecycle-and-state-persistence.md)
- [2026-11-12-minimal-columns-vs-in-task-workflow.md](../../decisions/2026-11-12-minimal-columns-vs-in-task-workflow.md)

### 1. Minimal Board Columns vs. In-Task Workflows
- **Decision**: Keep directory columns strictly minimal and lifecycle-bound: `backlog/` (origin), `01-todo/`, `02-doing/`, `03-done/`, and `archive/` (terminus). Both `backlog/` and `archive/` are mandatory. Users can structure `archive/` however they choose.
- **Workflow in Task**: Intermediate workflow stages (e.g. `develop`, `test`, `review`) are modeled as hierarchical checklists inside the task document itself (`- [ ] **1. Development**`, `- [ ] **2. Test**`), rather than physical filesystem directories.
- **Value**: Eliminates filesystem and git thrashing during task execution. Progress is rendered quantitatively (e.g. 50% criteria complete) via CLI and VS Code extension without requiring complex multi-folder migrations.

### 2. Lifecycle Moves Committed to Target Branch (`main` / `dev`)
- **Action**: All lifecycle transitions (`start`, `block`, `resume`, `done`) commit the task file move directly to the target branch (e.g., `main` or a configured `dev` branch).
- **Sequence for `dirban start`**:
  1. Move file `01-todo/<id>.md` -> `02-doing/<id>.md` on target branch.
  2. Commit on target branch: `chore(task): start <id> <title>`.
  3. Create task worktree/branch branching *from this commit*.
  *(Because the branch starts with the file already in `02-doing/`, both branches share identical file paths, eliminating rename conflicts on merge).*
- **Value**: Preserves true "Directory-as-State" fidelity. Anyone inspecting the filesystem on the target branch sees 100% accurate board status.

### 2. Worktree Retention on `dirban block`
- **Action**: Keep the worktree alive and untouched on `dirban block`. Do not prune or force WIP commits.
- **Rationale**: In-flight agent sessions or developer spikes may have uncommitted changes or active processes waiting on external dependencies or reviews. Preserving the worktree prevents data/context loss.

### 3. Distinct `dirban resume` Command
- **Action**: Separate new task initialization (`dirban start`) from re-entering suspended/blocked tasks (`dirban resume`).
- **Flow**:
  - `dirban start <id>` on an already-started/blocked task alerts the user and delegates to `resume`.
  - `dirban resume <id>` unblocks the task, moves it to `02-doing/` on the target branch, syncs the target branch into the existing worktree, and returns the worktree directory.

### 4. Worktree Audit & Cleanup
- Provide `dirban worktree list` (or `dirban status --worktrees`) to detect stale worktrees against board states.
- Provide `dirban prune` to clean up worktrees for completed or abandoned tasks safely.

---

## Acceptance Criteria
- [x] Document design decision comparing the 3 worktree retention strategies on `dirban block`.
- [x] Evaluate conflict resolution strategy for tasks modified in backlog while their feature branch exists.
- [x] Document clear architectural recommendation on whether `dirban start` moves should commit to base branch or stay on task branch.
- [x] Define UX / CLI commands for detecting and cleaning up orphaned worktrees.
