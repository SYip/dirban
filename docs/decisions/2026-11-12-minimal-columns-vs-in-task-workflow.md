---
okf_version: "1.0"
id: "okf.dirban.adr.minimal-columns-vs-in-task-workflow"
title: "Minimal Board Columns vs. In-Task Hierarchical Checklists"
type: "decision"
status: "accepted"
owner: "team"
last_updated: "2026-11-12"
tags:
  - workflow
  - architecture
  - kanban
  - lifecycle
  - agent-native
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "okf.dirban.concepts.why-dirban"
    - "okf.dirban.concepts.git-workflow"
    - "okf.dirban.adr.worktree-lifecycle-and-state-persistence"
---

# Minimal Board Columns vs. In-Task Hierarchical Checklists

## Context

In web-based issue trackers (Jira, Linear, Trello), moving a card through six columns (`todo -> dev -> test -> review -> qa -> done`) costs nothing because a database row simply changes an enum string.

In Dirban, **directories are state**. Every column transition is a physical filesystem move and a Git operation.

If intermediate operational stages (`dev`, `test`, `review`) are modeled as board columns:
1. Every micro-stage triggers file renames, noisy Git commits, and invalidates file paths in active editor tabs and subagents.
2. Concurrent worktrees risk rename collisions on the same task file.
3. It mimics human bureaucratic handoffs in an environment where an engineer or AI agent implements, tests, and reviews within a single 15–30 minute execution loop.

---

## Decision

### 1. Minimal Board Columns: Lifecycle Only

Dirban reserves directory columns strictly for **workspace lifecycle and ownership boundaries**. Every task has a beginning and an end: both `backlog/` and `archive/` are mandatory lifecycle states:

- **`backlog/`**: The origin. Unprioritized, blocked, or dormant tasks waiting for planning or triage.
- **`01-todo/`**: Prioritized work ready to be claimed into an active workspace.
- **`02-doing/`**: Active work in flight (bound to an active worktree or branch).
- **`03-done/`**: Completed work whose criteria are verified and integrated into trunk.
- **`archive/`**: The terminus. Completed or retired tasks stored for historical record. Users can organize, compress, or structure files here however they choose (e.g. by milestone, sprint, or quarter).

Dirban does not use filesystem directories for operational stages like `develop`, `test`, or `review`.

### 2. Operational Stages as In-Task Checklists

All execution phases and verification gates live directly inside the task markdown file as hierarchical acceptance criteria:

```markdown
## Acceptance Criteria

- [ ] **1. Implementation**
  - [ ] Implement feature logic in `src/...`
  - [ ] Export public types
- [ ] **2. Verification & Testing**
  - [ ] Unit tests pass (`bun test`)
  - [ ] Edge cases verified with test vectors
- [ ] **3. Quality & Review**
  - [ ] Static analysis & code review pass
  - [ ] Update documentation & reference docs
```

---

## Rationale

### 1. Columns Model Ownership; Checklists Model Execution
Columns exist to signal who holds the ball: *Is this unstarted, actively claimed, or completed?*
Within an active task (`02-doing/`), the owner (human or autonomous agent) performs development, testing, and self-review in one tight loop. There is no handoff to an external silo, so there is no reason to move the file.

### 2. Zero Git & Filesystem Thrashing
A task file moves exactly twice in its active life:
1. `01-todo` -> `02-doing` on `dirban start`
2. `02-doing` -> `03-done` on `dirban done`

Its file path stays immutable throughout development. Active editor tabs, terminal paths, and agent workspace contexts never break or shift out from under the user.

### 3. Quantitative Progress Over Opaque Stages
A card sitting in `03-test/` tells you nothing about whether 1 test or 50 tests are written.
Checklists provide instant, quantitative transparency:
- The CLI (`dirban status`) and VS Code extension calculate real completion (e.g. `4/6 criteria completed (66%)`).
- AI agents natively read, execute, and tick off `- [x]` checkboxes as an executable plan.

---

## Consequences

### Positive
- **Rock-Solid Path Stability**: Eliminates git rename churn, broken editor tabs, and invalidated subagent workspace contexts while work is in flight.
- **Auditable Lifecycle History**: Commits on trunk reflect genuine milestones (`start`, `block`, `resume`, `done`), not directory micro-shuffles.
- **Per-Task Flexibility**: Complex tasks can define deep multi-phase checklists (e.g., Spikes, Benchmarks) without modifying global board configuration.

### Trade-offs & Tooling Implications
- **Tooling Requirement**: The CLI, TUI, and VS Code extension must parse hierarchical markdown checkboxes under `## Acceptance Criteria` to compute live progress percentage.
- **Agent Skill Automation**: Structuring tasks with phased criteria (`- [ ] **1. Development**`, `- [ ] **2. Verification**`) is automated by agent skills (e.g. task creation and breakdown skills), requiring minimal manual overhead from humans.

