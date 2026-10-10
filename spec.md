# Project Proposal & Specification: Dirban (`dirban`)

> **A Zero-Database, Agent-Native Kanban Engine & TUI Backed by the File System and Google Open Knowledge Format (OKF).**

---

## 1. Executive Summary & Vision

Modern software teams and autonomous AI coding agents (Claude Code, Cursor, Antigravity, GitHub Copilot) need lightweight, Git-native task management. However:
- **Cloud tools (Jira, Linear)** require external APIs, webhooks, auth tokens, and network connectivity that disrupt offline workflows and complicate AI agent access.
- **Monolithic Markdown tools (Taskell, Obsidian Kanban)** store an entire board in a single file, resulting in git merge conflicts and excessive token context loads for AI agents.
- **Generic flat-file tools** lack physical directory isolation and strict schema validation.

**Dirban** (`dirban`) addresses this with:
1. **Physical Columns**: Every column is an ordinary subdirectory on disk (e.g., `00-backlog/`, `01-ready/`, `02-in-progress/`, `03-done/`).
2. **Atomic OKF Cards**: Every task is an isolated `.md` document formatted with standard **Google Open Knowledge Format (OKF)** YAML frontmatter.
3. **Dual Interface**: A fast CLI + interactive Terminal UI (TUI) for developers, paired with a deterministic file interface for AI agents.


---

## 2. Core Philosophy & Value Proposition

- **Zero-Database, Zero-Cloud**: The filesystem and Git *are* the database. Merge, branch, diff, and review tasks like code.
- **Agent-Native by Design**: AI agents do not require special SDKs or credentials—they manage work using native file operations (`ls`, `mv`, `cat`).
- **Google OKF Strict Compliance**: Tasks carry machine-readable IDs, explicit priority levels (`p0`–`p3`), dependency graphs (`relationships.depends_on`, `relationships.blocks`), and verifiable acceptance criteria.
- **Config-Driven Dynamic Hierarchy**: Works with any folder naming convention. Whether using `todo`/`doing`/`done` or numbered stages (`00-backlog`/`01-ready`), the engine auto-discovers columns and orders them via a simple configuration.

---

## 3. Key Feature Specifications

### 1. Dynamic Column Discovery & Configurable Ordering
- Scans a configured root directory (e.g., `docs/tasks/`).
- Every subdirectory is discovered as a column.
- User-defined sort configuration determines column presentation order, with unlisted directories gracefully appended alphabetically.

### 2. Multi-Dimensional Sorting & Grouping
Unlike static alphabetical views in IDE file explorers, OKF-Kanban dynamically sorts cards within columns by:
- **Priority**: `p0` (Critical) $\rightarrow$ `p1` (High) $\rightarrow$ `p2` (Medium) $\rightarrow$ `p3` (Low).
- **Recency**: By `last_updated` or `created_date`.
- **Sequential ID**: By chronological task number (e.g., `26-001`).
- **Tag / Subproject**: Filter or group by target application (e.g., `apps/safe-harbor-calc`).

### 3. Atomic Task Movement (`move`)
Moving a task between columns:
- Moves the physical `.md` file to the destination directory (`fs.rename`).
- Automatically updates frontmatter `status:` to match the target column.
- Touches `last_updated: "YYYY-MM-DD"`.
- Appends an audit entry to the task's `## Execution Journal`.

### 4. Detailed Card Inspection (`view`)
Displays a human-friendly card overview in the terminal without opening raw markdown:
- Metadata badges: ID, Priority, Tags, Assignee.
- Graph relationships: Blocked by / Blocks links.
- Interactive acceptance criteria progress bar (e.g., `Acceptance Criteria: [████░░░░░░] 2/5 completed`).
- Direct shortcut to open the file in the active editor (`code`, `nvim`, `$EDITOR`).

### 5. Task Mutation & Status Updates (`set` / `check`)
- Quick CLI updates:
  ```bash
  okf-board set 26-001 --priority=p0 --assignee=andrew
  ```
- Toggle acceptance criteria directly from the terminal:
  ```bash
  okf-board check 26-001 2 # toggles checklist item #2
  ```

---

## 4. Document Contract: Google OKF Task Schema

Each task conforms to Google Open Knowledge Format:

```markdown
---
okf_version: "1.0"
id: "task.project.<domain>.[YY]-[3-digit]"
title: "<Concise Imperative Title>"
type: "task"
status: "todo"           # synced with column directory
priority: "p1"           # p0 | p1 | p2 | p3
owner: "developer"       # developer | agent | unassigned
assigned_to: "unassigned"
created_date: "YYYY-MM-DD"
last_updated: "YYYY-MM-DD"
tags:
  - backend
  - auth
relationships:
  depends_on:
    - "task.project.core.26-001"
  blocks: []
  related_to: []
---

# Task: <Concise Imperative Title>

## 1. Objective & Scope
<Problem statement and clear business outcome.>

## 2. Acceptance Criteria (Definition of Done)
- [ ] Explicit measurable criterion 1
- [ ] Explicit measurable criterion 2
- [ ] Verification command passes

## 3. Verification Plan
```bash
# Automated verification commands
deno test
deno lint
```

## 4. Execution Journal
- **YYYY-MM-DD**: Task initialized.
```

