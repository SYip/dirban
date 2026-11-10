---
okf_version: "1.0"
id: "okf.dirban.concept.why-dirban"
title: "Why Dirban: Comparative Positioning & Philosophy"
type: "concept"
status: "accepted"
owner: "developer"
last_updated: "2026-11-10"
tags:
  - concept
  - comparison
  - architecture
  - kanban
  - productivity
  - trade-offs
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "spec.md"
    - "docs/concepts/git-workflow.md"
    - "docs/concepts/forget-about-dirban.md"
    - "docs/decisions/2026-10-12-plain-markdown-and-git-audit.md"
    - "docs/decisions/2026-11-07-omission-of-milestones.md"
    - "docs/decisions/2026-11-07-progressive-enhancement-optional-dependencies.md"
---

# Why Dirban: Comparative Positioning & Philosophy

## 1. Context & Motivation

Developers building software individually or in small teams ($\le 5$ people), especially when collaborating closely with AI coding agents (Claude Code, Cursor, Antigravity, Copilot), face an awkward dilemma in task management:

1. **Cloud tools** introduce network latency, proprietary sync servers, API rate limits, and authentication walls that AI agents cannot traverse natively—requiring dedicated MCP servers, specialized agent skills, and external API credentials just to read or update a ticket.
2. **Monolithic Markdown tools** force all tasks into a single file, creating frequent Git merge conflicts even when editing completely unrelated tasks, while heavily polluting token context windows.
3. **Raw filesystem directories** lack Kanban mechanics, visual state transitions, priority-based sorting, and checklist progress indicators.

### The Speed Mismatch: Weeks vs. Minutes

Traditional cloud task management was designed around human estimation rituals: multi-week sprints, quarterly roadmaps, and ticket lifecycles measured in **weeks to months**.

AI agent workflows run on a radically different tempo:
- **Agent iterations happen in minutes to days.**
- A developer defines acceptance criteria, dispatches an agent, and reviews the implementation 15 minutes later.
- Logging into a browser, navigating workspaces, updating cloud issue statuses, and resolving webhook delays creates severe impedance mismatch.
- A local task board that updates instantaneously on disk keeps pace with autonomous agent speed.

### The Real-World AI Agent Workflow: Iteration & Cross-Project Juggling

The catalyst for Dirban came directly from day-to-day experience running modern AI agent workflows:

- **The Evolution from SpecKit to Code-as-Spec**:  
  The core philosophy shares roots with in-repo specification workflows like SpecKit, which kept implementation details versioned inside the project. However, as LLM capabilities have progressed, **generating exhaustive upfront specification documents before implementation has become unnecessary overhead**:
  1. *Specs become too long to review*: Generated design documents and multi-page specs are often bloated. It is exhausting and inefficient for human developers to read pages of prose to hunt down subtle architectural flaws or edge cases.
  2. *Code and tests are the clearest specification*: Code is unambiguous; natural language is not. Writing the implementation or concrete test cases and checking whether the actual behavior matches expectations provides far faster, clearer, and more reliable validation than parsing prose documents.
  *(See the complete architectural decision record on [Outcome-Driven Acceptance Criteria Over Prescriptive Specifications](../decisions/2026-11-09-acceptance-criteria-over-prescriptive-specs.md).)*
- **AI is Powerful, but Good Software is Iterated, Not Built in One Shot**:  
  If the goal is merely copying established software with static requirements, an AI agent might deliver in a single prompt. But when building something genuinely new—or when product requirements are still emerging—software cannot be built all at once; it must be iterated upon.
- **The 5-to-30 Minute Autonomous Loop**:  
  Instead of massive upfront documents, you set crisp requirements and testable acceptance criteria up front, then let the agent run autonomously for 5 to 30 minutes while you step away from the code. You return only to do the final verification, review the diff, and steer the next iteration.
- **Cross-Project Juggling (e.g., using `herdr`)**:  
  Because an agent is working autonomously in that 5-to-30 minute window, staying idle on one project is inefficient. Developers naturally switch between multiple concurrent projects (especially when orchestrating multi-repo agent sessions with tools like `herdr`).
- **The Context-Switching Tax of Browser Task Managers**:  
  When you hop back to a project after a run, you need to know immediately: *"Where was I? What was in flight? What did the agent just finish or get stuck on?"*  
  With existing cloud or browser-based tools (Linear, Jira, Trello), you must break your flow: alt-tab to the browser, locate the tab, switch projects/organizations, find the active ticket, and cross-reference branch names.  
  By keeping the task tracker local to the repository in plain Markdown files, the terminal or IDE tells you directly what you were focusing on (`dirban current`, `ls tasks/02-doing/`, or editor status bar/TUI) the split-second you switch project folders.

**Dirban** (`dirban`) exists at the exact intersection of these realities.

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

## 5. Why Directory-as-State vs. In-File Status Variables (`status: doing`)?

In Kanban boards, tasks are always grouped to show as columns. If task status were tracked via in-file variables (such as YAML frontmatter `status: in-progress`), determining board status would require scanning and parsing every single Markdown file in the project.

Using physical directories as columns is the native filesystem solution:

