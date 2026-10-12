---
okf_version: "1.0"
id: "okf.dirban.concept.why-dirban"
title: "Why Dirban: Comparative Positioning & Philosophy"
type: "concept"
status: "accepted"
owner: "developer"
last_updated: "2026-10-12"
tags:
  - concept
  - comparison
  - architecture
  - kanban
  - productivity
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "spec.md"
    - "docs/decisions/2026-10-12-plain-markdown-and-git-audit.md"
---

# Why Dirban: Comparative Positioning & Philosophy

## 1. Context & Motivation

Developers building software individually or in small teams ($\le 5$ people), especially when collaborating closely with AI coding agents (Claude Code, Cursor, Antigravity, Copilot), face an awkward dilemma in task management:

1. **Cloud tools** introduce network latency, proprietary sync servers, API rate limits, and authentication walls that AI agents cannot traverse natively—requiring dedicated MCP servers, specialized agent skills, and external API credentials just to read or update a ticket.
2. **Monolithic Markdown tools** force all tasks into a single file, creating frequent Git merge conflicts even when editing completely unrelated tasks, while heavily polluting token context windows.
3. **Raw filesystem directories** lack Kanban mechanics, visual state transitions, priority-based sorting, and checklist progress indicators.

**Dirban** (`dirban`) exists at the exact intersection of these three extremes.

---

## 2. Comparison Matrix

| Feature / Dimension | Cloud Task Managers (Linear, Jira) | Monolithic File Tools (Obsidian Kanban, Taskell, Todo.txt) | Raw File System (`mkdir`, `mv`, `ls`) | **Dirban (`dirban`)** |
| :--- | :--- | :--- | :--- | :--- |
| **Data Storage** | Proprietary Cloud Database | Single monolithic text file | Standard directory tree | **Standard directory tree** |
| **Offline First** | Poor / Read-only cache | Yes | Yes | **Yes (100% offline)** |
| **Git Conflict Profile** | None (centralized cloud sync) | **Severe**: Any edits to any tasks touch the exact same file | File-level (isolated per task, but rename conflicts on concurrent branches) | **File-level**: Isolated per task; eliminates cross-task conflicts, but concurrent moves still trigger Git rename conflicts |
| **AI Agent Ergonomics** | Requires MCP servers / Skills / Auth tokens | Consumes entire board tokens | Raw bash commands only | **Zero-config: native file ops (`ls`, `mv`, `cat`) + CLI** |
| **Visual Board View** | Rich Web/Desktop app | Plugin or TUI | **None** (vertical file tree) | **Interactive TUI + VS Code Extension** |
| **Sorting Dimensions** | Multi-attribute, custom formulas, arbitrary DB fields | Manual drag rank | Filename or OS mod time only (`a-z`) | **Essential Task Dimensions**: Priority (`p0`–`p3`), Date (`created`/`updated`), ID/Ticket number |
| **Search & Filtering** | Heavy SQL/JQL queries, full-text indexes across cloud | Text search in single file | `grep` / `find` (unstructured regex over raw text) | **Task-Aware Search**: Fuzzy match on title/slug, tag filtering, ID lookup, full-body search |
| **Checklist Tracking** | Custom sub-issues | Checklist parsing | **None** (must `cat` & inspect) | **Badges (`[2/5]`) on cards & board** |
| **Vendor Lock-In** | **High**: Proprietary database, export hassles, data loss on cancellation | Medium: Tied to specific app plugins/syntax | **Zero**: Plain OS filesystem | **Zero**: Standard OS folders & raw `.md` files; survives without Dirban |
| **Setup & Overhead** | Heavy signup & config | App/vault installation | Zero | **Zero-config or fast `dirban init`** |
| **Optimal Team Size** | 10 – 10,000+ people | 1 person | 1 person | **1 – 5 people + AI Agents** |

---

## 3. Why Not Just Cloud Tools (Linear, Jira)?

- **Agent Friction (Requires MCP Servers & Skills)**: Cloud task managers cannot be read or edited by AI agents out-of-the-box. They require setting up and maintaining dedicated **MCP (Model Context Protocol) servers**, authoring custom **agent skills**, provisioning OAuth credentials/API tokens, and managing external network permissions. If the network or MCP connection drops, agent execution stalls.
- **Laser-Focused Agent Context**: Because each task is an isolated Markdown file, an AI agent only loads the single task it is assigned to. It isn't distracted by hundreds of unrelated issues, doesn't waste precious context window tokens on whole-board JSON dumps, and focuses purely on executing the checklist items in front of it.
- **Zero Lock-In & Total Longevity**: Cloud tools tie your project's roadmap and historical context to someone else's servers and pricing model. If the service shuts down, changes pricing, or your subscription lapses, your task history is locked away. With Dirban, **your data is simply folders and Markdown files**. If Dirban is completely abandoned or never maintained again in 10 years, **your tasks, directories, notes, and Git history remain 100% accessible, intact, and editable** with standard Unix tools and basic text editors.
- **Context Bleed**: Ticket discussions, attachments, and remote history live separate from the Git repository. When checking out an older Git commit, ticket history does not travel backward in time with the codebase.
- **Over-Engineered Governance for Early Stages**: Roles, permissions, approval gates, and complex status workflows create unnecessary drag for solo developers and micro-teams whose primary objective is execution velocity.
- **Graduating to Cloud Tools is Celebrated**: Dirban is not anti-cloud; it is pro-velocity for early-stage builders. When your project succeeds, takes off, and your team grows beyond 5–10 people, you *should* transition to Linear or Jira for enterprise access controls, sprint estimations, and cross-department collaboration. Because Dirban tasks are standard Markdown files, migrating them into any cloud system is trivial. Dirban is built to get you to that milestone as fast as possible.

