---
id: "26-004"
title: "Implement planning view and dependency unblocker"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-01"
last_updated: "2026-11-01"
tags: ["cli", "planning", "dependencies"]
---

# Implement planning view and dependency unblocker

Provides a planning and triage view (`dirban plan`) to review tasks in `backlog` and promote unblocked tasks to `01-todo`. Supports dependency and blocker tracking via canonical `relationships.depends_on` with automatic resolution when dependency tasks are completed.

## Acceptance Criteria
- [ ] Standardize single source of truth for task dependencies on OKF `relationships.depends_on` (can contain task IDs like `"26-001"` or external blocker strings like `"Waiting on approval"`).
- [ ] Automatic dependency resolution: if a dependency references another task ID and that task is in `03-done` or `archive/`, evaluate it as unblocked/resolved.
- [ ] Add `dirban plan` interactive view:
  - Lists backlog candidates eligible for promotion to `01-todo`.
  - Filters / highlights blocked tasks and displays blocking dependencies.
  - Interactive unblock helper: if blocked by external reason or non-task, prompts user if dependency is resolved.
- [ ] Add non-interactive scriptable flags for AI agents:
  - `dirban plan --ready`: Lists only unblocked backlog tasks ready to be scheduled.
  - `dirban plan --blocked`: Lists currently blocked backlog tasks and blocking sources.
  - `dirban plan --promote=<id>`: Promotes task from backlog to `01-todo` if unblocked.
- [ ] Add unit test vectors covering dependency resolution, auto-unblocking upon task completion, and CLI commands.
- [ ] Document in `docs/cli-reference.md` and `.agents/skills/task-management/SKILL.md`.
