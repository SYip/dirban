---
id: "26-027"
title: "Only create .gitkeep files during init when Git is enabled"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-09"
last_updated: "2026-11-09"
tags:
  - init
  - git
  - vcs
  - project
relationships:
  depends_on: []
  blocks: []
  related_to: []
---

# Only create .gitkeep files during init when Git is enabled

Currently, `dirban init` (`initializeBoard` in `src/tasks/project/init.ts`) unconditionally writes empty `.gitkeep` files in `backlog`, all column directories, and `archive`.

If a workspace is a plain directory without Git enabled (or Git is unavailable), creating `.gitkeep` files adds unnecessary clutter since `.gitkeep` serves no purpose outside of Git directory tracking.

## Objectives
1. Check Git availability (e.g. using `GitVcsProvider.getContext(workspaceRoot).isAvailable` or inject an optional VCS provider into `initializeBoard`) prior to writing `.gitkeep` files.
2. Only write `.gitkeep` files when Git is active in the target workspace.
3. Skip creating `.gitkeep` files cleanly when running on non-Git directories without throwing or failing.
4. Add unit test vectors in `src/tasks/project/project.test.ts` verifying both paths:
   - When Git is enabled / simulated: `.gitkeep` files are generated.
   - When Git is disabled: directories are created but `.gitkeep` files are omitted.

## Acceptance Criteria
- [ ] Check Git repository availability in `initializeBoard` (`src/tasks/project/init.ts`) before writing `.gitkeep` files.
- [ ] Ensure `.gitkeep` files are created only when Git is enabled in the workspace.
- [ ] Ensure non-Git workspaces successfully initialize directory structure and config without placing `.gitkeep` files.
- [ ] Support dependency injection or mockable VCS provider in `initializeBoard` for clean, isolated functional unit testing.
- [ ] Add unit tests in `src/tasks/project/project.test.ts` covering both Git-enabled and non-Git workspace scenarios.
- [ ] Verify test suite passes (`bun test`) and TypeScript checks pass (`bun run typecheck`).
