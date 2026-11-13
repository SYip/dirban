---
id: "26-041"
title: "Use 00-backlog and 04-archive as default lifecycle directories"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-13"
last_updated: "2026-11-13"
tags: []
---

# Use 00-backlog and 04-archive as default lifecycle directories

## Acceptance Criteria
- [ ] Update `DEFAULT_BACKLOG_DIR` (`docs/tasks/00-backlog`) and `DEFAULT_ARCHIVE_DIR` (`docs/tasks/04-archive`) in `src/config/config.ts`
- [ ] Update `initializeBoard` in `src/tasks/project/init.ts` to create `00-backlog` and `04-archive`
- [ ] Replace hardcoded `"backlog"` / `"archive"` references in lifecycle and planning modules (`start.ts`, `done.ts`, `ready.ts`, `plan.ts`, `block.ts`, `archive.ts`, `create.ts`)
- [ ] Update affected test suites (`project.test.ts`, `router.test.ts`, `plan.test.ts`, `start.test.ts`, `ready.test.ts`, `done.test.ts`) and verify `bun test` and `bun run typecheck` pass
