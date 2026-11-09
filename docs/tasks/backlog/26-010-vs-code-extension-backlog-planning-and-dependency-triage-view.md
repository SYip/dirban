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

Integrates the backlog planning, dependency evaluation, and unblocking workflow (`dirban plan`, `partitionBacklog`, `unblockTask`, `readyTask`) into the VS Code extension interface.

Implements **Plan Mode** as an integrated view toggle within the full-width Webview board tab, allowing developers and project leads to triage backlog items, diagnose blocking dependencies, and drag-and-drop ready work directly into the active `01-todo` queue.

## Key Features

1. **Integrated Plan / Triage Mode in Webview Tab**:
   - Provide a top view switch in the full-width editor Webview: `[ Board View ] | [ Plan / Triage Mode ]`.
   - In Plan Mode, partitions the view into:
     - **Ready to Queue (Unblocked Backlog)**: Tasks with all dependencies resolved, ready to be scheduled.
     - **Blocked Backlog**: Tasks with unresolved dependencies or explicit blockers, displaying blocking sources.
     - **Target Queue (`01-todo`)**: Active destination column.

2. **Tactile Drag-and-Drop & One-Click Readying**:
   - Dragging a task from "Ready" into `01-todo` automatically readies the card (`readyTask` / `promoteTasks`).
   - One-click `Ready` button on unblocked cards to move them directly to `01-todo`.

3. **Blocker Diagnostic Badges & Unblock Actions**:
   - Visual badges on blocked tasks explaining exact reasons (e.g. `⛔ Blocked by: 26-008`, `⛔ API spec review`).
   - Clickable links to jump directly to the blocking task document or external reference.
   - One-click button to unblock individual resolved reasons (`unblockTask`) directly from the UI.

4. **Activity Bar TreeView "Backlog Planning" Node**:
   - Displays unblocked vs blocked counts in the sidebar tree view for at-a-glance status while coding.

## Acceptance Criteria

- [ ] Implement Plan Mode toggle inside the full-width Webview editor tab (`[ Board ] | [ Plan Mode ]`).
- [ ] Render partitioned backlog lanes (Unblocked / Ready vs Blocked) using `partitionBacklog`.
- [ ] Implement drag-and-drop and one-click action to ready unblocked tasks into `01-todo`.
- [ ] Display visual badges for unresolved dependencies and blocker descriptions on blocked items with clickable references.
- [ ] Implement context action / button to unblock individual reasons calling `unblockTask`.
- [ ] Provide command palette shortcuts: `Dirban: Plan Backlog` (opens board directly in Plan Mode) and `Dirban: Ready Task`.
