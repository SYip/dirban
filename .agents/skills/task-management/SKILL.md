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

1. **Directories are Columns**:
   - `docs/tasks/backlog/` — Default destination for new tasks. Ideas, staging queue, or unscheduled backlog.
   - `docs/tasks/01-todo/` — Prioritized and refined tasks ready for execution.
   - `docs/tasks/02-doing/` — The task you are currently implementing.
   - `docs/tasks/03-done/` — Completed work with passing tests & criteria met.
   - `docs/tasks/archive/` — Historical partitioned storage (`archive/YYYY/`).
2. **One Task per File**: Every task is an isolated Markdown file. Always inspect only the task you are actively working on to keep token context minimal.
3. **Never modify `status:` directly in frontmatter**: The directory location dictates task status. Use `dirban move` or `mv` to transition cards.
4. **Acceptance Criteria are Checkboxes**: Track progress with standard Markdown `- [ ]` and `- [x]` items.

---

## 2. Priority System

Dirban supports configurable task priorities (by default `p0`, `p1`, `p2`, `p3`, ordered from highest to lowest urgency). When creating a task, it automatically inherits the configured workspace default priority unless an override is specified.

Always use the CLI to inspect available priority levels and check the default priority:

```bash
dirban priorities
```

Example output:
```text
Available priorities: p0, p1, p2 (default), p3
Default priority:    p2
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

# 3. Claim the task and move to doing
dirban move 26-001 02-doing
dirban set 26-001 --owner=agent
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
# 1. Move task to done
dirban move 26-001 03-done

# 2. (Optional) Archive completed tasks into archive/YYYY/
dirban archive 26-001
```

---

## 4. CLI Command Cheat Sheet

| Intent | Command |
| :--- | :--- |
| **Initialize Board** | `dirban init` |
| **Inspect Board** | `dirban board --static` |
| **Check Priorities** | `dirban priorities` |
| **Get Next ID** | `dirban next-id` |
| **Create Task** | `dirban new "<title>" [options]` |
| **View Task** | `dirban view <id>` |
| **Move Column** | `dirban move <id> <target-column>` |
| **Toggle Checkbox** | `dirban check <id> <index>` |
| **Update Metadata** | `dirban set <id> [--priority=...] [--assignee=...] [--tags=...]` |
| **Archive Tasks** | `dirban archive <id>` or `dirban archive all` |
