---
id: 26-004
title: Implement planning view and dependency unblocker
type: task
status: backlog
priority: p1
owner: developer
assigned_to: unassigned
created_date: 2026-11-01
last_updated: 2026-11-07
tags:
  - cli
  - planning
  - dependencies
---

# Implement planning view and dependency unblocker

Provides a planning and triage view (`dirban plan`) and blocker workflow (`dirban block`). Supports dependency and blocker tracking via canonical `relationships.depends_on`. When in-flight tasks encounter blockers, they are cleanly demoted to `backlog` to free up the active WIP slot, and surfaced in the planning view for unblocking.

## Acceptance Criteria
- [ ] Standardize single source of truth for task dependencies on OKF `relationships.depends_on` (can contain task IDs like `"26-001"` or external blocker strings like `"Waiting on approval"`).
- [ ] Add `dirban block <id-or-path> <reason...>` command:
  - Accepts one or multiple blocker reasons (as multiple arguments or comma-separated list).
  - Smart input normalization:
    - If argument is a task ID (e.g. `26-001`), stores normalized ID.
    - If argument is a task markdown file path or slug (e.g. `docs/tasks/01-todo/26-001-setup.md`), resolves via board discovery and stores canonical task ID `26-001` (prevents broken references when files move).
    - If argument is freeform text/event (e.g. `"Waiting for review"`, URL), stores raw string.
  - Appends new blockers to `relationships.depends_on` (deduplicating existing entries).
  - Automatically demotes the task from `02-doing` (or `01-todo`) back to `backlog` to free the active slot.
  - Updates task metadata and status without injecting manual execution journal entries (Git is the audit log).
- [ ] Automatic dependency resolution: if a dependency references another task ID and that task is in `03-done` or `archive/`, evaluate it as unblocked/resolved.
- [ ] Add `dirban plan` interactive view:
  - Partitions backlog into "Ready to Promote" and "Blocked / In Limbo".
  - Displays exact blocking tasks or external blocker strings.
  - Interactive unblock helper: if an external blocker has cleared, prompts to resolve it and promotes the task to `01-todo`.
- [ ] Add non-interactive scriptable flags for AI agents:
  - `dirban plan --ready`: Lists only unblocked backlog tasks ready to be scheduled.
  - `dirban plan --blocked`: Lists currently blocked backlog tasks and blocking sources.
  - `dirban plan --promote=<id>`: Promotes task from backlog to `01-todo` if unblocked.
- [ ] Add unit test vectors covering `dirban block`, dependency resolution, auto-unblocking upon task completion, and CLI commands.
- [ ] Document in `docs/cli-reference.md` and `.agents/skills/task-management/SKILL.md`.
