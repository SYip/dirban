---
id: "26-043"
title: "Add automatic lint, typecheck, and test checks before merge and before push to main"
status: "backlog"
priority: "p1"
created: "2026-11-20"
tags:
  - ci
  - git
  - cli
  - dx
blocked_by: []
---

# 26-043: Add Automatic Lint, Typecheck, and Test Checks Before Merge and Before Push to Main

## Problem Statement
Currently, `dirban done` auto-merges task branches into `main` and `git push` pushes `main` without running `bun run check`, `bun run typecheck`, or `bun test`. Formatting, lint, or typecheck errors can land on `main` and fail CI after the fact.

## Acceptance Criteria
- [ ] Support a pre-merge check (e.g. `preMerge` command in `.dirban.json` or `dirban done`) that runs `bun run check && bun run typecheck && bun test` before merging a task branch into `main`, aborting the merge on failure.
- [ ] Add a `.githooks/pre-push` hook (configured via `git config core.hooksPath .githooks`) that runs `bun run check && bun run typecheck && bun test` only when pushing `refs/heads/main`.
- [ ] Document the hook setup in `package.json` (`prepare` script) / project docs and verify with tests.
