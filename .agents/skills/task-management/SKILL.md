---
name: task-management
description: >-
  Manage tasks, discover work, and track implementation progress using Dirban (directory-as-state Kanban).
  Trigger whenever creating a new task, inspecting current tasks, claiming a task to work on,
  checking off acceptance criteria, or moving completed tasks.
---

# Task Management with Dirban

This repository uses **Dirban (`dirban`)**, a zero-database, filesystem-driven Kanban engine.
In Dirban, **the physical directory IS the task state**.

---

## 1. Core Invariants & Lifecycle State Machine

1. **Directories are States & Tiers**:
   - `docs/tasks/00-backlog/` — Reserved intake and capture pool (GTD capture / idea staging). The default destination for new, unscheduled, or blocked tasks waiting for planning.
   - Active Kanban Workflow Columns:
     - `docs/tasks/01-todo/` — Prioritized and refined tasks ready for execution.
     - `docs/tasks/02-doing/` — The task you are currently implementing.
     - `docs/tasks/03-done/` — Completed work with passing tests & criteria met.
   - `docs/tasks/04-archive/` — Reserved terminal tier for historical partitioned storage (`04-archive/YYYY/`).
2. **Lifecycle State Machine**:
   ```text
   [New Task] ──(dirban new)──> 00-backlog/ ──(dirban ready)──> 01-todo/ ──(dirban start)──> 02-doing/ ──(dirban done)──> 03-done/ ──(dirban archive)──> 04-archive/YYYY/
                                     ▲                                                        │   ▲
                                     └───────────────────(dirban block)───────────────────────┘   │
                                     │                                                            │
                                     └────────────(dirban unblock)──► (dirban resume) ────────────┘
   ```
3. **Use Lifecycle Commands, Not Raw Moves**: Never modify `status:` directly in frontmatter or use raw `mv` / `dirban move` for standard lifecycle transitions. Always use the dedicated lifecycle commands (`ready`, `start`, `block`, `unblock`, `resume`, `done`, `archive`). They enforce sequence guards, verify clean working trees, commit task state changes on the target branch, and manage Git branches/worktrees automatically (`dirban move` is reserved for manual/administrative overrides only).
4. **One Task per File**: Every task is an isolated Markdown file. Always inspect only the task you are actively working on to keep token context minimal.
5. **Acceptance Criteria are Checkboxes**: Track progress with standard Markdown `- [ ]` and `- [x]` items.
6. **Strict Transition Guards**:
   - `dirban ready <id>`: Only promotes unblocked tasks from `00-backlog/` into `01-todo/` (unless `--force`).
   - `dirban start <id>`: Requires the task to be in `01-todo/` (rejects `00-backlog/` tasks with a hint to run `dirban ready <id>` first) and requires a clean Git working tree. Commits `chore(task): start <id>` on the target branch before provisioning the task branch or worktree.
   - `dirban done [id]`: Requires the task to be in `02-doing/`. Commits completion, squash-merges the task branch into `main` (unless `--no-merge`), and cleans up the task worktree.
   - `dirban resume <id>`: Resumes a blocked task directly from `00-backlog/` back into `02-doing/`, restoring its task branch or worktree.

---

## 2. Priority System

Dirban orders task priorities from highest to lowest urgency:
- **`p0` (Critical Blocker / Emergency)**: Highest urgency. Reserved for critical blockers or emergencies where other tasks must stop immediately to resolve this first. Not used for normal roadmap tasks.
- **`p1` (High / Prerequisite First)**: Important foundational tasks or prerequisites that need to be completed before downstream tasks can proceed.
- **`p2` (Normal / Default)**: The standard workspace default priority for regular feature tasks and roadmap work.
- **`p3` (Low / Backlog / Later)**: Nice-to-have improvements, future phase items, or low-urgency follow-ups.

Check available priorities and workspace default anytime via CLI:
```bash
dirban priorities
```

---

## 3. Standard Agent Workflows

### A. Initializing a Workspace
If the tasks directory does not exist yet:

```bash
dirban init
```

---

### B. Finding & Picking Up Work
Before starting work, check the board or inspect ready tasks:

```bash
# 1. View current active board (static table)
dirban board --static

# 2. Recommends the next unblocked, highest-priority task ready to work on
dirban next

# 3. View a specific task's details & criteria
dirban view 26-001

# 4. If the task is still in 00-backlog/, promote it to 01-todo/ first
dirban ready 26-001

# 5. Start task execution (requires task in 01-todo/ and clean working tree;
#    commits `chore(task): start <id>` before provisioning branch/worktree)
dirban start 26-001

# 6. Check active focus / current task anytime
dirban current

# Stream active task Markdown to stdout for agent prompting
dirban current --raw
```

#### Workspace Strategy Flags (`dirban start <id>`)
- `--checkout` *(default)*: Creates/checks out `task/<id>-<slug>` branch in-place.
- `--worktree`: Creates an isolated Git worktree in `../.<repo>.worktrees/<id>-<slug>`.
- `--current` / `--no-branch`: Stays on the current branch without creating a task branch.
- `--no-git`: Pure filesystem move without Git operations.

*(Note: `dirban start` requires the task to already be in `01-todo/` and requires a clean Git working tree. Tasks in `00-backlog/` must be promoted first via `dirban ready <id>`, or resumed via `dirban resume <id>` if previously blocked.)*

---

### C. Creating a New Task
When designing a feature, breaking down work, or filing a bug:

```bash
# Creates a new task in 00-backlog with auto-calculated ID and default priority
dirban new "Implement JWT token refresh"
```

New tasks automatically default to the **`00-backlog`** column and use the configured workspace default priority.

#### Optional Parameters
Override or customize task properties when needed:
- `--column=<col>`: Target column (defaults to `00-backlog`).
- `--priority=<p>`: Priority level (defaults to workspace default; check options with `dirban priorities`).
- `--tags=<t1,t2>`: Comma-separated list of tags.
- `--assignee=<user>`: Assignee name.

Example with optional parameters:
```bash
dirban new "Fix critical token expiry bug" --column=01-todo --priority=p0 --tags=auth,security
```

This creates a new `.md` file with frontmatter and an `Acceptance Criteria` section. 
You can then open the file to add detailed criteria:
```markdown
## Acceptance Criteria
- [ ] Add refresh token endpoint
- [ ] Implement Redis TTL expiration
- [ ] Unit tests for expired tokens
```

---

### D. Updating Progress & Criteria
As you complete individual criteria during coding:

```bash
# Toggle the 1st checkbox item
dirban check 26-001 1

# Or edit the markdown file directly to mark:
# - [x] Add refresh token endpoint
```

---

### E. Completing & Archiving a Task
When all acceptance criteria are checked and verification passes:

```bash
# 1. Complete active task (auto-detects from current branch/worktree or 02-doing/;
#    requires task in 02-doing/, commits completion, squash-merges into target branch, and removes worktree)
dirban done

# Complete a specific task ID
dirban done 26-001

# 2. (Optional) Archive completed tasks from 03-done/ into 04-archive/YYYY/
dirban archive 26-001
dirban archive all
```

#### Completion Options (`dirban done [id]`)
- `--merge` *(default)*: Commits completion, squash-merges the task branch into the target branch, and cleans up any task worktree.
- `--no-merge`: Completes the task in `03-done/` on the task branch without merging into `main`.
- `--no-git`: Pure directory move without Git operations.

---

### F. Handling Blockers, Planning, Unblocking & Resuming

When an active task encounters blockers (e.g. waiting on dependency, upstream PR, or external input):
1. **Demote & Record Blockers**:
   ```bash
   dirban block <id> "<blocker reason or prerequisite task ID>"
   ```
   * Automatically normalizes task arguments to canonical task IDs (e.g. `26-001`), adds entries to `relationships.depends_on`, and moves the task from `02-doing/` back to `00-backlog/` to free the active slot.
   * In Git/worktree mode, syncs the block commit back to the target branch and **retains any existing worktree** so work-in-progress is preserved until you resume.
   * **Invariant**: Never use file paths in `relationships.depends_on` or `relationships.blocks` (e.g. `docs/tasks/00-backlog/26-001.md`). Always use bare canonical IDs (`26-001`) because physical file paths change continuously as tasks move between columns.
