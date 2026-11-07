---
okf_version: "1.0"
id: 26-003
title: Implement current task focus view
type: task
status: backlog
priority: p1
owner: developer
assigned_to: unassigned
created_date: 2026-11-01
last_updated: 2026-11-07
tags:
  - cli
  - view
  - ux
relationships:
  depends_on: []
  blocks: []
  related_to: []
---

# Implement current task focus view

Provides a zero-friction command (`dirban current` or `dirban focus`) to inspect the single task currently in progress (`02-doing` / active column) directly in stdout.

## Acceptance Criteria
- [ ] Add `dirban current` (alias `dirban focus`) command to CLI.
- [ ] Display task title, ID, priority badge, and formatted acceptance criteria checklist if exactly 1 task is in active/doing column.
- [ ] Support raw / cat output flag (e.g. `--raw`) to dump raw Markdown for agent piping.
- [ ] Handle 0 active tasks with helpful prompt (`No task in progress. Pick one with 'dirban move <id> 02-doing'`).
- [ ] Handle multiple active tasks by listing active IDs and offering interactive/flag selection.
- [ ] Add unit test vectors in `operations.test.ts`.
- [ ] Document in `docs/cli-reference.md` and `.agents/skills/task-management/SKILL.md`.