---

## 5. Architecture & Implementation Options

| Component | Recommendation |
| :--- | :--- |
| **Runtime & Language** | **TypeScript (Deno / Bun)** for rapid scripting & portability, or **Rust** for a standalone single binary. |
| **Distribution** | Native Deno script (`deno install -g`), npm package (`npx okf-board`), or standalone binary. |
| **Terminal TUI Library** | [ink](https://github.com/vadimdemedes/ink) (React in CLI), [cliffy](https://deno.land/x/cliffy) (Deno), or [ratatui](https://github.com/ratatui-org/ratatui) (Rust). |
| **Frontmatter Engine** | `gray-matter` / `yaml` parser with Zod or TypeBox schema validation. |
| **Configuration** | Minimal `.okf-kanban.json` in workspace root. |

---

## 6. Architectural Challenges, Edge Cases & Design Mitigations

### 1. Concurrent Status Moves & Git Conflicts
- **Concern**: Two branches moving the same task file or editing/moving simultaneously trigger Git `rename/modify` conflicts.
- **Mitigation**: Tasks are designed to be worked on atomically by a single owner/agent. The CLI includes a validation/sync command to detect duplicate IDs or orphaned files across columns.

### 2. Broken Relative Markdown Links
- **Concern**: Relative paths like `../01-ready/26-001.md` break when the file moves to `02-in-progress/` or `03-done/`.
- **Mitigation**: Standardize on **OKF ID linking** (`[Task 26-001](okf:task.raven.domain.26-001)` or short ID `26-001`). The engine resolves cards by ID regardless of which column directory they currently occupy.

### 3. File System Scale & Clutter
- **Concern**: As projects grow over months or years, hundreds of completed `.md` files in `03-done/` degrade IDE search performance and scan latency.
- **Mitigation**: Built-in archival workflow (`okf-board archive`) to periodically partition completed tasks into yearly or quarterly archive subdirectories (`docs/tasks/archive/2026/`).

### 4. Source of Truth: Physical Folder vs. YAML Frontmatter
- **Concern**: If a user drags a file in the file explorer or runs shell `mv` without updating the YAML frontmatter `status:`, state becomes desynchronized.
- **Mitigation**: **The physical folder is the strict source of truth.** When reading cards, the column is determined by folder path, and the CLI automatically self-heals or prompts to update frontmatter discrepancies.

### 5. Cross-Platform Filesystem Quirks
- **Concern**: Case insensitivity (macOS/Windows) vs. case sensitivity (Linux), and illegal characters (`:`, `?`, `*`) on Windows NTFS.
- **Mitigation**: Enforce strict kebab-case filenames (`[YY]-[3-digit]-[kebab-slug].md`) containing only lowercase alphanumeric characters and hyphens.

### 6. Priority-Driven Sorting vs. Manual Column Ranking
- **Philosophy**: Traditional Kanban tools use arbitrary drag-and-drop vertical ordering (ranking). This requires maintaining fragile integer position indices (`order: a0`) in text files.
- **The OKF Decision**: **No manual rank indices needed.** If a task needs to be worked on before another, **raise its priority** (`p0` > `p1` > `p2` > `p3`). Within identical priority tiers, cards sort deterministically by chronological task ID or recency. This keeps files clean, diff-friendly, and free of artificial ordering churn.

---

## 7. Roadmap & Phases

- **Phase 1 (Core)**: 
  - Standalone CLI & TUI tool (`dirban`).
  - Directory scanner, frontmatter parser/serializer, priority sorter.
  - Task commands (`board`, `move`, `view`, `set`, `check`, `archive`).
- **Phase 2 (IDE Integration - Later)**:
  - Dedicated **VS Code Extension** (`vscode-dirban`).
  - Activity Bar custom tree view & Webview Kanban board.
  - Drag-and-drop between columns synced with filesystem changes.
  - Reusable core engine shared between CLI and extension.
- **Phase 3 (Git-Powered Reporting & Analytics - Later)**:
  - **Commit & Diff Archaeology**: Inspect `git log --follow` on task files to reconstruct exact movement timestamps across folders (`00-backlog` $\rightarrow$ `01-ready` $\rightarrow$ `02-in-progress` $\rightarrow$ `03-done`).
  - **Metrics & KPIs**: Calculate Lead Time, Cycle Time, Throughput, and Work-in-Progress (WIP) age without any external database.
  - **Release Changelog Generation**: Correlate completed tasks in `03-done/` between git tags to auto-generate release notes and sprint summaries.



