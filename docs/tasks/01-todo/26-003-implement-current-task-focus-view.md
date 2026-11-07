---
okf_version: "1.0"
id: 26-003
title: Task lifecycle & Git integration (branch/worktree start & branch-aware focus view)
type: task
status: 01-todo
priority: p1
owner: developer
assigned_to: unassigned
created_date: 2026-11-01
last_updated: 2026-11-07
tags:
  - cli
  - git
  - worktree
  - view
  - ux
  - agents
relationships:
  depends_on: []
  blocks: []
  related_to:
    - docs/tasks/01-todo/26-004-implement-planning-view-and-dependency-unblocker.md
---

# Task lifecycle & Git integration (start with branch/worktree, and branch-aware focus view)

Provides unified Git branch and worktree lifecycle commands for task execution, linking the active Git state directly with task management.

Developers and AI agents can start work via either standard in-place branch checkout (`dirban start <id> --checkout`) or isolated sibling git worktrees (`dirban start <id> --worktree`). The `dirban current` focus command automatically identifies the active task from the current Git branch or worktree directory, eliminating ambiguity and token overhead.

## Acceptance Criteria

### 1. Branch-Aware `dirban current` (alias `dirban focus`)
- [ ] Inspect current Git branch (`git rev-parse --abbrev-ref HEAD`) and directory path:
  - Automatically extracts task ID from branch name pattern (e.g., `task/26-003-foo` $\rightarrow$ `26-003`) or worktree path.
  - If a matching task exists on the board, immediately resolves and displays it as the current task.
- [ ] Fallback behavior when on `main` or a non-task branch:
  - Inspects active `02-doing` column.
  - If exactly 1 task is in `02-doing`, displays it.
  - If 0 tasks in `02-doing`, displays helpful message (`No task in progress. Pick one with 'dirban start <id>'`).
  - If multiple tasks in `02-doing`, lists active IDs and prompts for selection.
- [ ] Displays task title, ID, priority badge, and formatted acceptance criteria checklist.
- [ ] Supports `--raw` flag to stream the raw task Markdown to stdout for AI agent piping.

### 2. `dirban start <id>` (alias `dirban worktree add <id>`)
- [ ] Resolves task by ID, filename, or path and moves the card to `02-doing`.
- [ ] Derives deterministic branch name from task ID and slug (e.g. `task/<id>-<slug>`).
- [ ] Supports two execution strategies:
  - `--checkout`: Performs in-place `git checkout -b <branch>` in the current repository.
  - `--worktree`: Provisions an isolated sibling git worktree in `../.<repo>.worktrees/<id>-<slug>`.
  - Configurable default strategy via `dirban.branchStrategy` (`"checkout"` [default] or `"worktree"`).
- [ ] Detects if a branch or worktree already exists for this task ID and prevents duplicate/conflicting creation.

### 3. Worktree Management Commands
- [ ] Add `dirban worktree list` to display all active task worktrees, their branch, and disk path.
- [ ] Add `dirban worktree remove <id>`: Prunes and removes the git worktree cleanly via `git worktree remove`.

### 4. Configuration & Testing
- [ ] Configuration options in `.dirban.json` / `.vscode/settings.json`:
  - `dirban.branchStrategy`: `"checkout"` | `"worktree"` (default: `"checkout"`).
  - `dirban.worktreesDir`: path template where worktrees are created (default: `../.{repo}.worktrees/`).
  - `dirban.branchPrefix`: branch prefix (default: `task/`).
- [ ] Unit tests in `operations.test.ts` covering branch-aware current task detection, branch/worktree path derivation, and start commands.
- [ ] Document in `docs/cli-reference.md` and `.agents/skills/task-management/SKILL.md`.
