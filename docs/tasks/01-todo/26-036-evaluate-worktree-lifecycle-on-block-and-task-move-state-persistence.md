---
id: 26-036
title: Evaluate Worktree Lifecycle on Block and Task Move State Persistence Across Base and Task Branches
status: backlog
priority: p2
assignee: unassigned
tags:
  - git
  - worktree
  - lifecycle
  - architecture
  - concurrency
created: 2026-11-12T11:06:00Z
updated: 2026-11-12T11:06:00Z
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

## Investigation & Design Scope
1. **Worktree on Block Lifecycle**:
   - Compare "Keep worktree" vs. "WIP commit + prune worktree" vs. "Flagged behavior (`--prune`)".
   - Define how dirty state is preserved without risking data loss.
   - Address merge conflict prevention when task frontmatter is modified in `backlog/` while the task branch is idle.
2. **Board State vs. Feature Branch State**:
   - Analyze whether `docs/tasks/` movements should:
     - Be committed to base branch (`main`) upon `dirban start`.
     - Or remain strictly tracked within the task branch and synchronized at `dirban done`.
     - Or whether shared board state across concurrent sessions should be tracked via a lightweight state file or git notes / orphan branch.
3. **Recovery & Orphan Management**:
   - Propose a clean mechanism (e.g. `dirban status --orphans`, `dirban worktree list`, or `dirban prune`) to detect dead worktrees whose tasks were demoted, cancelled, or finished out-of-band.

## Acceptance Criteria
- [ ] Document design decision comparing the 3 worktree retention strategies on `dirban block`.
- [ ] Evaluate conflict resolution strategy for tasks modified in backlog while their feature branch exists.
- [ ] Document clear architectural recommendation on whether `dirban start` moves should commit to base branch or stay on task branch.
- [ ] Define UX / CLI commands for detecting and cleaning up orphaned worktrees.
