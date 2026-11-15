---
id: "26-028"
title: "Make base branch configurable via config and CLI options"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-09"
last_updated: "2026-11-09"
tags:
  - git
  - config
  - cli
  - lifecycle
relationships:
  depends_on: []
  blocks: []
  related_to:
    - "okf.dirban.concepts.git-workflow"
---

# Make base branch configurable via config and CLI options

Currently, the base branch for trunk-based development in Dirban is hardcoded to `"main"` (`DEFAULT_BASE_BRANCH = "main"` in `git-branch-strategy.ts` and `git-worktree-strategy.ts`). While the internal API types accept an optional `baseBranch` parameter, it cannot be configured in `.dirban.json` or overridden via CLI flags.

Projects using different default branch names (such as `master`, `trunk`, or environment-specific targets) should be able to declare `baseBranch` in `.dirban.json` and optionally override it when running `dirban start` or `dirban done`.

See related architecture guide: [`docs/concepts/git-workflow.md`](file:///Users/andrew/Projects/dirban/docs/concepts/git-workflow.md).

## Objectives
1. Add `baseBranch?: string` to `DirbanConfig` schema and type definitions in `src/config/types.ts` and validation in `src/config/validate.ts`.
2. Update `DEFAULT_CONFIG` in `src/config/config.ts` (defaulting to `"main"`).
3. Plumb `config.baseBranch` through `startTask` and `doneTask` lifecycle routines to the workspace lifecycle strategies (`GitBranchLifecycleStrategy`, `GitWorktreeLifecycleStrategy`).
4. Expose `--base=<branch>` / `--base-branch=<branch>` flag in CLI parsers:
   - `dirban start <id> [--base=<branch>]`
   - `dirban done [id] [--base=<branch>]`
5. Update documentation:
   - Document `baseBranch` in [`docs/concepts/git-workflow.md`](file:///Users/andrew/Projects/dirban/docs/concepts/git-workflow.md).
   - Document `baseBranch` in `README.md` and `docs/cli-reference.md`.
6. Add unit test vectors in `src/tasks/lifecycle/` and `src/workspace/strategy.test.ts`.

## Acceptance Criteria
- [ ] Add `baseBranch?: string` to `DirbanConfig` interface in `src/config/types.ts` and config validator with default `"main"`.
- [ ] Wire `config.baseBranch` into `startTask` and `doneTask` options so strategies use the configured branch instead of the hardcoded `"main"`.
- [ ] Add CLI flag `--base` / `--base-branch` to `parseStart` (`src/tasks/lifecycle/start.cli.ts`) and `parseDone` (`src/tasks/lifecycle/done.cli.ts`).
- [ ] Update documentation in [`docs/concepts/git-workflow.md`](file:///Users/andrew/Projects/dirban/docs/concepts/git-workflow.md) and configuration tables to reflect configurable base branch.
- [ ] Add unit test vectors covering custom `baseBranch` in `.dirban.json` and CLI flag overrides in `done.test.ts` and `start.test.ts`.
- [ ] Run test suite (`bun test`) and typecheck (`bun run typecheck`) to ensure all tests pass cleanly.
