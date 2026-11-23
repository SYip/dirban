---
id: "26-044"
title: "Add CLI command to reassign or renumber task IDs"
status: "backlog"
priority: "p2"
created: "2026-11-23"
tags:
  - cli
  - tasks
  - dx
blocked_by: []
---

# 26-044: Add CLI Command to Reassign or Renumber Task IDs

## Problem Statement
When tasks are created manually, by agents, or across parallel branches, duplicate task IDs can occur (e.g., colliding with tasks in `03-done` or `04-archive`). Fixing this currently requires manually editing frontmatter, headings, filenames, and `blocked_by` references.

## Acceptance Criteria
- [ ] Add a `dirban reassign <old-id> [new-id]` (or `renumber`) CLI command that auto-assigns the next available ID when `new-id` is omitted, or validates and uses `new-id` when provided.
- [ ] Update frontmatter `id:`, the `# <id>:` heading, and rename the task file on disk.
- [ ] Update any `blocked_by` references pointing to `<old-id>` across all board tasks.
- [ ] Add unit tests covering auto-assignment, explicit target ID, collision rejection, and `blocked_by` reference updates.
