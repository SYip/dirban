---
priority: p3
tags: [export, migration, jira, linear, cli]
---

# Task: Export / Migration Command for Cloud Tools (Linear, Jira, CSV/JSON)

## 1. Objective & Scope

Provide an off-ramp command (`dirban export` or `dirban migrate`) to help growing projects export tasks to cloud task trackers (such as Linear, Jira, or standard CSV/JSON import formats) when a team expands beyond 5–10 people and graduates from Dirban.

## 2. Acceptance Criteria (Definition of Done)

- [ ] Implement `dirban export --format=csv|json` to dump all tasks across columns with columns, title, body, status, priority, and checklist items.
- [ ] Provide Jira-compatible CSV mapping (Issue Type, Summary, Description, Status, Priority).
- [ ] Provide Linear-compatible CSV/JSON mapping (Title, Description, Status, Priority, Estimate).
- [ ] Support `--column=<col>` and `--include-archive` flags to limit scope of exported tasks.
- [ ] Add CLI documentation in `dirban export --help`.

## 3. Verification Plan

```bash
# Verify export output in terminal
bun run main.ts export --format=json
bun run main.ts export --format=csv
```
