---
okf_version: "1.0"
id: 26-003
title: Task execution lifecycle and Git workflow (start, current, done)
type: task
status: 02-doing
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
    - docs/decisions/2026-11-07-progressive-enhancement-optional-dependencies.md
---

# Task execution lifecycle and Git workflow (start, current, done)

Provides unified Git branch and worktree lifecycle commands for task execution, linking the active Git state directly with task management while strictly following the **Progressive Enhancement** architecture (Filesystem First, Git Optional).

Developers and AI agents can start work via either standard in-place branch checkout (`dirban start <id> --checkout`) or isolated sibling git worktrees (`dirban start <id> --worktree`). The `dirban current` focus command automatically identifies the active task from the current Git branch or worktree directory when available, or from `02-doing` on the filesystem when Git is absent or on main.

## Acceptance Criteria

### 1. Branch-Aware `dirban current` (alias `dirban focus`)
- [x] Explicit Selection: `dirban current <id>` immediately displays the specified task.
- [x] Git Branch / Worktree Detection: When in a Git repository, inspects `git rev-parse --abbrev-ref HEAD` or worktree directory:
  - Extracts task ID from branch pattern (e.g., `task/26-003-foo` $\rightarrow$ `26-003`) or worktree path.
  - If a matching task exists on the board, immediately resolves it as current.
  - If Git is not installed or workspace is not a Git repo, cleanly skips without error.
- [x] Doing Column (`02-doing`) Resolution:
  - If 0 tasks in `02-doing`, cleanly reports: `No task currently in progress.`
  - If 1 task in `02-doing`, displays it.
  - If multiple tasks in `02-doing`, picks the highest-priority task (with deterministic recency/ID tie-breaker) and displays a brief notice.
- [x] Displays task title, ID, priority badge, and formatted acceptance criteria checklist.
- [x] Supports `--raw` flag to stream the raw task Markdown to stdout for AI agent piping (omitting notices).

### 2. `dirban start <id>` (alias `dirban worktree add <id>`)
- [x] Moves the task card to `02-doing` on the filesystem first (guaranteeing state transition even if Git is absent).
- [x] Derives deterministic branch name from task ID and slug (e.g. `task/<id>-<slug>`).
- [x] Supports two execution strategies:
  - `--checkout`: Performs in-place `git checkout -b <branch>` in current repository.
  - `--worktree`: Provisions an isolated sibling git worktree in `../.<repo>.worktrees/<id>-<slug>`.
  - Configurable default strategy via `dirban.branchStrategy` (`"checkout"` [default] or `"worktree"`).
  - Graceful degradation: If not a Git repository, informs the user (`"Git repository not detected; moved card to doing on filesystem only."`) without failing.
- [x] Detects if a branch or worktree already exists for this task ID and prevents duplicate/conflicting creation.

### 3. `dirban done [id]` (alias `dirban finish`)
- [x] Resolves task to complete:
  - If `<id>` argument is provided, resolves that task.
  - If omitted, resolves the current active task (via branch name or single task in `02-doing`).
- [x] Moves the task file to `03-done` on the filesystem.
- [x] Criteria check awareness:
  - Does NOT automatically check off unchecked criteria (criteria completion is strictly the responsibility of the user or AI agent).
  - If any criteria remain unchecked, prints an informative notice (e.g. `Notice: 2 criteria remain unchecked`).
- [x] Git branch & worktree auto-merge:
  - If on a task branch (`task/<id>-<slug>`): merges the branch into the base branch (`main`) and checks out `main`.
  - If inside a task worktree: merges the task branch into `main` and cleans up the worktree via `git worktree remove`.
  - Graceful degradation: If not in a Git repository or on `main`, skips git merge and simply moves the task file to `03-done`.

### 4. Configuration & Testing
- [x] Configuration options in `.dirban.json` / `.vscode/settings.json`:
  - `dirban.branchStrategy`: `"checkout"` | `"worktree"` (default: `"checkout"`).
  - `dirban.worktreesDir`: path template where worktrees are created (default: `../.{repo}.worktrees/`).
  - `dirban.branchPrefix`: branch prefix (default: `task/`).
- [x] Unit tests in `operations.test.ts` covering:
  - Filesystem-only non-git fallbacks for `current`, `start`, and `done`.
  - Branch-aware current task detection.
  - Deterministic branch/worktree path derivation.
  - Task move to `03-done` and git merge/worktree cleanup.
- [x] Document in `docs/cli-reference.md` and `.agents/skills/task-management/SKILL.md`.
