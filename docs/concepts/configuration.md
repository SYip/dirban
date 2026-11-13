---
okf_version: "1.0"
id: "okf.dirban.concept.configuration"
title: "Dirban Configuration Guide (.dirban.json)"
type: "concept"
status: "accepted"
owner: "developer"
last_updated: "2026-11-10"
tags:
  - config
  - schema
  - customization
  - workflows
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "spec.md"
    - "docs/cli-reference.md"
    - "docs/concepts/git-workflow.md"
---

# Dirban Configuration (`.dirban.json`)

Dirban works out-of-the-box with **zero configuration**, assuming a standard `01-todo` $\rightarrow$ `02-doing` $\rightarrow$ `03-done` workflow inside `docs/tasks/`. 

To customize column names, paths, priority tiers, or Git branching strategies, add an optional `.dirban.json` file in your repository root (or configure `.vscode/settings.json` under `"dirban.*"`).

---

## Complete Schema Reference

```json
{
  "$schema": "https://raw.githubusercontent.com/andrew/dirban/main/schema.json",
  "tasksDir": "docs/tasks",
  "focusColumn": "02-doing",
  "archiveDir": "docs/tasks/archive",
  "priorities": ["p0", "p1", "p2", "p3"],
  "defaultPriority": "p2",
  "branchStrategy": "checkout",
  "branchPrefix": "task/",
  "autoMerge": true
}
```

### Options

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tasksDir` | `string` | `"docs/tasks"` | Relative root folder storing board columns and tasks. |
| `focusColumn` | `string` | `"02-doing"` | The designated active execution column tracked by `dirban current`. |
| `archiveDir` | `string` | `"docs/tasks/archive"` | Destination folder where `dirban archive` moves completed tasks. |
| `priorities` | `string[]` | `["p0", "p1", "p2", "p3"]` | Recognized priority tokens, sorted highest to lowest. |
| `defaultPriority` | `string` | `"p2"` | Fallback priority assigned to tasks without an explicit priority. |
| `branchStrategy` | `"checkout" \| "worktree" \| "none"` | `"checkout"` | Workspace strategy when starting a task (`checkout` branch, separate `worktree`, or `none`). |
| `branchPrefix` | `string` | `"task/"` | Prefix applied to Git task branches (e.g., `task/26-001-slug`). |
| `autoMerge` | `boolean` | `true` | Automatically squash and merge the task branch into base branch upon `dirban done`. |

---

## Workflow Recipes

### 1. Default Numbered Workflow
Best for standard development and sorting columns cleanly in file explorers:
```json
{
  "tasksDir": "docs/tasks",
  "focusColumn": "02-doing"
}
```

### 2. Custom Semantic Priority Tiers
Customize priority tokens to match team conventions:
```json
{
  "priorities": ["urgent", "high", "normal", "low"],
  "defaultPriority": "normal"
}
```

### 6. Git Worktree Strategy
Isolate every task into its own Git worktree directory without modifying your current workspace:
```json
{
  "branchStrategy": "worktree"
}
```
- `dirban start <id>` creates an isolated worktree folder under `.worktrees/`.
- `dirban done` cleans up and deletes the worktree after merging.
