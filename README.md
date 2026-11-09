# Dirban

> **Zero-database, agent-native Kanban engine & TUI backed by the filesystem and flexible Markdown.**

> [!WARNING]
> **Early Stage / Proof of Concept**: Dirban is currently an exploratory proof of concept (PoC) rather than a finished product. It is under active design exploration—APIs, CLI flags, configuration schemas, and internal behaviors are subject to frequent breaking changes.

---

## What is Dirban?

**Dirban** is a lightweight, Git-native task management engine designed specifically for **solo developers, small teams ($\le 5$), and AI coding agents** (Cursor, Claude Code, Antigravity, Copilot).

Instead of relying on cloud databases, proprietary sync servers, or monolithic board files, Dirban operates on a simple principle: **The physical directory *is* the task state.**

- **Physical Columns as Subdirectories**: Workflow stages are plain folders on disk (e.g. `01-ready/`, `02-in-progress/`, `03-done/`). Moving a task means moving a file (`mv`).
- **Markdown-First (with Google OKF Support)**: Every task is an isolated `.md` file. Dirban supports [Google Open Knowledge Format (OKF)](docs/concepts/why-dirban.md) frontmatter for metadata, but **never enforces it**. Standard Markdown files and headings work out of the box.
- **Zero-Cloud, 100% Offline**: Merge, branch, review, and diff tasks with standard Git commands. Git provides your immutable audit trail.
- **Agent-Native Ergonomics**: AI agents don't need custom MCP servers, API keys, or large JSON payloads. They read, update, and move tasks using standard shell commands (`ls`, `cat`, `mv`).
- **Zero Lock-In & Total Longevity**: Even without Dirban installed, your task board is just plain folders and Markdown files readable in any file explorer or editor.

👉 For detailed architectural positioning and comparisons against Linear, Jira, Obsidian Kanban, and raw bash scripts, read **[Why Dirban: Comparative Positioning & Philosophy](docs/concepts/why-dirban.md)** and the technical **[Architecture Decisions](docs/decisions/2026-10-12-plain-markdown-and-git-audit.md)**.

> **"Do I really need a tool to move files?"**  
> You're completely right—you don't! The entire design of Dirban is to make task management as native as possible. Use `mv`, use Finder, use whatever you like. Dirban is just an optional visual lens when you want a Kanban board, priority sorting, and checklist badges—not a gatekeeper.

---

## Origin & The Agent-First Workflow

Dirban was created to solve real bottlenecks in modern agent-first software engineering workflows:

- **The Evolution from SpecKit to Code-as-Spec**:  
  Dirban builds on ideas similar to in-repo spec workflows like SpecKit, which kept implementation details close to the code. However, as LLM models have become increasingly capable, **generating exhaustive specifications prior to implementation is no longer necessary**:
  1. *Generated specs are too long*: AI-generated design specs often become walls of prose that are tedious and inefficient for human developers to review.
  2. *Code and test cases are the clearest specification*: Natural language is prone to ambiguity. Concrete code and test vectors are far clearer—it is faster and more precise to implement directly or write a test case to verify that actual execution matches expectation.
- **Good Software is Iterated, Not Built in One Shot**:  
  AI agents are powerful, but when building novel software or refining unconfirmed requirements, one-shot code generation doesn't cut it. Progress happens in rapid iterations.
- **The 5-to-30 Minute Autonomous Loop**:  
  You set concise requirements and testable acceptance criteria up front, let the agent execute autonomously for 5 to 30 minutes, and return only to review diffs and guide the next iteration.
- **Cross-Project Juggling (e.g., with `herdr`)**:  
  While agents work, you switch between multiple concurrent projects. But switching projects introduces severe context-switching fatigue.
- **No Browser Tab Switching**:  
  With traditional tools (Linear, Jira), checking project state requires alt-tabbing to a browser, navigating through workspaces, and hunting down the active issue. In Dirban, the project state lives right in the repository: your terminal and IDE tell you directly what you were focusing on (`dirban current`, `tasks/02-doing/`, or the editor status bar) the moment you open the directory.

In this workflow, the goal is for agents to:

1. **Evaluate & Prioritize**: Analyze proposed features—evaluating whether they genuinely improve the project or introduce unnecessary overhead.
2. **Specify & Decompose**: Draft clear, testable specifications and break them down into self-contained, verifiable tasks (`- [ ]`).
3. **Execute & Iterate**: Pick up individual task files, implement the code, verify criteria, and update specs as discoveries happen.
4. **Preserve Context & Rationale**: Answer *why* a feature was built, why a decision was made, or trace how a bug was introduced using plain Git history and task files.

