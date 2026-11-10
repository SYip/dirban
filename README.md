# Dirban

> **Zero-database, Git-native Kanban board for developers, knowledge workers, and AI agents.**

[![CI](https://github.com/andrew/dirban/actions/workflows/ci.yml/badge.svg)](https://github.com/andrew/dirban/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is Dirban?

Dirban tracks task state using plain directories and Markdown files. It is designed for **solo builders, knowledge workers, and AI agents** (Cursor, Claude Code, Antigravity, Obsidian).

**The physical directory is the task state.** Moving a task between stages is just moving a file (`mv`).

- **Directories as Columns**: Workflow stages are plain folders (`01-todo/`, `02-doing/`, `03-done/`).
- **Isolated Task Files**: Each task is a self-contained Markdown file with an optional priority and checklist (`- [ ]`). Editing one task never collides with another in Git or file sync.
- **Agent-Ready & Context-Efficient**: AI tools and scripts read only the active task file (`dirban current`), keeping token usage low and focus sharp.
- **100% Local & Future-Proof**: Works anywhere files live—Git repositories, Obsidian vaults, Dropbox, or local drives. If you stop using Dirban, your tasks remain standard Markdown files readable in any text editor.

---

## Quick Start (60 Seconds)

### 1. Install & Initialize

#### Option A: Build & Install Locally with Bun
```bash
# Clone and install dependencies
git clone https://github.com/andrew/dirban.git
cd dirban && bun install

# Link globally for immediate use
bun link

# Or compile into a standalone binary in ~/.local/bin
bun run install:local
```

#### Option B: Standalone Binary (No Bun/Node Required)
```bash
# Download the latest binary from GitHub Releases:
curl -fsSL https://github.com/andrew/dirban/releases/latest/download/dirban-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m) -o ~/.local/bin/dirban
chmod +x ~/.local/bin/dirban
```

#### Initialize a Board
```bash
# Run inside any repository, vault, or folder:
dirban init
```

This creates a lightweight task hierarchy under `docs/tasks/`:
```text
docs/tasks/
├── backlog/       # Staging and future ideas
├── 01-todo/       # Ready to be picked up
├── 02-doing/      # Actively executing tasks (human or AI agent)
├── 03-done/       # Completed tasks
└── archive/       # Historical archive
```

---

### 2. The Core Execution Loop

```bash
# Create a new task with auto-assigned sequential ID
dirban new "Implement search filtering" --priority=p1

# Pick up and start work (moves to 02-doing/ & creates Git branch)
dirban start 26-001

# Inspect active task, branch alignment, and criteria checklist
dirban current

# Complete task (moves to 03-done/ and squashes branch)
dirban done
```

---

## Interfaces: Terminal & Editor

Dirban provides visual, interactive interfaces while preserving plain filesystem simplicity:

### 1. Interactive Terminal UI (TUI)
```bash
# Launch interactive terminal Kanban board
dirban board

# Or print static board to stdout (ideal for CI, scripts, and piping)
dirban board --static
```

### 2. VS Code Extension (`dirban-vscode`)
- **Focus View**: Pinned sidebar panel showing the currently active task, branch alignment, and interactive checklist.
- **Status Bar Indicator**: Real-time status badge (`$(checklist) 26-001 [2/5]`) linking directly to the active task.
- **Embedded Webview Kanban Board**: Visual drag-and-drop Kanban board running natively inside an editor tab.

---

## The Core Workflow: Questions & Answers

Dirban maps directly to the questions developers and AI agents ask when executing work:

| Question You're Asking | Command | What Dirban Does |
| :--- | :--- | :--- |
| **"Where do things stand overall?"** | `dirban board` | Opens the interactive Kanban TUI (or `--static` for stdout) |
| **"How do I queue up work from the backlog?"** | `dirban ready <id>` | Moves unblocked tasks from `backlog/` into `01-todo/` |
| **"What should I focus on next?"** | `dirban next` | Recommends the highest-priority unblocked task in `01-todo/` |
| **"How do I begin working on it?"** | `dirban start <id>` | Moves task to `02-doing/` and creates a matching Git branch or worktree |
| **"What am I currently doing?"** | `dirban current` | Displays the active task, branch alignment, and criteria checklist |
| **"How do I complete my task?"** | `dirban done` | Moves to `03-done/`, squashes/merges the branch, and cleans up |

> **Want to know what happens under the hood?**  
> Every command maps to simple POSIX filesystem commands (`mv`, `ls`, `cat`) and standard Git operations. See **[Forget About Dirban: Zero Lock-In & Plain Shell Equivalents](docs/concepts/forget-about-dirban.md)** for the complete command-by-command mapping.

---

## Deep-Dive Documentation

- 📖 **[Why Dirban: Philosophy & Comparative Positioning](docs/concepts/why-dirban.md)**: Comparison with Linear, Jira, Obsidian Kanban, and raw bash scripts.
- ⚙️ **[Configuration Guide (`.dirban.json`)](docs/concepts/configuration.md)**: Custom columns, workflows, semantic priorities, and Git worktrees.
- 💻 **[CLI & TUI Reference Manual](docs/cli-reference.md)**: Full command reference, options, and keyboard shortcuts.
- 🌿 **[Trunk-Based Git Workflow](docs/concepts/git-workflow.md)**: Git branch automation, worktree isolation, and squash merging.
- 🐚 **[Forget About Dirban](docs/concepts/forget-about-dirban.md)**: Complete mapping of every Dirban command to raw POSIX shell (`ls`, `mv`, `cat`).

---

## License

[MIT](LICENSE)
