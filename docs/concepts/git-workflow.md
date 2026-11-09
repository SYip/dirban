---
okf_version: "1.0"
id: "okf.dirban.concepts.git-workflow"
title: "Trunk-Based Development & Git Workflow"
type: "concept"
status: "accepted"
owner: "developer"
last_updated: "2026-11-09"
tags:
  - git
  - workflow
  - trunk-based-development
  - lifecycle
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "okf.dirban.concepts.why-dirban"
---

# Trunk-Based Development & Git Workflow

## Overview

Dirban follows **Trunk-Based Development (TBD)** as its foundational version control axiom. All work is integrated frequently into a single, shared trunk branch (`main`), avoiding long-lived feature branches, staging branches, or multi-week integration merges.

This model aligns directly with the agent-native 5-to-30 minute autonomous execution loop: tasks are scoped into small, testable units, executed in short-lived task branches or worktrees, and integrated directly back into `main`.

---

## Core Principles

1. **Single Source of Truth (`main`)**:
   - `main` is the central trunk and must always remain deployable and stable.
   - Long-lived release or environment branches (`develop`, `staging`, `release/*`) are prohibited.

2. **Short-Lived Task Branches (`task/<id>-<slug>`)**:
   - When work begins (`dirban start <id>`), Dirban creates a short-lived branch or worktree branching directly from `main`.
   - Lifespan of a task branch is bounded (typically minutes to hours, not days).

3. **Continuous Integration & Auto-Merge**:
   - Upon completion and criterion verification (`dirban done`), Dirban merges the task branch back into `main` and cleans up the working tree.
   - For teams requiring pull request review before trunk integration, `dirban done --no-merge` (or configuring `"autoMerge": false` in `.dirban.json`) preserves the branch for PR submission.

---

## Lifecycle in Action

| Lifecycle Step | Command | Git Action | Result |
| :--- | :--- | :--- | :--- |
| **1. Start Task** | `dirban start <id>` | `git checkout -b task/<id>-<slug> main` *(or `git worktree add`)* | Moves task to `02-doing`; switches workspace to task branch. |
| **2. Autonomous Iteration** | Shell / Editor / Agent | `git add` & `git commit` | Frequent commits with test vectors and criteria checks. |
| **3. Complete Task** | `dirban done` | `git checkout main && git merge --no-ff task/... && git branch -d task/...` | Moves task to `03-done`; trunk updated cleanly. |
| **3b. PR Review (Optional)** | `dirban done --no-merge` | Skips git merge; keeps `task/<id>-<slug>` intact | Ready for `git push origin task/<id>-<slug>` and Pull Request. |

---

## Configuration & Overrides

In `.dirban.json`, Git automation behavior can be customized:

```json
{
  "baseBranch": "main",
  "autoMerge": true,
  "vcsStrategy": "branch"
}
```

- **`baseBranch: "main"` (default)**: The primary trunk branch for task branch creation and auto-merge (can be customized, e.g. `"master"` or `"trunk"`; see planned task [26-028](file:///Users/andrew/Projects/dirban/docs/tasks/backlog/26-028-make-base-branch-configurable-via-config-and-cli-options.md)).
- **`autoMerge: true` (default)**: Integrates directly into trunk on task completion.
- **`autoMerge: false`**: Retains the task branch on completion for code review / PR workflows. Can be forced per-run via `dirban done --merge`.
- **`vcsStrategy: "worktree"`**: Isolates task execution into a separate Git worktree under `.worktrees/` rather than switching branches in-place.
