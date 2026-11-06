---
id: "26-005"
title: "Add git worktree lifecycle integration for task branches"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-02"
last_updated: "2026-11-02"
tags: ["cli", "git", "worktree", "agents"]
---

# Add git worktree lifecycle integration for task branches

Provides automated `git worktree` isolation keyed by task ID and slug (e.g. `dirban start <id>` or `dirban worktree add <id>`). Because each task branch focuses strictly on its own isolated task and code changes, branch collisions are eliminated and multiple agents can execute tasks in parallel without interfering with each other's working directory or build artifacts.

## Acceptance Criteria
- [ ] Add `dirban start <id-or-path>` (alias `dirban worktree add <id-or-path>`):
  - Resolves task by ID, filename, or path.
  - Derives deterministic branch name from task ID and slug (e.g. `task/<id>-<slug>`).
  - Automatically provisions git worktree inside a dedicated hidden sibling directory:
    - Default path: `../.<repo>.worktrees/<id>-<slug>` (where `<repo>` is auto-derived from the repo folder name, e.g. `~/Projects/.dirban.worktrees/26-005-add-git-worktree-lifecycle/`).
    - Keeps the main repo completely clean, avoids nested git index thrashing in IDEs, and hides worktrees from casual `ls` in the parent directory.
    - Automatically creates the parent worktrees directory (`mkdir -p`) if it does not exist.
  - Moves the task card to `02-doing` on the worktree branch.
  - Detects if a worktree or branch already exists for this task ID and prevents duplicate/conflicting checkouts.
- [ ] Add `dirban worktree list` command to display all active task worktrees, their branch, and disk path.
- [ ] Add `dirban worktree remove <id-or-path>`:
  - Prunes and removes the git worktree directory cleanly via `git worktree remove`.
  - Confirms task is in `03-done` or prompts before removing dirty working trees.
- [ ] Add configuration support in `.dirban.json` / `.vscode/settings.json`:
  - `dirban.worktreesDir`: directory path where worktrees are created (defaults to `../.{repo}.worktrees/`). Supports `{repo}` placeholder.
  - `dirban.branchPrefix`: branch prefix format (defaults to `task/`).
- [ ] Add unit test vectors for worktree path derivation (including `{repo}` expansion), branch name normalization, and lifecycle commands.
- [ ] Document in `docs/cli-reference.md` and `.agents/skills/task-management/SKILL.md`.
