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

Dirban orders task priorities from highest to lowest urgency (check workspace options anytime with `dirban priorities`):
- **`p0` (Critical Blocker / Emergency)**: Highest urgency; stop other work to resolve first. Not for normal roadmap tasks.
- **`p1` (High / Prerequisite First)**: Important foundational tasks or prerequisites for downstream work.
- **`p2` (Normal / Default)**: Standard default priority for regular feature and roadmap tasks.
- **`p3` (Low / Backlog / Later)**: Nice-to-have improvements or future follow-ups.

---

## 3. Task Markdown & Workflow Rules

- **Picking Up Work**: Check ready work with `dirban next` or `dirban board --static`. Promote `00-backlog/` tasks via `dirban ready <id>` before running `dirban start <id>`. Inspect the active task with `dirban current [--raw]`.
- **Workspace Strategies (`dirban start`)**: Defaults to `--checkout` (in-place `task/<id>-<slug>` branch); use `--worktree` for isolated worktrees (`../.<repo>.worktrees/<id>-<slug>`), `--current` / `--no-branch` to stay on the current branch, or `--no-git` for directory-only moves.
- **Acceptance Criteria**: Track progress under `## Acceptance Criteria` with `- [ ]` and `- [x]` checkboxes (`dirban check <id> <index>` or direct edit).
- **Blocking, Unblocking & Resuming**:
  - `dirban block <id> "<reason or task-id>"` moves an active task from `02-doing/` to `00-backlog/`, adds entries to `relationships.depends_on`, syncs to the target branch, and retains any existing worktree.
  - **Dependency ID Invariant**: Always use bare canonical IDs (`26-001`) in `relationships.depends_on` / `relationships.blocks`, never file paths.
  - Prerequisite task IDs resolve automatically once they reach `03-done/` or `04-archive/`; clear external string blockers via `dirban unblock <id> "<reason>"`.
  - Use **`dirban resume <id> [--sync] [--force]`** (not `dirban ready`) to return a previously blocked task from `00-backlog/` directly to `02-doing/` and restore its branch or worktree.
  - **Execution Journal**: Log block/unblock events in the task Markdown under `## Execution Journal`:
    `- YYYY-MM-DDTHH:mm:ssZ: [BLOCKED|UNBLOCKED] <context>`

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

Run `dirban <command> --help` for full options and examples.
