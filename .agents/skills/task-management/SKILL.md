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

## 1. Core Invariants & Rules for Agents

1. **Directories are States & Tiers**:
   - `docs/tasks/backlog/` — Reserved intake and capture pool (GTD capture / idea staging). The default destination for new, unscheduled, or blocked tasks waiting for planning.
   - Active Kanban Workflow Columns (`docs/tasks/<column>/`, configured via `dirban.columns`):
     - `docs/tasks/01-todo/` — Prioritized and refined tasks ready for execution (`config.columns[0]`).
     - `docs/tasks/02-doing/` — The task you are currently implementing.
     - `docs/tasks/03-done/` — Completed work with passing tests & criteria met.
   - `docs/tasks/archive/` — Reserved terminal tier for historical partitioned storage (`archive/YYYY/`).
2. **One Task per File**: Every task is an isolated Markdown file. Always inspect only the task you are actively working on to keep token context minimal.
3. **Never modify `status:` directly in frontmatter**: The directory location dictates task status. Use `dirban move` or `mv` to transition cards.
4. **Acceptance Criteria are Checkboxes**: Track progress with standard Markdown `- [ ]` and `- [x]` items.

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

# 2. View a specific task's details & criteria
dirban view 26-001

# 3. Start task execution (moves to 02-doing and provisions branch/worktree)
dirban start 26-001

# 4. Check active focus / current task anytime
dirban current

# Stream active task Markdown to stdout for agent prompting
dirban current --raw
```

*(Note: You can also move files using standard Unix `mv docs/tasks/01-todo/26-001-*.md docs/tasks/02-doing/`)*.

---

### C. Creating a New Task
When designing a feature, breaking down work, or filing a bug:

```bash
# Creates a new task in backlog with auto-calculated ID and default priority
dirban new "Implement JWT token refresh"
```

New tasks automatically default to the **`backlog`** column and use the configured workspace default priority.

#### Optional Parameters
Override or customize task properties when needed:
- `--column=<col>`: Target column (defaults to `backlog`).
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
# 1. Complete task (moves to 03-done and auto-merges branch/worktree if in git)
dirban done

# 2. (Optional) Archive completed tasks into archive/YYYY/
dirban archive 26-001
```

---

### F. Handling Blockers, Planning & Unblocking

When an active task encounters blockers (e.g. waiting on dependency, upstream PR, or external input):
1. **Demote & Record Blockers**:
   ```bash
   dirban block <id> "<blocker reason or prerequisite task ID>"
   ```
   * Automatically adds entries to `relationships.depends_on` and demotes the task back to `backlog/` to free the active slot.
2. **Record Rationale in `## Execution Journal`**:
   Add an entry with timestamp and context to the task Markdown file:
   ```markdown
   ## Execution Journal
   - 2026-11-07T21:00:00Z: [BLOCKED] Blocked by 26-001 (database migration needed).
   ```

When reviewing and scheduling work:
1. **Inspect Backlog Plan**:
   ```bash
   # Formatted overview of Ready vs Blocked tasks
   dirban plan

   # Scriptable flags for agents
   dirban plan --ready
   dirban plan --blocked
   ```
2. **Unblocking & Promoting**:
   * Prerequisite tasks in `relationships.depends_on` resolve automatically once they reach `done` or `archive/`.
   * Clear external blocker strings via:
     ```bash
     dirban unblock <id> "<blocker string>"
     ```
   * Promote the unblocked task into the active workflow (`config.columns[0]`):
     ```bash
     dirban plan --promote=<id>
     ```
   * Record unblocking in the task's `## Execution Journal`:
     ```markdown
     ## Execution Journal
     - 2026-11-08T09:00:00Z: [UNBLOCKED] 26-001 merged; resumed work.
     ```

---

## 4. CLI Command Cheat Sheet

| Intent | Command |
| :--- | :--- |
| **Initialize Board** | `dirban init` |
| **Inspect Board** | `dirban board --static` |
| **Backlog Planning** | `dirban plan [--ready\|--blocked\|--promote=<id>\|-i]` |
| **Block Task** | `dirban block <id> <reasons...>` |
| **Unblock Task** | `dirban unblock <id> [reason]` |
| **Current / Focus Task** | `dirban current [--raw]` or `dirban focus` |
| **Start Work on Task** | `dirban start <id> [--checkout\|--worktree]` |
| **Finish Task** | `dirban done [id]` or `dirban finish` |
| **Check Priorities** | `dirban priorities` |
| **Get Next ID** | `dirban next-id` |
| **Create Task** | `dirban new "<title>" [options]` |
| **View Task** | `dirban view <id>` |
| **Move Column** | `dirban move <id> <target-column>` |
| **Toggle Checkbox** | `dirban check <id> <index>` |
| **Update Metadata** | `dirban set <id> [--priority=...] [--assignee=...] [--tags=...]` |
| **Archive Tasks** | `dirban archive <id>` or `dirban archive all` |
