---
id: "26-010"
title: "VS Code Extension Backlog Planning and Dependency Triage View"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
tags:
  - vscode
  - extension
  - plan
  - dependencies
  - ui
relationships:
  depends_on:
    - "26-008"
  blocks: []
  related_to:
    - "26-004"
---

# VS Code Extension Backlog Planning and Dependency Triage View

Integrates the backlog planning, dependency evaluation, and unblocking workflow (`dirban plan`, `partitionBacklog`, `unblockTask`, `promoteTask`) into the VS Code extension interface.

Provides developers and project leads with a dedicated triage GUI directly inside the IDE to inspect backlog items, diagnose blocking dependencies, and promote ready work into the active workflow.

## Key Features

1. **Partitioned Backlog View**:
   - Replicates `partitionBacklog` into a visual dual-lane or collapsible tree view:
     - **Ready for Planning**: Tasks with all dependencies resolved, ready to be scheduled.
     - **Blocked**: Tasks with unresolved dependencies or explicit blockers, displaying blocking sources.

2. **Blocker Diagnostic Badges**:
   - Inline badge indicators on blocked tasks explaining exact reasons (e.g. `⛔ Blocked by: 26-008`, `⛔ API spec review`).
   - Clickable links to jump directly to the blocking task document or external reference.

3. **One-Click Promotion & Unblock Actions**:
   - Quick action button `Promote to Todo` on ready tasks that calls `promoteTask` to atomically move the card to `config.columns[0]`.
   - Context menu / button to unblock resolved reasons (`unblockTask`) directly from the UI.

## Acceptance Criteria

- [ ] Implement `DirbanPlanViewProvider` registering a custom planning panel / tree view in the Dirban activity container.
- [ ] Group backlog tasks into "Ready" and "Blocked" categories evaluated via `partitionBacklog`.
- [ ] Display visual badges for unresolved dependencies and blocker descriptions on blocked items.
- [ ] Implement one-click "Promote to Next Column" action calling `promoteTask` on ready tasks.
- [ ] Implement context action to unblock individual reasons calling `unblockTask`.
- [ ] Provide command palette shortcuts: `Dirban: Plan Backlog` and `Dirban: Promote Task`.
