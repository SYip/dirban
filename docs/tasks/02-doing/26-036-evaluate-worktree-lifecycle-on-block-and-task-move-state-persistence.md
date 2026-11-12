---
id: 26-036
title: Evaluate Worktree Lifecycle on Block and Task Move State Persistence Across Base and Task Branches
status: doing
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

### 2. Task Content Authority & Target Branch Synchronization
- **Ground Truth Separation**: The **Task Branch** holds ground truth for task content (checkboxes `- [x]`, test details, notes). The **Target Branch** (`main`/`dev`) holds ground truth for board state (`todo`, `doing`, `backlog`, `done`).
- **Sync on Lifecycle Events**:
  - `dirban start`: Moves `01-todo/` to `02-doing/` on target branch and creates the task branch/worktree from that commit.
  - `dirban block`: Updates the task file in the active worktree first (preserving all checked boxes and notes), then syncs and commits that exact content to `docs/tasks/backlog/<id>.md` on the target branch.
  - `dirban resume`: Moves the task file back to `02-doing/<id>.md` in the worktree first with cleared blocker status, then syncs and commits to the target branch, returning the worktree path.
  - `dirban done`: Merges the task branch into the target branch, moves to `03-done/`, and cleans up the worktree.
- **In-Flight Progress Overlay**: Tools running on the target branch (`dirban status`, TUI, VS Code) read active worktrees to show live checkbox progress without committing to the target branch while coding.

### 3. Worktree Retention on `dirban block`
- **Action**: Keep the worktree alive and untouched on `dirban block`. Do not prune or force WIP commits.
- **Rationale**: In-flight agent sessions or developer spikes may have uncommitted changes or active processes waiting on external dependencies or reviews. Preserving the worktree prevents data/context loss.

### 4. Distinct `dirban resume` Command Across Workspace Strategies
- **Action**: Separate new task initialization (`dirban start`) from re-entering suspended/blocked tasks (`dirban resume`).
- **Unified Strategy Behavior**:
  - Across both `worktree` and `checkout` strategies, `resume` executes the exact same task file commit sequence:
    1. Moves `backlog/<id>.md` to `02-doing/<id>.md` with cleared blockers and commits on the task branch: `chore(task): resume <id>`.
    2. Syncs and commits that file move to `02-doing/` on the target branch: `chore(task): resume <id>`.
  - Workspace navigation:
    - **`worktree`**: Returns the existing worktree path.
    - **`checkout`**: Checks out the existing task branch (`git checkout task/<id>-<slug>`).
    - **`none`**: Moves the task file from `backlog/<id>.md` to `02-doing/<id>.md` and clears blocker frontmatter.
- **Merge Policy on Resume**:
  - `resume` does **not** auto-merge the target branch into the feature branch by default. Auto-merging risks dirty-tree conflicts, broken in-flight tests, and noisy merge commits.
  - If the target branch is ahead, Dirban emits an advisory note (e.g. `Target branch main is 2 commits ahead; run git merge main when ready`).
  - An optional flag (`--sync` or `--merge-base`) can be provided if the user explicitly requests an upstream sync.

### 5. Worktree Audit & Cleanup
- Provide `dirban worktree list` (or `dirban status --worktrees`) to detect stale worktrees against board states.
- Provide `dirban prune` to clean up worktrees for completed or abandoned tasks safely.

---

## Acceptance Criteria

- [x] **1. Architecture & Decision Documentation**
  - [x] Document design decision comparing worktree retention strategies on `dirban block`.
  - [x] Evaluate conflict resolution strategy for tasks modified while feature branch exists.
  - [x] Document architectural decision on target branch lifecycle commits and in-task workflows.
  - [x] Record formal decision records: `2026-11-12-worktree-lifecycle-and-state-persistence.md` and `2026-11-12-minimal-columns-vs-in-task-workflow.md`.

- [ ] **2. Target Branch Lifecycle Commits on `dirban start`**
  - [ ] Update `startTask` with `branchStrategy: "worktree"` to move task from `01-todo/` to `02-doing/` and commit on target branch (`main`/configured `targetBranch`) *before* spawning the worktree.
  - [ ] Spawn task branch/worktree directly from that commit so file paths are identical on both branches.

- [ ] **3. Task Branch Authority & Sync on `dirban block`**
  - [ ] Update `blockTask` to update the task file in the active worktree first (preserving in-flight `- [x]` checkboxes, test details, and adding blocker reasons).
  - [ ] Synchronize and commit the updated task file to `docs/tasks/backlog/<id>.md` on the target branch.
  - [ ] Retain active worktree directory intact without pruning or forcing stashes.

- [ ] **4. Implementation of `dirban resume` Command Across Strategies**
  - [ ] Implement `resumeTask` core operation in `src/tasks/lifecycle/resume.ts` supporting `worktree`, `checkout`, and `none` workspace strategies.
  - [ ] Add `dirban resume <id>` CLI command to router and CLI options.
  - [ ] Validate blocker criteria are cleared (or unblock them), move task from `backlog/` to `02-doing/` in the worktree/task branch first, then sync and commit to target branch.
  - [ ] Return the active worktree directory path (for `worktree`) or switch branch (for `checkout`).
  - [ ] Enforce no-auto-merge default: do not auto-merge target branch into task branch on resume; emit advisory if target branch is ahead. Optional `--sync` flag for explicit upstream merge.
  - [ ] Add guard in `dirban start <id>` to detect existing worktrees/branches and guide users to `dirban resume`.

- [ ] **5. In-Flight Worktree Progress Overlay**
  - [ ] Update board discovery / status readers (`dirban status`, board state managers) to inspect active worktrees and overlay live checkbox progress without requiring intermediate target branch commits.

- [ ] **6. Worktree Audit & Cleanup (`dirban worktree list` & `dirban prune`)**
  - [ ] Implement `dirban worktree list` (or `dirban status --worktrees`) auditing worktrees against board states.
  - [ ] Implement `dirban prune` to clean up worktrees for completed or abandoned tasks safely.

- [ ] **7. Verification & Tests**
  - [ ] Add test vectors covering `startTask` target branch commit + worktree creation sequence.
  - [ ] Add test vectors covering `blockTask` worktree retention and target branch synchronization.
  - [ ] Add test vectors covering `resumeTask` unblocking and workspace reactivation.
  - [ ] All tests pass (`bun test`) and strict typing passes (`bun run typecheck`).