1. **Native $O(1)$ Queries vs. $O(N)$ File Scanning**:
   Instead of loading all files every time to reconstruct board state, the filesystem structure directly and instantly answers the core questions without opening or parsing a single file:
   - *"How many tasks are we working on? What are they?"* $\rightarrow$ `ls tasks/02-doing/` (instant WIP check).
   - *"What task should I do next?"* $\rightarrow$ `ls tasks/01-ready/`.
2. **The Side-by-Side File Explorer Mental Model (True Zero Lock-in)**:
   Even without Dirban installed, you can open multiple file explorers or terminal panes side-by-side as columns (`ready/`, `doing/`, `done/`). Moving a task is an intuitive drag-and-drop or `mv` between folders. The filesystem *is* the board.
3. **Eliminates State Drift (Directory Always Wins)**:
   A file cannot physically reside in two directories simultaneously. In contrast, in-file state variables easily desynchronize with the directory location (e.g. frontmatter says `status: ready` while the file sits in `02-doing/`). In Dirban, **the directory always wins**, and in-file status variables are completely unnecessary.
4. **Clean Git Diffs & Zero In-File Churn**:
   Moving a card across columns is a pure path rename (`fs.rename` or `git mv`). The file body remains completely untouched. There is no need to open, parse, edit, and serialize YAML frontmatter, ensuring clean Git diffs with zero lines changed and avoiding merge conflicts.

---

## 6. The Core Trade-Off: Giving Up Global Stage Consistency

Adopting Dirban involves a clear, conscious architectural trade-off that every developer and team should understand:

### What You Give Up: Strong Consistency of Board Stage Across Branches

In a centralized cloud system (Linear, Jira) or a hosted server database:
- There is **one single source of truth** stored in the cloud.
- Moving a task in the UI immediately updates the remote database in the cloud, instantly reflecting on everyone else's screen regardless of their local machine state.
- Task status is decoupled from Git branches: switching local branches or working offline never alters the cloud board stage.

In Dirban:
- **The filesystem directory IS the task state**, and tasks are committed to Git.
- Git is a distributed, branchable system without real-time centralized synchronization.
- **Task status branches with your code**:
  - If you move a task to `02-doing` inside a short-lived branch `task/26-001`, someone else on `main` still sees that file in `01-todo` until your branch merges.
  - If two developers concurrently move the *exact same* task file into different directories on separate branches, merging those branches triggers a Git `rename/rename` conflict.
  - Switching between Git branches physically moves files on disk, changing what your board displays.

Dirban consciously trades away **centralized, real-time board state consistency**.

### What You Get in Exchange

In exchange for giving up centralized stage consistency, you gain superpowers that cloud databases cannot provide:

| Dimension | Centralized Cloud (Linear / Jira) | Dirban (Distributed Filesystem & Git) | What You Gain |
| :--- | :--- | :--- | :--- |
| **Agent Context & Autonomy** | Requires OAuth, MCP servers, API keys, network access, and broad JSON queries. | Plain local files (`cat`, `ls`, `mv`). Agent loads only the exact task file it executes. | **Zero-overhead agent ergonomics**: No MCP setup, zero token waste, zero network dependency. |
| **Task State & Code Synchronization** | Tasks live out of sync with code history (e.g. ticket marked "Done" in Jira months before or after PR merges). | Task state transitions are part of the Git commit history. | **Time-travel consistency**: Checking out commit `v1.2.0` restores the exact board state and tasks as they were at that release. |
| **Offline Independence** | Degrades or breaks without internet or during cloud downtime. | 100% offline; runs on plane, train, or isolated environment. | **Uninterrupted flow**: Your board never goes down, has no rate limits, and requires no login. |
| **Zero Lock-In & 10-Year Longevity** | Proprietary schema; data held hostage by SaaS pricing or service termination. | Standard OS directories and human-readable Markdown files. | **Permanent ownership**: Readable in Finder, Vim, or VS Code even if Dirban is completely uninstalled. |
| **Zero Context-Switching Tax** | Alt-tab to browser, authenticate, navigate workspaces, cross-reference tickets. | Active task is visible in terminal (`dirban current`), IDE status bar, and workspace tree. | **Frictionless focus**: Never leave the editor to know what you or an autonomous agent is working on. |
| **Workflow Coupling** | Branch creation, PR linking, and status moving happen across disconnected apps via webhooks. | Lifecycle automation is tied to Git (`dirban start` checks out branch, `dirban done` auto-merges to `main`). | **Trunk-based velocity**: Execution, review, and task tracking collapse into a single unified loop. |
| **Iteration Cadence** | Built around 1-to-2 week human sprint cycles, estimation ceremonies, and milestone planning. | Built around rapid iterations where human + AI agent cycles take hours or minutes. | **Hyper-velocity feedback**: No sprint overhead or ceremonial backlog grooms when turnaround is same-day. |

### Why This Trade-Off Fits Small Teams & Agents

