---
id: "26-045"
title: "Require dirban done to run from main repo instead of inside a feature worktree"
status: "todo"
priority: "p2"
created: "2026-11-23"
tags:
  - cli
  - git
  - worktree
  - ux
blocked_by: []
---

# 26-045: Require `dirban done` to Run from Main Repo Instead of Inside a Feature Worktree

## Problem Statement
Running `dirban done` while `cwd` is inside a feature worktree deletes the directory the user's shell is currently in during `git worktree remove`, and can cause confusion if `repoRoot` is not on the base branch.

## Acceptance Criteria
- [x] Guard `doneTask` (when using worktree strategy and merging) so that if `cwd` is inside a linked worktree, it halts with a clear actionable message instructing the user to run `dirban done <id>` from the main repository (`repoRoot` on `baseBranch`).
- [x] Allow `--no-merge` from inside a worktree (since it does not remove the worktree).
- [x] Add/update unit and e2e tests in `src/tasks/lifecycle/worktree-lifecycle.e2e.test.ts` and `src/tasks/lifecycle/done.test.ts`.
