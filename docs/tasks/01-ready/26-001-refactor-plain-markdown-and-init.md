---
okf_version: "1.0"
id: "task.dirban.core.26-001"
title: "Refactor Dirban engine to plain Markdown and add init command"
type: "task"
status: "ready"
priority: "p1"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-10-12"
last_updated: "2026-10-12"
tags:
  - refactor
  - parser
  - cli
  - init
relationships:
  depends_on: []
  blocks: []
  related_to:
    - "spec.md"
    - "docs/decisions/2026-10-12-plain-markdown-and-git-audit.md"
---

# Task: Refactor Dirban Engine to Plain Markdown and Add Init Command

## 1. Objective & Scope

Refactor the Dirban core parser, configuration loader, and CLI commands according to the revised [spec.md](file:///Users/andrew/Projects/dirban/spec.md) and architectural decision record [2026-10-12-plain-markdown-and-git-audit.md](file:///Users/andrew/Projects/dirban/docs/decisions/2026-10-12-plain-markdown-and-git-audit.md).

Specifically:
- Support pure Markdown tasks without requiring OKF YAML frontmatter.
- Parse `priority:` if present, defaulting to `p3` (or lowest) when absent.
- Extract task titles from the first `# ` Markdown header or filename.
- Calculate checklist completion directly from `- [ ]` and `- [x]` markdown items.
- Remove in-file execution journal mutation during task moves (`git` is the log).
- Implement interactive and non-interactive `dirban init` command.
- Support slug-based task matching as well as optional numeric IDs.

## 2. Acceptance Criteria (Definition of Done)

- [ ] Parser accepts files without frontmatter and extracts title from `# Header` or filename.
- [ ] Parser extracts priority `p0`–`p3` if present in frontmatter, defaulting to `p3` if omitted.
- [ ] Checkboxes `- [ ]` and `- [x]` are parsed into total/completed counts for card badges.
- [ ] Move command (`dirban move`) performs physical file rename without injecting execution journal into file content.
- [ ] Remove OKF serializer/formatter (`src/okf/serializer.ts`), preserving original file markdown and formatting intact.
- [ ] Omit `assignee` and `owner` requirements from CLI flags and parser data models.
- [ ] `dirban init` interactive wizard prompts for tasks path, flow preset, and ID style.
- [ ] `dirban init -y` scaffolds default directories (`backlog/`, `01-ready/`, `02-doing/`, `03-done/`, `archive/`) and writes `dirban.json`.
- [ ] CLI commands (`view`, `move`, `check`) support fuzzy slug lookup (e.g., `dirban move auth done`).
- [ ] Existing and updated unit tests pass.

## 3. Verification Plan

```bash
# Run unit tests
bun test

# Typecheck code
bun run typecheck
```