This trade-off is deliberately optimized for **solo developers, micro-teams ($\le 5$), and AI coding agents**:
- **From Multi-Week Sprints to Continuous Sub-Hour Iterations**:  
  Traditional cloud platforms (Jira, Linear) were architected around the cadence of pure human development teams: 1-to-2 week sprints, backlog grooming sessions, sprint retrospectives, and multi-day code review cycles. In an agent-first paradigm, **iterations shrink from weeks into hours or even minutes**. A feature that once took a sprint cycle is decomposed into small, testable tasks and executed autonomously in 5-to-30 minute loops. Managing 15-minute iterations inside a heavy tool built for 2-week sprints creates immense bureaucratic drag.
- **No Concurrency Bloat**:  
  A small team or solo developer working with AI agents does not need multi-tenant concurrency locks, permission matrices, or centralized board synchronizers.
- **Local Speed & Trunk Integration**:  
  The rapid autonomous loop relies on fast, local, offline file access and trunk-based integration.
- When teams scale to 20+ developers with dedicated project managers and cross-team dependencies, centralized state consistency and multi-week sprint governance become more important than local speed—at which point teams can seamlessly graduate to cloud tools.

---

## 7. Why Not Just the Raw File System?

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
> **Dirban's Difference**: Treats `backlog` and `archive` as intrinsic, reserved storage tiers separate from the active Kanban WIP flow (`ready` $\rightarrow$ `doing` $\rightarrow$ `done`). `backlog/` acts as the universal GTD capture and idea staging pool, while `archive/` handles historical retention. Neither crowds the active workflow columns.

---

## 8. The Dirban Sweet Spot

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
- **Near-Zero Learning Curve**: There is practically nothing new to learn. You already know how to make a directory, write a Markdown file, and move a file.
- **Forget About Dirban**: You can completely forget the tool exists whenever you want. You can use only the features you want—there is no hidden state, secret metadata database, or magic in Dirban. If you prefer, you can manage your entire project using standard Finder, VS Code Explorer, or terminal commands (`mv`, `ls`, `cat`, `git`). Dirban is an invisible lens when you want visual powers, not a gatekeeper. (See the complete command-by-command guide: **[Forget About Dirban: Zero Lock-In & Plain Shell Equivalents](forget-about-dirban.md)**).
- **As simple as the filesystem**: Standard OS directories and plain text files.
- **As functional as a modern Kanban board**: Priority ranking, checklist synthesis, TUI/IDE visual board, and Git-native history when you want the visual superpowers.

---

## 9. Why TypeScript (and Not Go / Rust / C++)?

A natural question for a CLI tool is: *“Rust, Go, or Zig are faster and compile to single native binaries—why build Dirban in TypeScript?”*

The answer comes down to two practical realities:

### 1. 100% Code Reuse with the VS Code Extension
The primary GUI for Dirban is a first-class **VS Code Extension** (TreeViews, interactive Webview Kanban board, and native file watchers). 
* VS Code's extension host and Webview environments run strictly on JavaScript/TypeScript.
* Building the core parser, filesystem watcher, and Kanban domain logic in TypeScript enables **identical, zero-bridge code sharing** between the CLI/TUI and the VS Code extension.
* Choosing Rust or Go would require maintaining a separate TypeScript codebase for the extension or dealing with brittle WASM/FFI bindings for simple filesystem operations.

### 2. Pragmatic Scale: Projects Don't Have 100k Concurrent Tasks
* Benchmarks showing languages like Rust or C++ parsing millions of files per second are irrelevant to Dirban’s problem space.
* Dirban is designed for solo builders and small teams ($\le 5$). A real-world project board rarely has more than a few dozen active tasks and a few hundred archived notes.
* Modern JavaScript engines (V8 / JavaScriptCore via Bun) parse a few hundred Markdown files in single-digit milliseconds—orders of magnitude faster than human perception or terminal rendering.
* Sacrificing seamless IDE integration for raw sub-millisecond micro-benchmarks on 100,000 files solves a problem that small teams do not have.

---

## 10. Progressive Enhancement: Filesystem as Foundation, Git & VS Code as Accelerators

Dirban operates on a strict **tiered progressive enhancement** architecture:

1. **Tier 1 — The Filesystem is the Complete Foundation**:
   - Everything in Dirban works 100% on standard directories and `.md` files alone.
   - If Git is not installed, if you are working in an unversioned folder, or if VS Code is not open, the entire engine, CLI, and board operate without degradation.
2. **Tier 2 — Git as an Accelerator (Optional)**:
   - When Git is present, it provides an immutable event log (`git log --follow`) and enables branch-aware task focus (`dirban current`) and task isolation (`dirban worktree`).
   - If Git is absent or fails, Dirban gracefully falls back to the directory structure (`02-doing/`) without throwing errors.
3. **Tier 3 — VS Code as an Accelerator (Optional)**:
   - When developing inside VS Code, Dirban automatically reads configuration from `.vscode/settings.json` and surfaces tasks in the activity bar.
   - If `.vscode` is not present, it uses `.dirban.json` or defaults seamlessly.

*(For detailed architectural rationale, see the Architecture Decision Record on [Progressive Enhancement & Optional Dependencies](../decisions/2026-11-07-progressive-enhancement-optional-dependencies.md).)*