2. **Record Rationale in `## Execution Journal`**:
   Add an entry with timestamp and context to the task Markdown file:
   ```markdown
   ## Execution Journal
   - 2026-11-07T21:00:00Z: [BLOCKED] Blocked by 26-001 (database migration needed).
   ```

When reviewing, scheduling, and resuming work:
1. **Inspect Backlog Plan**:
   ```bash
   # Formatted overview of Ready vs Blocked tasks
   dirban plan

   # Scriptable flags for agents
   dirban plan --unblocked
   dirban plan --blocked
   ```
2. **Promote / Ready Unstarted Tasks into Active Queue**:
   * Promote unblocked task(s) from `00-backlog/` into `01-todo/`:
     ```bash
     dirban ready 26-001
     dirban ready 001 002
     dirban ready all             # Promotes all unblocked backlog tasks
     dirban ready 001 --to=01-todo
     ```
   * Prerequisite tasks in `relationships.depends_on` resolve automatically once they reach `03-done/` or `04-archive/`.
   * Clear external blocker strings via:
     ```bash
     dirban unblock <id> "<blocker string>"
     ```
   * Record unblocking in the task's `## Execution Journal`:
     ```markdown
     ## Execution Journal
     - 2026-11-08T09:00:00Z: [UNBLOCKED] 26-001 merged; resumed work.
     ```
3. **Resume a Previously Blocked Task (`dirban resume`)**:
   * Unlike `dirban ready` (which promotes new/unstarted `00-backlog/` tasks into `01-todo/`), **`dirban resume`** (alias: `continue`) returns a previously blocked task directly from `00-backlog/` into `02-doing/` and reactivates its task branch or worktree:
     ```bash
     # Once prerequisites are done or external blockers are cleared via `dirban unblock`:
     dirban resume 26-001

     # Optional flags:
     dirban resume 26-001 --sync   # Rebases/merges latest main branch into the task branch/worktree
     dirban resume 26-001 --force  # Resumes even if unresolved blockers remain
     ```

---

### G. Git Worktree Management & Navigation
When working with isolated Git worktrees across parallel or blocked tasks:

```bash
# Audit active, blocked, completed, and orphaned task worktrees
dirban worktree
dirban worktree list

# Provision a worktree for a task
dirban worktree add 26-001

# Resolve the absolute directory path of a task worktree or main repo
dirban path 26-001
dirban path main
cd "$(dirban path 26-001)"

# Prune completed (03-done / 04-archive) or orphaned task worktrees
dirban prune
dirban prune --force
```

---

## 4. CLI Command Cheat Sheet

| Intent | Command |
| :--- | :--- |
| **Initialize Board** | `dirban init` |
| **Inspect Board** | `dirban board --static` |
| **Next Ready Task** | `dirban next` |
| **Backlog Planning** | `dirban plan [--unblocked\|--blocked\|-i]` |
| **Ready / Promote Task** | `dirban ready <id...> [--to=<col>]` or `dirban ready all` |
| **Block Task** | `dirban block <id> <reasons...>` |
| **Unblock Task** | `dirban unblock <id> [reason]` |
| **Resume Blocked Task** | `dirban resume <id> [--sync] [--force]` (or `continue`) |
| **Current / Focus Task** | `dirban current [--raw]` or `dirban focus` |
| **Start Work on Task** | `dirban start <id> [--checkout\|--worktree\|--current\|--no-git]` |
| **Finish Task** | `dirban done [id] [--merge\|--no-merge\|--no-git]` or `dirban finish` |
| **Manage Worktrees** | `dirban worktree [list\|add <id>\|prune]` |
| **Prune Worktrees** | `dirban prune [--force]` |
| **Resolve Worktree Path** | `dirban path [id\|main]` |
| **Check Priorities** | `dirban priorities` |
| **Get Next ID** | `dirban next-id` |
| **Create Task** | `dirban new "<title>" [options]` |
| **View Task** | `dirban view <id>` |
| **Move Column (Admin Override)** | `dirban move <id> <target-column>` *(manual/administrative override only)* |
| **Toggle Checkbox** | `dirban check <id> <index>` |
| **Update Metadata** | `dirban set <id> [--priority=...] [--assignee=...] [--tags=...]` |
| **Archive Tasks** | `dirban archive <id>` or `dirban archive all` |
