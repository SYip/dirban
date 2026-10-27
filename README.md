# Dirban (`dirban`)

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

Dirban was created to solve real bottlenecks in an agent-first software engineering workflow.

When juggling multiple projects with autonomous AI coding agents (Claude Code, Cursor, Antigravity, Copilot), context-switching kills momentum. Having to tab out to a browser-based project manager completely shatters the continuous flow state. Tasks need to be **pinned directly inside the editor** as plain files alongside the code, making it instant to refocus, switch workspaces, or review what an agent is doing.

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

## Directory Layout

A Dirban board is organized inside your repository (by default under `docs/tasks/` or `tasks/`):

```text
docs/tasks/
├── backlog/             # Ideas, staging, and future enhancements
├── 01-todo/             # Prioritized work ready to be picked up
├── 02-doing/            # Actively executing tasks (humans or AI agents)
├── 03-done/             # Completed tasks awaiting archival
└── archive/             # Partitioned terminal storage (e.g., archive/2026/)
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

### For Users (Zero Dependencies)

Once compiled into a standalone binary (prebuilt binaries via GitHub Releases coming soon), **no Bun or Node runtime is required to run `dirban`**:

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

Dirban works out-of-the-box with zero configuration, but you can customize root directories and column definitions:

```json
{
  "tasksDir": "docs/tasks",
  "columns": [
    "backlog",
    "01-todo",
    "02-doing",
    "03-done"
  ],
  "priorities": [
    "p0",
    "p1",
    "p2",
    "p3"
  ],
  "defaultPriority": "p2",
  "archiveDir": "docs/tasks/archive"
}
```

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
