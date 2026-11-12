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

### 1. Task Content Authority & Target Branch Synchronization

To balance active in-worktree execution with a consistent repository board state, Dirban separates content authority from board state:

> **Core Rule**: The **Task Branch holds the ground truth for task content** (checkboxes, test details, notes). The **Target Branch (`main`/`dev`) reflects the ground truth for board state** (which column the task is in).

#### Lifecycle Transitions (`start`, `block`, `resume`, `done`):
- **`dirban start <id>`**:
  1. Moves `docs/tasks/01-todo/<id>.md` to `docs/tasks/02-doing/<id>.md` on the target branch.
  2. Commits on target branch: `chore(task): start <id> <title>`.
  3. Creates the worktree and branch (`task/<id>-<slug>`) *from that commit*. Because the branch starts with the file already in `02-doing/`, both branches share the exact same path, avoiding rename collisions.
- **`dirban block <id> <reasons...>`**:
  1. **Task Branch First**: The task file is updated in the active worktree first. It moves `02-doing/<id>.md` -> `backlog/<id>.md`, sets `status: blocked`, and appends blocker reasons to frontmatter while preserving all in-flight checked criteria (`- [x]`) and test notes intact.
  2. **Sync to Target Branch**: Dirban copies/syncs that exact updated task file from the worktree to `docs/tasks/backlog/<id>.md` on the target branch.
  3. **Commit on Target Branch**: `chore(task): block <id> (<reasons>)`.
  4. The worktree is kept alive and dirty working code is left untouched.
- **`dirban resume <id>`**:
  1. **Task Branch First**: Inside the worktree, the task file is moved back: `backlog/<id>.md` -> `02-doing/<id>.md` with cleared blocker status.
  2. **Sync to Target Branch**: Dirban synchronizes the file to `docs/tasks/02-doing/<id>.md` on the target branch and commits: `chore(task): resume <id> <title>`.
  3. Returns the worktree directory path so the agent or developer resumes coding with full context.
- **`dirban done <id>`**:
  1. Merges task branch into the target branch.
  2. Moves `docs/tasks/02-doing/<id>.md` to `docs/tasks/03-done/<id>.md` on the target branch.
  3. Commits and safely cleans up the worktree.

### 2. Live In-Flight Progress via Worktree Overlay

During active development (between `start` and `done` / `block`), the developer or agent ticks off checkboxes `- [x]` directly in the worktree:
- No commits are made to the target branch while actively typing or running tests.
- When `dirban status`, the TUI, or the VS Code extension runs on the target branch, Dirban inspects active worktrees (`git worktree list`) and overlays the live task file content.
- Result: The board always shows live quantitative progress (e.g. `3/5 criteria checked`) without polluting the target branch commit log.

### 3. Worktree Retention on `dirban block`

When a task is blocked:
- The worktree and its task branch (`task/<id>-<slug>`) are **deliberately kept alive** and intact.
- Dirban will **not** prune the directory or force stash/commit dirty changes.
- **Rationale**: In-flight work may be waiting on an external dependency (API token, human review, upstream PR). Retaining the worktree preserves the developer/agent workspace context 100%.

### 4. Distinct `dirban resume` Command Across Workspace Strategies

To re-enter a blocked task or a task with an existing worktree/branch, the user/agent invokes:
```bash
dirban resume <id>
```

- **Unified Behavior Across Strategies**:
  - Across both `worktree` and `checkout` strategies, `resume` follows the **exact same task file synchronization pattern**:
    1. **Task Branch**: Moves the task file from `backlog/<id>.md` to `02-doing/<id>.md`, clears blocker status, and commits on the task branch: `chore(task): resume <id> <title>`.
    2. **Target Branch Sync**: Synchronizes that exact file move to `02-doing/<id>.md` on the target branch and commits: `chore(task): resume <id> <title>`.
  - **Workspace Action**:
    - **`worktree`**: Returns the existing worktree path for the user/agent to continue working in.
    - **`checkout`**: Checks out the existing task branch (`git checkout task/<id>-<slug>`).
    - **`none`**: Moves the file from `backlog/<id>.md` to `02-doing/<id>.md` and clears blocker frontmatter (no git commits).
- **Target Branch Upstream Merge Policy**:
  - `resume` does **not** auto-merge the target branch into the feature branch by default. Auto-merging risks dirty-tree conflicts, broken in-flight tests, and noisy merge commits.
  - If the target branch is ahead, Dirban emits an advisory note (e.g. `Target branch main is 2 commits ahead; run git merge main when ready`).
  - An optional flag (`--sync`) allows users to explicitly request an upstream merge upon resume.
- **Guard in `dirban start`**: Strict entry point for new, unstarted tasks in `01-todo/`. If executed on an existing/blocked task, it detects the existing worktree/branch and prompts or delegates to `resume`.

### 5. Worktree Audit and Orphan Management

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
