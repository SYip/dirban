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
    - "docs/decisions/2026-11-09-acceptance-criteria-over-prescriptive-specs.md"
---

# Why Dirban: Comparative Positioning & Philosophy

## 1. The Core Problem: The Speed Mismatch

Traditional task management platforms (Linear, Jira) were designed around human sprint estimation rituals: multi-week sprints, quarterly roadmaps, and ticket lifecycles measured in **weeks to months**.

Modern software development with AI coding agents (Cursor, Claude Code, Antigravity, Copilot) runs on a completely different timescale:

- **Agent iterations take 5 to 30 minutes.** You define concise acceptance criteria, launch an autonomous agent, and return to review code diffs and test vectors.
- **Cheap experiments replace upfront spec guesswork.** Historically, getting the spec right upfront was mandatory because development was expensive. Small teams rarely had the bandwidth for speculative prototypes. With AI agents collapsing implementation costs, small teams can test alternative architectures in minutes rather than debating them in endless meetings.
- **The context-switching tax of browser tools.** Hopping out of your editor into a browser, authenticating, finding the ticket, managing MCP server credentials, and resolving webhook delays creates severe impedance mismatch when iteration loops take minutes.

Solo builders and small teams ($\le 5$) collaborating with AI agents face three bad choices:
1. **Cloud tools** introduce network latency, API rate limits, and authentication walls that agents cannot traverse without complex MCP servers and custom skills.
2. **Monolithic Markdown tools** force all tasks into a single file, creating frequent Git merge conflicts and polluting agent context windows.
3. **Raw filesystem directories** lack Kanban visualization, priority-based sorting, and checklist progress indicators.

---

## 2. Comparison Matrix

| Dimension | Cloud Tools (Linear, Jira) | Monolithic File (Obsidian Kanban, Taskell) | Raw Filesystem (`mkdir`, `mv`, `ls`) | **Dirban (`dirban`)** |
| :--- | :--- | :--- | :--- | :--- |
| **Data Storage** | Proprietary cloud database | Single monolithic text file | Standard directory tree | **Standard directory tree** |
| **Offline First** | Poor / Read-only cache | Yes | Yes | **Yes (100% offline)** |
| **Git Conflict Risk** | None (centralized cloud sync) | **Severe**: Any edits to any tasks touch the exact same file | File-level (isolated per task) | **File-level**: Isolated per task; edits never collide in Git |
| **Agent Ergonomics** | Requires MCP servers, auth tokens, and network access | Consumes entire board tokens | Raw bash commands only | **Native file operations (`cat`, `ls`, `mv`) + CLI** |
| **Visual Board View** | Web / Desktop app | Editor plugin or TUI | None (vertical file tree) | **Interactive TUI + VS Code Extension** |
| **Priority & Sorting** | Heavy SQL/JQL queries | Manual drag rank | Filename or OS mod time (`a-z`) | **Essential tiers (`p0`–`p3`) + deterministic recency** |
| **Search & Discovery**| Cloud search indexes | Text search in single file | `grep` / `find` (unstructured) | **Domain-aware**: Fuzzy title, tag filter, checklist state |
| **Checklist Badges** | Sub-issues | In-file checkboxes | None (must `cat` & inspect) | **Badges (`[2/5]`) on cards & board** |
| **Vendor Lock-In** | **High**: Proprietary database, export hassles | Medium: Tied to specific plugin syntax | Zero | **Zero**: Standard OS folders & plain `.md` files |
| **Setup & Overhead** | Signup, organization setup, webhooks | Plugin or app installation | Zero | **Zero-config or fast `dirban init`** |
| **Optimal Team Size**| 10 – 10,000+ people | 1 person | 1 person | **1 – 5 people + AI Agents** |

---

## 3. Why Directory-as-State?

In Kanban boards, tasks are always grouped by stage. If status is tracked via an in-file variable (e.g. `status: in-progress` in YAML frontmatter), rendering the board requires opening, parsing, and closing every Markdown file on disk on every refresh.

Using physical directories as workflow stages is the native filesystem solution:

1. **$O(1)$ Queries vs. $O(N)$ Parsing**: To check active work-in-progress, you run `ls tasks/02-doing/`. No files need to be opened or parsed.
2. **Zero State Drift (Directory Always Wins)**: A file cannot physically reside in two directories at once. In-file status variables easily desynchronize with folder paths. In Dirban, **the physical directory always wins**, and in-file status fields are completely unnecessary.
3. **Clean Git Diffs**: Moving a task card across columns is a pure path rename (`fs.rename` or `git mv`). The file body remains untouched, ensuring zero line-level churn and no merge conflicts.
4. **Side-by-Side File Explorer Mental Model**: Even without Dirban installed, you can open three folder columns in Finder or VS Code (`todo/`, `doing/`, `done/`) and drag files between them. The filesystem *is* the Kanban board.

---

## 4. The Core Trade-Off: What You Give Up & What You Gain

Adopting Dirban involves a conscious architectural choice:

### What You Give Up: Centralized Real-Time State Across Branches
- In a cloud database (Linear, Jira), moving a ticket updates a remote database instantly for all users regardless of what Git branch they are on.
- In Dirban, **the task status branches with your code**:
  - Moving a task to `02-doing` on a task branch (`task/26-001`) means developers on `main` still see that task in `01-todo` until your branch integrates.
  - If two developers move the *exact same* task file into different directories on separate branches, merging triggers a Git `rename/rename` conflict.

### What You Gain in Exchange
- **Zero-Overhead Agent Ergonomics**: AI agents ingest only the active task file (`dirban current`), with zero token waste, no MCP servers, and no API rate limits.
- **Time-Travel Synchronization**: Task state is committed alongside the code. Checking out Git commit `v1.2.0` restores the exact board state as it existed at that release.
- **Permanent "File Over App" Longevity**: If Dirban is uninstalled or completely abandoned in 10 years, your task board remains 100% readable and editable with standard terminal commands (`mv`, `ls`, `cat`) and any text editor.
- **Unified Trunk Velocity**: Task lifecycle automation ties directly to Git (`dirban start` provisions a branch/worktree, `dirban done` merges and cleans up).

### When to Graduate to Cloud Tools
Dirban is built for execution velocity for solo builders and micro-teams ($\le 5$). When a project takes off and the team grows beyond 10+ people with dedicated project managers and cross-department workflows, teams *should* transition to Linear or Jira for enterprise access controls and sprint governance. Because Dirban tasks are standard Markdown files, importing them into any cloud system takes minutes.
