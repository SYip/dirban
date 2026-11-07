---
okf_version: "1.0"
id: "okf.dirban.architecture.deferral-of-milestones"
title: "ADR: Deferral of First-Class Milestones in Favor of Continuous Kanban Flow"
type: "architecture-decision"
status: "accepted"
owner: "developer"
last_updated: "2026-11-07"
tags:
  - architecture
  - decisions
  - milestones
  - kanban
  - non-goals
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "docs/concepts/why-dirban.md"
    - "docs/decisions/2026-10-12-plain-markdown-and-git-audit.md"
---

# Architecture Decision Record: Deferral of First-Class Milestones in Favor of Continuous Kanban Flow

## 1. Context & Problem Statement

Task management systems (e.g., GitHub Issues, Jira, Linear) often introduce **Milestones** or **Sprints** to package collections of issues toward specific release dates, delivery cycles, or version tags.

As Dirban evolves to support advanced agent planning and focus views, a natural question arises:
*Should Dirban implement a first-class milestone entity, CLI command set (`dirban milestone create/close/list`), and specialized directory nesting for releases?*

---

## 2. Decision Drivers

- **Directory-as-State Philosophy**: In Dirban, file paths directly convey operational state (`ls tasks/doing/` answers what is active in $O(1)$ time without reading or parsing file content).
- **Zero Merge Conflict Churn**: Grouping mechanisms should not introduce Git rename/modify conflicts across independent cards or branches.
- **Agent Token Ergonomics**: AI agents should have a single unambiguous answer to *"What task should I execute next?"* without computing intersections of sprint boundaries, card priorities, and column states.
- **Target Audience Profile**: Dirban is built specifically for solo builders and micro-teams ($\le 5$ people) collaborating directly with AI coding agents. Execution velocity takes precedence over batch planning ceremony.
- **Zero Lock-In & Plain Markdown Survivability**: The task repository must remain 100% understandable and manageable using standard Unix tools (`find`, `grep`, `mv`, `cat`) even without the Dirban CLI.

---

## 3. Considered Options

### Option A: Hierarchical Milestone Directories (`tasks/<milestone>/<status>/`)
Structure the board into nested milestone folders (e.g. `tasks/v0.2/doing/task.md`).
- **Pros**: Maintains directory-as-state ($O(1)$ inspectability per milestone).
- **Cons**: Severe rigidity. Moving an unfinished task to the next milestone requires multi-level folder migrations (`tasks/v0.1/backlog/` $\rightarrow$ `tasks/v0.2/backlog/`). Injects directory depth and confusion for projects that do not use milestones.

### Option B: In-File Milestone Frontmatter (`milestone: "v0.2"`)
Add an explicit `milestone` key to task frontmatter and build a dedicated CLI subsystem (`dirban milestone`).
- **Pros**: Flexible; tasks stay in root column folders.
- **Cons**: Violates the $O(1)$ directory-as-state rule (requires scanning and parsing every task file on disk to determine milestone progress). Moving tasks across milestones causes line edits and Git diff churn. Introduces "sprint rollover" ceremony for incomplete tasks.

### Option C: Defer Native Milestone Entities; Leverage Git Tags, Frontmatter Tags, & Markdown Roadmaps (Selected Approach)
Do not build dedicated milestone data models or CLI state machinery for now. Treat milestones as orthogonal release documentation and Git version markers, keeping the option open to revisit as user patterns evolve.

---

## 4. Outcome & Rationale

**Dirban defers first-class Milestones / Sprint entities for the initial versions.**

### Key Reasons:

1. **Kanban Continuous Flow vs. Batch Ceremony**:
   Dirban is rooted in Kanban—a continuous pull system where tasks flow from `backlog` $\rightarrow$ `doing` $\rightarrow$ `done`. Milestone/sprint batching creates administrative drag (planning sessions, velocity calculations, rollover workflows) that conflicts with fast agentic and micro-team development.
2. **Git is the Canonical Release Boundary**:
   Git already provides native, immutable, cryptographic milestones through **Git Tags** (`git tag -a v0.2.0`). Because task states and source code live together in the same repository, checking out a Git release tag automatically checks out the exact task board state at that moment in history.
3. **Zero Tooling Overhead for Users Who Need Milestones**:
   Users who wish to group tasks by release or theme can already do so cleanly without any extra Dirban code:
   - **Tags**: Adding `tags: [v0.2]` to task frontmatter and filtering with `dirban list --tag v0.2` or `grep -l "v0.2" tasks/**/*.md`.
   - **Roadmap Documents**: Creating a top-level `docs/roadmap.md` or `docs/milestones.md` containing checklist links (`- [ ] [26-003](tasks/backlog/26-003-...)`).
   - **Filename Prefixes**: Grouping related batches using epoch/sequence IDs (e.g. `26-001`, `26-002`).

---

## 5. Future Re-evaluation & Current Pragmatic Stance

While first-class milestones are omitted for now to keep the core lean and focused on continuous flow, this is not an irreversible stance. 

We remain open to revisiting native milestone support in the future if real-world usage reveals meaningful pain points or clear ergonomics that cannot be elegantly solved through tags and roadmap documents alone.

For now, the focus remains on keeping Dirban lightweight, fast, and friction-free. If teams need release boundaries today, they can leverage Git tags, markdown roadmaps, or frontmatter tags without added CLI ceremony.

---

## 6. Validation & Guidelines

- `dirban` core CLI will not implement `dirban milestone` or sub-commands.
- Task validation (`dirban lint` or OKF schemas) will not require milestone fields.
- Planning views (`dirban plan`) will focus on task dependencies (`depends_on`, `blocked_by`) rather than arbitrary sprint buckets.