Traditional tools break down here:
- **Browser-based tools (Linear, Jira)**: Require constant context switching, external credentials, and webhooks that agents cannot access natively without complex tooling.
- **Single-file boards**: Dump the entire project roadmap into one file, drowning the agent in irrelevant tokens and causing constant Git merge collisions.

By treating **directories as columns** and **isolated Markdown files as tasks**, tasks stay pinned right in your IDE. An agent only loads the single task it is executing—staying laser-focused without whole-board token bloat.

---

## Key Features

- **Interactive Terminal UI (TUI) & Static CLI**: Browse columns, filter tags, and inspect task details in a visual terminal board or scriptable stdout output.
- **Priority & Checklist Badging**: Automatically extracts priorities (`p0`–`p3`) and parses Markdown checklist progress (`- [ ]`) into visual badges (`[2/5]`).
- **Laser-Focused AI Context**: AI agents only ingest the specific task file they are executing, preventing whole-board token bloat and context distraction.
- **Conflict Isolation**: Because each task is a distinct file, editing different tasks never causes Git merge conflicts.
- **Shared Engine for IDEs**: Built with TypeScript to enable 100% code reuse between the CLI/TUI and the upcoming VS Code extension.

---

## Intent-Driven Workflow Guide

Dirban maps directly to how humans and AI coding agents execute work through a clean, single-verb lifecycle across three phases:

```mermaid
flowchart LR
    Idea(["Idea / Requirement"]) -->|dirban new| Backlog[("backlog/")]
    Backlog -->|dirban ready| Todo["01-todo/"]
    Todo -->|dirban start| Doing["02-doing/"]
    Doing -->|dirban done| Done["03-done/"]
    Done -->|dirban archive| Archive[("archive/")]

    classDef dir fill:#1e1e1e,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef term fill:#0f172a,stroke:#64748b,stroke-width:1px,stroke-dasharray: 5 5,color:#cbd5e1;
    class Backlog,Todo,Doing,Done,Archive dir;
    class Idea term;
```

| Workflow Phase | Question Being Answered | Command | Description |
| :--- | :--- | :--- | :--- |
| **Phase 1: Planning** | *"What unblocked tasks can we schedule?"* | `dirban plan` | Shows ready vs blocked backlog tasks |
| | *"What is holding up blocked work?"* | `dirban plan --blocked` | Inspects missing dependencies / blocker reasons |
| | *"What unblocked tasks are ready to queue?"* | `dirban plan --unblocked` | Lists only backlog tasks with all dependencies satisfied |
| | *"How do I schedule tasks for execution?"* | `dirban ready <id...>` | Moves ready tasks from backlog into `01-todo` |
| **Phase 2: Action** | *"What should I focus on next?"* | `dirban next` | Recommends highest-priority task from `01-todo` |
| | *"How do I start working on it?"* | `dirban start <id>` | Moves to `02-doing` & creates branch/worktree |
| | *"What am I currently doing?"* | `dirban current` | Inspects active task, progress & criteria checklist |
| | *"How do I complete my task?"* | `dirban done` | Moves to `03-done`, auto-merges & cleans branch |
| **Phase 3: Review** | *"Where do things stand overall?"* | `dirban board` | Interactive TUI or `--static` board overview |
| | *"What are the full details of a task?"* | `dirban view <id>` | Inspects task metadata, links & acceptance criteria |
| | *"What work has already been completed?"* | `dirban archive` | Archives completed cards into `archive/` |

---

## Directory Layout

A Dirban board is organized inside your repository (by default under `docs/tasks/` or `tasks/`):

```text
docs/tasks/
├── backlog/             # Ideas, staging, and future enhancements
├── 01-todo/             # Prioritized work ready to be picked up
├── 02-doing/            # Actively executing tasks (humans or AI agents)
├── 03-done/             # Completed tasks awaiting archival
└── archive/             # Terminal completed storage (archive/)
```

### Example Task (`docs/tasks/01-todo/26-001-add-search.md`)

```markdown
---
id: "26-001"
title: "Implement fuzzy search across board"
priority: "p1"
tags: ["cli", "ux"]
owner: "developer"
---

# Implement fuzzy search across board

Need fast title and tag filtering in the interactive TUI.

## Acceptance Criteria
- [x] Add fuzzy search utility
- [x] Bind `/` key in TUI
- [ ] Add unit test vector
```

