---
okf_version: "1.0"
id: "okf.dirban.adr.worktree-lifecycle-and-state-persistence"
title: "Worktree Lifecycle on Block and Task Move State Persistence Across Base and Task Branches"
type: "decision"
status: "accepted"
owner: "team"
last_updated: "2026-11-12"
tags:
  - git
  - worktree
  - lifecycle
  - architecture
  - concurrency
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "okf.dirban.concepts.git-workflow"
---

# Worktree Lifecycle on Block and Task Move State Persistence

## Context

When using `branchStrategy: "worktree"`, two architectural tensions emerge regarding Git branch isolation versus shared board state:

1. **Board State vs. Feature Branch State**: When a task moves between columns (`01-todo` -> `02-doing` -> `backlog` -> `03-done`), which Git branch owns and commits that file move?
   - If moves are only committed on the task branch, the target branch (`main` or `dev`) still sees the task in `01-todo/` on disk, violating the "Directory-as-State" promise for anyone inspecting the repository checkout.
2. **Worktree Lifecycle on Task Block**: When a task in progress is blocked (`dirban block <id> <reasons...>`):
   - Deleting the worktree risks losing dirty working trees, spike code, uncommitted agent edits, or partial criteria work.
   - Retaining the worktree without synchronization risks merge conflicts if the target branch updates the task status while the worktree is idle.

---

## Decision

### 1. Target Branch Commits for Task Lifecycle Transitions

All board lifecycle movements are committed directly to the **target branch** (`main` or configured `targetBranch` / `dev`):
- **`dirban start <id>`**:
  1. Moves `docs/tasks/01-todo/<id>.md` to `docs/tasks/02-doing/<id>.md` on the target branch.
  2. Commits on the target branch: `chore(task): start <id> <title>`.
  3. Creates the worktree and branch (`task/<id>-<slug>`) *from that commit*. Because the file is already in `02-doing/`, both branches share the exact same path, avoiding rename collisions on subsequent merges.
- **`dirban block <id>`**:
  1. Moves `docs/tasks/02-doing/<id>.md` to `docs/tasks/backlog/<id>.md` (with blocker metadata in frontmatter) on the target branch.
  2. Commits on the target branch: `chore(task): block <id> <reasons>`.
- **`dirban done <id>`**:
  1. Merges task branch into the target branch.
  2. Moves `docs/tasks/02-doing/<id>.md` to `docs/tasks/03-done/<id>.md` on the target branch.
  3. Commits and safely cleans up the worktree.

**Rationale**:
- Maintains **100% "Directory-as-State" fidelity**: The directory structure in the target branch is always an accurate, real-time reflection of work in flight without needing auxiliary tools or git plumbing.
- Creates an authentic, chronological audit trail of when tasks were picked up, blocked, or finished on the target branch.

### 2. Worktree Retention on `dirban block`

When a task is blocked:
- The worktree and its task branch (`task/<id>-<slug>`) are **deliberately kept alive** and intact.
- Dirban will **not** prune the directory or force stash/commit dirty changes.
- **Rationale**: The state of work could be in-flight (waiting on developer input, API key, external PR, or human review). Pruning the worktree risks discarding context or creating detached stashes.

### 3. Distinct `dirban resume` Lifecycle Command

To re-enter a blocked task or a task with an existing worktree, the user/agent invokes:
```bash
dirban resume <id>
```

- **`dirban start <id>`**: Strict entry point for new, unstarted tasks in `01-todo/`. If executed on an existing/blocked task, it detects the existing worktree and prompts or delegates to `resume`.
- **`dirban resume <id>`**:
  1. Validates that blocker conditions are resolved (or unblocks them).
  2. Moves the task file from `docs/tasks/backlog/<id>.md` back to `docs/tasks/02-doing/<id>.md` on the target branch and commits: `chore(task): resume <id> <title>`.
  3. Fast-forwards / synchronizes the target branch changes into the existing task worktree.
  4. Returns the existing worktree path for the agent or developer to resume work immediately.

### 4. Worktree Audit and Orphan Management

To prevent stale worktrees from accumulating permanently:
- Introduce `dirban worktree list` (or `dirban status --worktrees`): Audits active Git worktrees against task statuses on the board (e.g. flagging worktrees whose tasks are `backlog`, `done`, or non-existent).
- Introduce `dirban prune`: Safely deletes worktrees for tasks that have already been marked `done` or archived, warning if any worktree contains uncommitted changes.

---

## Consequences

### Positive
- "Directory as State" remains completely consistent on the target branch at all times.
- Agents and developers will not accidentally overwrite or lose partial progress when tasks are blocked.
- Renames and merges remain clean because task branch creation occurs *after* the initial `todo -> doing` move on the base branch.
- Clear mental model separating starting fresh work (`start`) from returning to paused work (`resume`).

### Considerations
- Committing to the target branch requires the target branch working copy to not have untracked/staged conflicts during `start` / `block`. Dirban stages and commits only the task markdown file (`git add docs/tasks/...`).
- Developers can configure a dedicated development branch (e.g., `dev`) as `targetBranch` in `.dirban.json` if they prefer not to commit lifecycle events directly to `main`.
