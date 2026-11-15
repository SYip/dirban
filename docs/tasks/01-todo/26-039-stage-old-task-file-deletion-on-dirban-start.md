---
id: "26-039"
title: "Stage old task file deletion when moving task on dirban start"
status: "todo"
priority: "p1"
created: "2026-11-15"
tags:
  - cli
  - git
  - bug
blocked_by: []
---

# 26-039: Stage old task file deletion when moving task on dirban start

## Problem Statement
When running `dirban start <id>`, the task file is moved from its previous column (e.g., `01-todo`) to `02-doing`, and the CLI commits the new file in `02-doing`. However, it does not stage the deletion of the old file path, leaving it as an unstaged deletion (` D`) in `git status` and causing a duplicated file in the previous column's git history.

## Acceptance Criteria
- [ ] Ensure `dirban start` (and any other task-moving lifecycle commands) stages both the new file path and the deletion of the old file path before committing.
- [ ] Add/update tests to verify `git status` is clean after `dirban start` moves a task between columns.
