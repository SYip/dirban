---
okf_version: "1.0"
id: 26-004
title: Implement planning view and dependency unblocker
type: task
status: 01-todo
priority: p1
owner: developer
assigned_to: unassigned
created_date: 2026-11-01
last_updated: 2026-11-07
tags:
  - cli
  - planning
  - dependencies
relationships:
  depends_on: []
  blocks: []
  related_to: []
---

# Implement planning view and dependency unblocker

Provides a planning and triage view (`dirban plan`), blocker workflow (`dirban block`), and unblocker workflow (`dirban unblock`). Supports dependency and blocker tracking via canonical `relationships.depends_on`. When in-flight tasks encounter blockers, they are cleanly demoted to `backlog` (the intrinsic starting staging directory) to free up the active WIP slot, and surfaced in the planning view for unblocking.

## Acceptance Criteria

### Phase 1: Core Blocker & Dependency Engine (`dirban block`, `dirban unblock`, Resolution)
- [x] Standardize single source of truth for task dependencies on OKF `relationships.depends_on` (can contain task IDs like `"26-001"` or external blocker strings like `"Waiting on approval"`).
- [x] Workflow & directory architecture:
  - `backlog/` and `archive/` are intrinsic filesystem staging & completion boundaries created and maintained by Dirban.
  - Active workflow columns are loaded from `config.columns` (e.g. `["01-todo", "02-doing", "03-done"]`).
  - Terminal/Done criteria: a task is considered completed/resolved if it is in any column whose name contains `done` or in `archive/`.
  - First workflow stage: `config.columns[0]` is the destination column when promoting ready work from `backlog/`.
- [x] Add `dirban block <id-or-path> <reason...>` command:
  - Accepts one or multiple blocker reasons (as multiple arguments or comma-separated list).
  - Smart input normalization:
    - If argument is a task ID (e.g. `26-001`), stores normalized ID.
    - If argument is a task markdown file path or slug (e.g. `docs/tasks/01-todo/26-001-setup.md`), resolves via board discovery and stores canonical task ID `26-001` (prevents broken references when files move).
    - If argument is freeform text/event (e.g. `"Waiting for review"`, URL), stores raw string.
  - Appends new blockers to `relationships.depends_on` (deduplicating existing entries).
  - Automatically demotes the task from active workflow columns back to `backlog/` to free the active slot.
  - Updates task metadata and status without injecting manual execution journal entries (Git is the audit log; agents record rich journal entries).
- [x] Add `dirban unblock <id-or-path> [reason...]` command:
  - Removes matching blockers from `relationships.depends_on` one by one (or all specified).
  - Smart resolution:
    - If reason is given (task ID or string), removes that specific blocker.
    - If no reason is given and only one blocker exists, removes it.
    - If multiple blockers exist and no reason given, lists them and prompts/errors to specify which to unblock.
- [x] Automatic dependency resolution:
  - For any dependency referencing a task ID, evaluates it as resolved if that target task is in a column containing `done` or in `archive/`.
  - A task in `backlog/` is fully unblocked if all its task dependencies are resolved and it has no unresolved external blocker strings.
- [x] Add unit test vectors covering `dirban block`, `dirban unblock`, input normalization, auto-demotion, and dependency resolution.

### Phase 2: Planning & Triage UX (`dirban plan`, Scriptable Flags, Documentation)
- [ ] Add `dirban plan` view:
  - Default: outputs a formatted terminal list partitioning `backlog/` into "Ready to Promote" and "Blocked / In Limbo" with exact blocking sources.
  - Interactive mode (`dirban plan --interactive` / `-i`): allows selecting blocked tasks to unblock individual items one by one, and promoting unblocked tasks to `config.columns[0]`.
- [ ] Add non-interactive scriptable flags for AI agents:
  - `dirban plan --ready`: Lists only unblocked backlog tasks ready to be scheduled.
  - `dirban plan --blocked`: Lists currently blocked backlog tasks and blocking sources.
  - `dirban plan --promote=<id>`: Promotes task from `backlog/` to `config.columns[0]` if unblocked (fails cleanly if still blocked).
- [ ] Add unit test vectors covering `dirban plan` partitioning, `--promote`, and CLI flags.
- [ ] Document in `docs/cli-reference.md` and `.agents/skills/task-management/SKILL.md`:
  - Detail `dirban block`, `dirban unblock`, `dirban plan`, and dependency resolution.
  - Define agent protocol for recording `[BLOCKED]` and `[UNBLOCKED]` events with timestamp and rationale in the task's `## Execution Journal`.