---

## Quick Start

### Standalone Binary (Git Recommended)

The compiled binary is self-contained (no Node or Bun required). While Dirban works on a plain filesystem, it works best with Git for branch and worktree automation.

```bash
# Move the compiled binary to your PATH
chmod +x dirban
sudo mv dirban /usr/local/bin/

# Now run anywhere:
dirban board
```

#### Common Commands
```bash
# Initialize board directory structure (backlog, 01-todo, 02-doing, 03-done, archive)
dirban init

# Get the next sequential task ID
dirban next-id

# Create a new task with auto-assigned ID
dirban new "Implement search filter"
dirban new "Fix critical bug" --priority=p0 --column=01-todo

# Launch interactive Kanban TUI
dirban board

# Move a task to another column (or just use standard `mv`)
dirban move 26-001 02-doing

# Check off an acceptance criteria item
dirban check 26-001 1

# Output static board to stdout (useful for scripts & CI)
dirban board --static
```

---

### For Developers (From Source)

#### Prerequisites
- [Bun](https://bun.sh) (v1.2+)

#### Setup & Build

```bash
# Clone the repository
git clone https://github.com/<owner>/dirban.git
cd dirban

# Install dependencies
bun install

# Link globally for local development
bun link

# OR compile into a standalone native binary (`./dirban`)
bun run build
```

---

## Configuration (`.dirban.json`)

Dirban works out-of-the-box with zero configuration, but workflows and column stages are completely customizable:

### Default Workflow (`01-todo` $\rightarrow$ `02-doing` $\rightarrow$ `03-done`)
```json
{
  "tasksDir": "docs/tasks",
  "columns": ["01-todo", "02-doing", "03-done"],
  "focusColumn": "02-doing",
  "priorities": ["p0", "p1", "p2", "p3"],
  "defaultPriority": "p2",
  "archiveDir": "docs/tasks/archive"
}
```

### Custom Workflow Examples

#### 1. Custom Semantic Priorities (`01-todo` $\rightarrow$ `02-doing` $\rightarrow$ `03-done`)
```json
{
  "tasksDir": "docs/tasks",
  "columns": ["01-todo", "02-doing", "03-done"],
  "focusColumn": "02-doing",
  "priorities": ["urgent", "high", "normal", "low"],
  "defaultPriority": "normal"
}
```

#### 2. Unprefixed Minimalist (`todo` $\rightarrow$ `doing` $\rightarrow$ `done`)
```json
{
  "tasksDir": "docs/tasks",
  "columns": ["todo", "doing", "done"],
  "focusColumn": "doing"
}
```

#### 2. Enterprise Delivery (`ready` $\rightarrow$ `develop` $\rightarrow$ `test` $\rightarrow$ `uat` $\rightarrow$ `production`)
```json
{
  "columns": ["ready", "develop", "test", "uat", "production"],
  "focusColumn": "develop"
}
```
* `dirban start <id>` moves cards into `develop` (`focusColumn`).
* `dirban current` tracks active work in `develop`.
* `dirban done` advances completed work to `focus + 1` (`test`).

#### 3. Direct Intake (`backlog` $\rightarrow$ `archive`)
```json
{
  "columns": []
}
```
* When `columns` is empty, there are no intermediate staging columns; `dirban done` moves completed tasks directly into `archive/`.

---

## Development & Testing

Dirban enforces strict TypeScript typing, purely functional domain operations, and vector-based test suites using the native Bun test runner:

```bash
# Run tests
bun test

# Typecheck
bun run typecheck

# Compile standalone native binary (`./dirban`)
bun run build
```

---

## Documentation

- **[CLI & Developer Reference](docs/cli-reference.md)**: Full command manual, TUI keyboard shortcuts, flags, and contributor CLI workflows.
- **[Why Dirban: Comparative Positioning & Philosophy](docs/concepts/why-dirban.md)**: Why Dirban exists, comparison matrix (Linear, Jira, Obsidian Kanban, Bash), and design trade-offs.
- **[Full Technical Specification](spec.md)**: Engine invariants, state transition rules, directory conventions, and OKF schema integration.
- **[Architecture Decision Records](docs/decisions/2026-10-12-plain-markdown-and-git-audit.md)**: Architectural decisions on Markdown-first schemas, Git-driven auditing, and folder-based state.

---

## License

[MIT](LICENSE)
