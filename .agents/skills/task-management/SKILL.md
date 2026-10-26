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
   - `docs/tasks/00-backlog/` — New ideas, staging queue, or future backlog.
   - `docs/tasks/01-ready/` — Prioritized and refined tasks ready for execution.
   - `docs/tasks/02-in-progress/` — The task you are currently implementing.
   - `docs/tasks/03-done/` — Completed work with passing tests & criteria met.
   - `docs/tasks/archive/` — Historical partitioned storage (`archive/YYYY/`).
2. **One Task per File**: Every task is an isolated Markdown file. Always inspect only the task you are actively working on to keep token context minimal.
3. **Never modify `status:` directly in frontmatter**: The directory location dictates task status. Use `dirban move` or `mv` to transition cards.
4. **Acceptance Criteria are Checkboxes**: Track progress with standard Markdown `- [ ]` and `- [x]` items.

---

## 2. Standard Agent Workflows

### A. Finding & Picking Up Work
Before starting work, check the board or inspect ready tasks:

```bash
# 1. View current active board (static table)
dirban board --static

# 2. View a specific task's details & criteria
dirban view 26-001

# 3. Claim the task and move to in-progress
dirban move 26-001 02-in-progress
dirban set 26-001 --owner=agent
```

*(Note: You can also move files using standard Unix `mv docs/tasks/01-ready/26-001-*.md docs/tasks/02-in-progress/`)*.

---

### B. Creating a New Task
When designing a feature, breaking down work, or filing a bug:

```bash
# 1. Check the next ID (e.g. 26-003)
dirban next-id

# 2. Create the task with title and metadata
dirban new "Implement JWT token refresh" --column=01-ready --priority=p1 --tags=auth,backend
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

### C. Updating Progress & Criteria
As you complete individual criteria during coding:

```bash
# Toggle the 1st checkbox item
dirban check 26-001 1

# Or edit the markdown file directly to mark:
# - [x] Add refresh token endpoint
```

---

### D. Completing & Archiving a Task
When all acceptance criteria are checked and verification passes:

```bash
# 1. Move task to done
dirban move 26-001 03-done

# 2. (Optional) Archive completed tasks into archive/YYYY/
dirban archive 26-001
```

---

## 3. CLI Command Cheat Sheet

| Intent | Command |
| :--- | :--- |
| **Inspect Board** | `dirban board --static` |
| **Get Next ID** | `dirban next-id` |
| **Create Task** | `dirban new "<title>" [--priority=p0..p3] [--column=<col>] [--tags=t1,t2]` |
| **View Task** | `dirban view <id>` |
| **Move Column** | `dirban move <id> <target-column>` |
| **Toggle Checkbox** | `dirban check <id> <index>` |
| **Update Metadata** | `dirban set <id> [--priority=p0..p3] [--assignee=<user>] [--tags=...]` |
| **Archive Tasks** | `dirban archive <id>` or `dirban archive all` |
