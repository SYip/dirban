# Project Specification: Dirban (`dirban`)

> **A Zero-Database, Agent-Native Kanban Engine & TUI Backed by the File System and Flexible Markdown (Supporting Google OKF).**

---

## 1. Executive Summary & Vision

Modern software developers and autonomous AI coding agents (Claude Code, Cursor, Antigravity, GitHub Copilot) need lightweight, Git-native task management. However:
- **Cloud tools (Jira, Linear)** require external APIs, webhooks, auth tokens, and network connectivity that disrupt offline workflows and complicate AI agent access.
- **Monolithic Markdown tools (Taskell, Obsidian Kanban)** store an entire board in a single file, resulting in git merge conflicts and excessive token context loads for AI agents.
- **Strict schema tools** impose brittle formatting requirements, rigid relationship graphs, and validation failures that create friction for fast iterations.

**Dirban** (`dirban`) provides a radically pragmatic balance:
1. **Physical Columns as Subdirectories (Directory is the State)**: Every active column is an ordinary subdirectory on disk (e.g., `01-ready/`, `02-doing/`, `03-done/`). The directory location *is* the task's state. Files do not need and should not store a `status` variable. Even if legacy OKF frontmatter contains a `status:` field, the physical directory always wins.
2. **Markdown Tasks with Flexible OKF Support**: Every task is an isolated `.md` file. Full **Google Open Knowledge Format (OKF)** schemas are supported and recognized, but **strict OKF compliance is never required**. Frontmatter is completely optional; standard Markdown headings (`# Title`) and checklists (`- [ ]`) work out of the box.
3. **Optional Priority & OKF Metadata**: If frontmatter exists (whether minimal YAML or full OKF schema), Dirban gracefully extracts metadata like `priority: p0 | p1 | p2 | p3`, `tags:`, `owner:`, and `id:`. If omitted, tasks default to the lowest priority (`p3`) without throwing parser errors. In-file `status` is neither required nor tracked—the containing folder dictates status.
4. **Git is the Audit Log**: No in-file execution journals or database histories. File moves and diffs tracked by Git provide the immutable audit trail.
5. **Dual Interface**: A fast CLI + interactive Terminal UI (TUI) for developers, paired with an interactive VS Code extension and deterministic file operations for AI agents.

*(For detailed architectural positioning against Linear, Jira, Obsidian Kanban, and raw shell file exploration, see [Why Dirban](docs/concepts/why-dirban.md).)*

---

## 2. Core Philosophy & Invariants

- **Zero-Database, Zero-Cloud**: The filesystem and Git *are* the database. Merge, branch, diff, and review tasks like code.
- **Agent-Native by Design**: AI agents do not require special SDKs or credentials—they read, write, and move tasks using standard filesystem commands (`ls`, `mv`, `cat`).
- **Markdown-First, OKF-Compatible**: Any valid `.md` file in a column folder is a recognized task. Strict OKF frontmatter is supported for structured teams, but never enforced—tasks will never fail to parse due to missing fields.
- **Dual Workflow Modalities (Hyper-Flexible)**:
  - **Macro-Workflow (Directory-Driven)**: Users can model workflow stages as directories (`backlog/` $\rightarrow$ `ready/` $\rightarrow$ `doing/` $\rightarrow$ `done/` $\rightarrow$ `archive/`).
  - **Micro-Workflow (Document-Driven)**: Users who prefer minimal folder sprawl can keep tasks in a single folder and manage the entire workflow internally via **Markdown sections** (`## Spec`, `## Implementation`, `## Verification`) and **checkbox lists** (`- [ ]`).
  - Both patterns can be combined seamlessly without engine restrictions.
