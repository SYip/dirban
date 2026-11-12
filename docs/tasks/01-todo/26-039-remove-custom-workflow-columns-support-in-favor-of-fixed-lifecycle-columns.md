---
id: 26-039
title: Deprecate and Remove Custom Workflow Columns Support in Favor of Fixed Lifecycle Columns
status: todo
priority: p2
assignee: unassigned
tags:
  - config
  - workflow
  - refactor
  - architecture
  - lifecycle
created: 2026-11-12T16:00:00Z
updated: 2026-11-12T16:00:00Z
relationships:
  depends_on:
    - "26-036"
---

# Deprecate and Remove Custom Workflow Columns Support in Favor of Fixed Lifecycle Columns

## Problem Statement

Dirban currently supports configuring an arbitrary `columns` array in `.dirban.json` (e.g. `columns: ["todo", "develop", "test", "production"]`).

Per architectural decision [2026-11-12-minimal-columns-vs-in-task-workflow.md](../../decisions/2026-11-12-minimal-columns-vs-in-task-workflow.md), modeling operational stages (`dev`, `test`, `review`) as physical filesystem columns causes file thrashing, noisy Git renames, and path collisions in concurrent worktrees. Instead, board directory columns are strictly reserved for workspace lifecycle (`backlog/`, `01-todo/`, `02-doing/`, `03-done/`, and `archive/`), while execution stages belong inside in-task hierarchical checklists.

Supporting custom column schemas adds unnecessary complexity to:
1. `DirbanConfig` schema and validation logic (`columns: readonly string[]`).
2. Board discovery and column ordering resolution across CLI and VS Code extension.
3. Tests and edge case handling (empty columns, single column, duplicate column names).

## Acceptance Criteria

- [ ] **1. Configuration & Types Refactoring**
  - [ ] Remove `columns` property from `DirbanConfig` in `src/config/types.ts`.
  - [ ] Update `DEFAULT_CONFIG` in `src/config/config.ts` to use fixed lifecycle columns constant (`DEFAULT_COLUMNS = ["todo", "doing", "done"]`).
  - [ ] Deprecate/ignore or remove `columns` parsing and validation in `src/config/config.ts`.
- [ ] **2. Core Board & Lifecycle Simplification**
  - [ ] Simplify `discoverBoard` and board column resolution in `src/board/` to operate against fixed standard directories (`backlog`, `01-todo`, `02-doing`, `03-done`, `archive`).
  - [ ] Remove custom workflow branching/fallbacks in `src/tasks/lifecycle/start.ts` and `src/tasks/lifecycle/done.ts`.
- [ ] **3. VS Code Extension & Settings Update**
  - [ ] Remove `dirban.columns` setting from `packages/vscode-extension/package.json` if present.
  - [ ] Ensure board panel and webview render the standard lifecycle columns.
- [ ] **4. Test Suite Cleanup & Verification**
  - [ ] Remove custom workflow test vectors from `src/config/config.test.ts`, `src/tasks/lifecycle/start.test.ts`, and `src/tasks/lifecycle/done.test.ts`.
  - [ ] Add unit test vector verifying board discovery adheres strictly to standard lifecycle columns.
  - [ ] Verify test suite passes (`bun test`) and strict typing passes (`bun run typecheck`).
- [ ] **5. Documentation**
  - [ ] Update `docs/concepts/configuration.md` and `docs/cli-reference.md` removing `columns` configuration references.