---

## 4. Why Not Monolithic Markdown Boards (Obsidian Kanban, Taskell)?

- **Whole-Board Churn vs. Task-Level Isolation**:
  When an entire Kanban board is stored in a single `kanban.md` or `tasks.txt` file, moving or editing *any* card rewrites the common file. If Developer A checks off a subtask on Task 1 while Developer B creates Task 2, Git flags a merge conflict. By storing each task in its own file, Dirban prevents edits on different tasks from colliding.
- **The Reality of Git Conflicts in Dirban**:
  Dirban **does not completely solve Git merge conflicts**. While it prevents unrelated tasks from conflicting, concurrent branches that touch or move the *same* task file across column folders will still trigger Git `rename/modify` or `rename/rename` conflicts. This is precisely why Dirban is intended for **solo developers and small teams ($\le 5$)** who can coordinate task ownership rather than large distributed teams.
- **Agent Token Waste**:
  To inspect or modify a single task in a monolithic file, an LLM agent must ingest and rewrite the entire board file, wasting context tokens and increasing hallucination risks. In Dirban, agents only read and touch the single relevant `.md` file.

---

## 5. Why Not Just the Raw File System?

A common question is: *“If columns are folders and tasks are markdown files, why do I need a CLI tool or extension at all? Why not just use `mv` and Finder/VS Code Explorer?”*

Using the raw filesystem alone falls short in four critical ways:

### 1. One Priority System Instead of Arbitrary Rank
Not having drag-and-drop manual ranking is an intentional trade-off: in Git and flat files, manual rank causes cascading file renames or fragile integer edits that trigger merge conflicts.
> **Dirban's Difference**: Replaces arbitrary ranking with **one clear priority system** (`p0` $\rightarrow$ `p3`). If a task must be done first, bump its priority. Everyone understands the order, files remain static, and diffs stay clean. Within the same priority, cards sort deterministically by date or ID.

### 2. Task-Aware Search & Discovery vs. Unstructured Grep
- **Raw File Explorer / Shell**: Finding a task requires `find`, `grep -rn`, or IDE global search. These tools return unparsed file lines with no distinction between a task's title, a completed checkbox, or body discussion.
- **Cloud Tools**: Rely on proprietary search APIs (JQL / Linear filters) that break offline.
- > **Dirban's Difference**: Provides **domain-aware search** directly in the CLI and VS Code extension:
  - **Fuzzy slug/title match**: Instant lookup without memorizing exact IDs (`dirban move auth done`).
  - **Tag filtering**: Query cards by domain tag (e.g., `--tag=backend`).
  - **Checklist state search**: Filter tasks that still have unchecked criteria.

### 3. Horizontal Kanban Matrix vs. Vertical Tree View
A file explorer displays directories as vertical trees. Visualizing work-in-progress (WIP) requires scrolling through nested folders, with no horizontal visual pipeline of what is `ready`, `doing`, and `done`.
> **Dirban's Difference**: Projects folders horizontally as Kanban columns in terminal TUI and VS Code Webview with hotkey-based card movement.

### 4. Hidden Progress & Subtasks
In a file explorer, you cannot see the status of work inside a file without opening it.
> **Dirban's Difference**: Automatically parses Markdown `- [ ]` checkboxes and displays real-time progress badges (e.g. `[3/4] 75%`) directly on the card header.

### 5. Backlog & Archive Bloat
Over months of work, `backlog/` and `archive/` accumulate hundreds of files. Opening those folders in a standard file explorer creates huge scrolling lag and visual clutter.
> **Dirban's Difference**: Treats `backlog` and `archive` as collapsible, search-indexed storage tiers separate from the active WIP flow (`ready` $\rightarrow$ `doing` $\rightarrow$ `done`).

---

## 6. The Dirban Sweet Spot

```text
               High Governance & Heavy DB
                     [Linear / Jira]
                           ▲
                           │
       [Obsidian Kanban]   │   [DIRBAN] ◄── Optimal Sweet Spot:
     Single-file merge     │                - Zero database, Git-native
       conflict risk       │                - Physical directory isolation
                           │                - Priority sorting & visual board
                           │                - 1-5 developers + AI agents
                           ▼
                 Raw File Explorer / Bash
                  [mkdir, mv, cat]
              No priority sort, no board view
```

Dirban strikes the ideal balance:
- **As simple as the filesystem** (files can always be opened, moved, or deleted using standard Unix commands).
- **As functional as a modern Kanban board** (priority ranking, checklist synthesis, TUI/IDE visual board, and Git-native history).