- **Target Audience: Solo Builders & Small Teams ($\le 5$ people)**:
  - Designed specifically for indie hackers, solo developers, pair-programming pairs, and micro-teams working closely with AI agents.
  - **Explicit Non-Goals (Why it's not for large teams)**:
    - *No enterprise access control or permissions* (the filesystem has no role-based ACLs).
    - *No distributed ID conflict resolution* (concurrent offline task generation by dozens of people would cause numbering collisions).
    - *No automated git rename-conflict arbitration* (large teams moving tasks across concurrent feature branches will hit git rename collisions).
    - *No forced workflow compliance* (no transition validators, approvals, or mandatory field guards).
    - Teams requiring enterprise governance, ACLs, and hundreds of daily concurrent ticket moves should use Jira or Linear.
- **Checkboxes for Breakdown**: Subtasks and acceptance criteria are standard Markdown `- [ ]` checkboxes within the file. No complex relational graphs (`depends_on`, `blocks`).
- **Git is the Event Log**: Moving files between directories via Git commits naturally preserves timestamps, author history, and movement logs (`git log --follow`).
- **Optional Task Assignment (Never Enforced)**: Developers can freely put their name on a task (e.g. `owner: alice`, `assignee: bob`, or `@username` in the markdown body), but it is never mandatory. Dirban functions completely without assignees, avoiding the need for user registries or auth configs.
- **Near-Zero Learning Curve & "Forget About Dirban"**: You don't need to learn a new syntax, CLI dialect, or mental model. You already know how to create folders, write Markdown notes, and move files. You can completely forget the tool exists—if you prefer, you can manage your entire task flow using standard file explorers (Finder, VS Code Explorer) or Unix commands (`mv`, `ls`, `cat`, `git`). Dirban acts as an optional, transparent lens that enhances your filesystem, not a gatekeeper.
- **Zero Lock-In & Total Longevity**: Because tasks are plain OS directories and human-readable Markdown files, your project's roadmap and documentation survive independently of Dirban itself. If the CLI or extension is uninstalled or abandoned, the entire task board remains fully usable and editable with standard terminal commands (`mv`, `ls`, `cat`) and any text editor.

---

## 3. Directory Layout & Column Lifecycle

Dirban partitions the workflow into three column tiers:

```text
tasks/
├── backlog/         # Mandatory staging queue (unbounded ideas & future backlog)
├── 01-ready/        # Configurable active pipeline (default)
├── 02-doing/        # Configurable active pipeline (default)
├── 03-done/         # Configurable active pipeline (default)
└── archive/         # Mandatory terminal storage (partitioned by year or topic)
```

1. **`backlog/` (Mandatory Queue)**:
   - Holds unscheduled, prioritized, or raw backlog tasks.
   - May contain hundreds of files without cluttering active WIP boards.
2. **Active Pipeline Columns (Configurable)**:
   - Columns represent active work stages.
   - Default: `["01-ready", "02-doing", "03-done"]` or `["todo", "doing", "done"]`.
   - Number prefixes are optional (e.g., `ready/` is just as valid as `01-ready/`).
3. **`archive/` (Mandatory Terminal State)**:
   - Completed tasks moved out of the active board are stored here.
   - Can be partitioned hierarchically (e.g., `archive/2026/`) to maintain high filesystem performance and clean navigation.

---

## 4. Initialization & Configuration (`dirban init`)

Dirban provides an interactive `init` wizard to scaffold new workspaces and generate a configuration file.

### Config Resolution Hierarchy
Dirban resolves its configuration in the following order:
1. Environment variable (`DIRBAN_PATH` / `DIRBAN_CONFIG`)
2. Project configuration file (`dirban.json` or `.dirban.json`)
3. VS Code Workspace settings (`.vscode/settings.json` under `dirban.*`)
4. Built-in defaults

### `dirban.json` Schema
```json
{
  "$schema": "https://dirban.dev/schema.json",
  "tasksDir": "./tasks",
  "id": {
    "mode": "none"
  },
  "columns": {
    "backlog": "backlog",
    "flow": [
      "01-ready",
      "02-doing",
      "03-done"
    ],
    "archive": "archive"
  },
  "defaults": {
    "priority": "p3"
  }
}
```

### Configuration Options
- **`tasksDir`**: Path to tasks root directory (default: `./tasks` or `docs/tasks`).
- **`id.mode`**:
  - `"none"` (Default): Tasks identified by filename slug (e.g., `fix-auth-flow.md`).
  - `"numeric"`: Auto-incrementing numerical prefix (e.g., `042-fix-auth-flow.md`).
  - `"custom"`: Configurable pattern or script generator.
- **`columns`**:
  - `backlog`: Name of backlog folder (mandatory).
  - `flow`: Ordered array of active column names.
  - `archive`: Name of archive folder (mandatory).
- **`defaults.priority`**: Default priority assigned when frontmatter lacks `priority` (default: `p3`).

---

## 5. Task Document Specification

Tasks are Markdown files. **Full Google Open Knowledge Format (OKF) schemas are supported**, but **strict OKF compliance is not required**. Frontmatter can be full OKF, minimal YAML, or completely omitted.

### Example A: Full Google OKF Task (Supported)
```markdown
---
okf_version: "1.0"
id: "task.dirban.auth.26-001"
title: "Fix authentication session expiration"
type: "task"
status: "ready"
priority: "p1"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-10-12"
last_updated: "2026-10-12"
tags:
  - auth
  - backend
---

# Fix authentication session expiration

- [ ] Investigate Redis session TTL key
- [ ] Add regression test in auth suite
- [ ] Update frontend refresh token interceptor
```

### Example B: Lightweight YAML Frontmatter (Supported)
```markdown
---
priority: p1
tags: [auth, backend]
---

# Fix authentication session expiration

- [x] Investigate Redis session TTL key
- [ ] Add regression test in auth suite
- [ ] Update frontend refresh token interceptor
```

### Example C: Minimal Pure Markdown (Supported - No Frontmatter Required)
```markdown
# Fix authentication session expiration

Users are randomly logged out after 15 minutes instead of 7 days.

## Checklist
- [ ] Investigate Redis session TTL key
- [ ] Add regression test in auth suite
- [ ] Update frontend refresh token interceptor
```

### Parsing Rules & OKF Fallbacks
1. **Title**:
   - First `# ` header in markdown, or `title:` in OKF frontmatter, or humanized filename.
2. **Directory is the State (No In-File `status` Needed)**:
   - The task's column status is determined solely by the physical subdirectory it resides in (e.g., `01-ready/`, `02-doing/`).
   - Tasks do **not** require a `status:` frontmatter variable.
   - If a legacy OKF file contains `status:`, the physical directory **always wins** to eliminate state drift and avoid file rewrites on task moves.
3. **Priority**:
   - Extracted from `priority:` in frontmatter (`p0`, `p1`, `p2`, `p3`).
   - If missing or invalid, defaults gracefully to configured lowest priority (`p3`).
4. **Acceptance Criteria & Progress**:
   - Parsed by counting `- [ ]` and `- [x]` markdown checklist items anywhere in the file.
   - Displayed as a progress badge (e.g., `[1/3]`).
5. **OKF Identity & Tags**:
   - If OKF `id:` or `tags:` are provided, Dirban leverages them for filtering and search.
   - If missing, tasks are identified by their filename slug (e.g., `fix-auth-flow.md`).
6. **No Rigid Relational Schema Enforcement**:
   - OKF relationship blocks (`depends_on:`, `blocks:`) are parsed if present, but never block task execution or cause schema rejections. Task breakdowns work natively through checkboxes.
7. **No Automatic OKF Formatter / Serializer**:
   - Dirban does **not** provide an OKF formatter or rewrite markdown files to impose an OKF schema.
   - Files are treated as user-owned documents: task moves are strictly file renames (`fs.rename`), preserving existing comments, whitespace, and formatting intact without rewriting the document body.

---

## 6. Core CLI & TUI Capabilities

1. **`dirban init`**:
   - Interactive wizard: prompts for task directory, column preset, and ID strategy.
   - Creates directory structure on disk and generates `dirban.json`.
2. **`dirban board`**:
   - Interactive TUI or static CLI table.
   - Shows active columns with card cards sorted by priority (`p0` $\rightarrow$ `p3`), then filename/ID.
   - Backlog and Archive columns are accessible or toggleable without crowding active WIP.
3. **`dirban move <id|slug> <target-column>`**:
   - Atomically renames/moves file on disk (`fs.rename`).
   - Supports fuzzy matching on task slug or numeric ID.
4. **`dirban check <id|slug> <index>`**:
   - Toggles the $N$-th checklist item directly from the CLI.
5. **`dirban view <id|slug>`**:
   - Displays task card, summary, checklist progress, and opens directly in `$EDITOR` or VS Code.
6. **`dirban archive [<id|slug>|all]`**:
   - Moves completed tasks from done column into archive structure.

---

## 7. Roadmap

- **Phase 1 (CLI & Engine Refactor)**:
  - Add `dirban init` command with interactive prompts and `--yes` flag.
  - Simplify parser to handle pure Markdown without requiring OKF frontmatter.
  - Support fuzzy task identification (slug, prefix, or optional numeric ID).
  - Update configuration to support `backlog`, `flow`, and `archive`.
- **Phase 2 (VS Code Extension)**:
  - Custom TreeView & Webview Kanban board inside VS Code.
  - Drag-and-drop between columns synced directly with filesystem moves.
  - Native file watching (`vscode.workspace.createFileSystemWatcher`).
- **Phase 3 (Git Analytics & Ecosystem)**:
  - Reconstruct cycle time and lead time via `git log --follow`.
  - Auto-generate changelogs from archived task diffs.
  - **Cloud Off-Ramp / Export** (`dirban export`): Low-priority export command (Jira CSV, Linear CSV/JSON) for growing teams graduating to cloud project management.
