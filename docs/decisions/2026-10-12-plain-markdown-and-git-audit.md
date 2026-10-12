---
okf_version: "1.0"
id: "okf.dirban.architecture.plain-markdown-simplification"
title: "ADR: Transitioning to Plain-Markdown Tasks, Optional IDs, and Git-Native Audit"
type: "architecture-decision"
status: "accepted"
owner: "developer"
last_updated: "2026-10-12"
tags:
  - architecture
  - kanban
  - markdown
  - cli
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "spec.md"
---

# Architecture Decision Record: Transitioning to Plain Markdown, Optional IDs, and Git-Native Audit

## 1. Context & Problem Statement

The initial specification for Dirban enforced rigid Google Open Knowledge Format (OKF) requirements:
- Mandatory YAML frontmatter with strict schema validation (`id`, `owner`, `assigned_to`, `relationships.depends_on`, `relationships.blocks`).
- Complex task relationship graphs encoded directly into task files.
- In-file `## Execution Journal` maintenance for card movements.
- Rigid task ID strings (`task.<project>.<domain>.[YY]-[3-digit]`).

While this structure prioritized strict machine parsing, it introduced significant friction:
1. **High cognitive overhead**: Creating a simple task required drafting verbose boilerplate frontmatter.
2. **Parser rejection of natural notes**: AI agents and humans writing ordinary markdown tasks encountered validation errors.
3. **Merge conflict churn**: Appending status updates and timestamps to in-file execution journals caused frequent Git merge conflicts.
4. **Fragile relational references**: Storing relative link graphs across folders broke when files were moved or renamed.

---

## 2. Decision Drivers

- **Zero-Friction Authoring**: Creating a task must be as simple as saving a `.md` file with a title and checklist.
- **Agent and Human Ergonomics**: LLMs and developers naturally organize ideas using markdown checklists (`- [ ]`).
- **Single Source of Truth**: The physical filesystem directory dictates the task's state. Git provides the immutable event log.
- **Configurability**: Projects have varying lifecycle pipelines (`todo`/`doing`/`done` vs. `spec`/`ready`/`dev`/`qa`/`done`).
- **Target Scope (Solo & Micro-Teams $\le 5$)**: Explicitly non-targeted at large enterprises. Avoiding the complexity of distributed ID collision arbiters, multi-tenant ACLs, and heavy workflow guard rails keeps the engine lightweight and transparent.
- **Long-Term Scalability**: Backlogs and archives grow large; they must be structured without crowding active WIP boards.

---

## 3. Considered Options

### Option A: Strict OKF Specification (Previous Baseline)
- **Pros**: Perfectly uniform schema, formal graph links, standardized across machine parsers.
- **Cons**: High setup friction, fragile links across moved files, noisy git diffs, excessive token cost for AI agents.

### Option B: Monolithic Markdown Kanban (e.g., Obsidian Kanban / Taskell)
- **Pros**: Single file representation, quick to view.
- **Cons**: Massive git merge conflicts when multiple agents or contributors touch tasks simultaneously; full file context loaded on every change.

### Option C: Plain Markdown with Optional Metadata & Git Audit (Selected Approach)
- **Pros**: 
  - Pure `.md` files are first-class tasks.
  - Frontmatter is optional; if present, only priority (`p0`–`p3`) is parsed (defaulting to `p3`).
  - Checkboxes (`- [ ]`) natively represent subtasks and criteria.
  - Git history (`git log --follow`) tracks movement history without file churn.
  - Interactive `dirban init` establishes project defaults cleanly.
- **Cons**: Less rigid type enforcement across arbitrary third-party metadata fields.

---

## 4. Outcome & Detailed Rationale

We selected **Option C**. Dirban is redefined around five core design decisions:

### 4.1 Plain Markdown as the Universal Format
A file containing only:
```markdown
# Investigate auth token timeout
- [ ] Check redis TTL
- [ ] Write regression test
```
is completely valid. Title is extracted from the first `# ` heading (or filename), and progress is extracted from markdown checkboxes (`[0/2]`).

### 4.2 Optional Frontmatter & Graceful Priority Fallback
Google OKF frontmatter is supported but strictly optional. If `priority:` is omitted or invalid, it defaults to the lowest tier (`p3`). No task creation fails due to missing metadata.

### 4.3 Git is the Audit Log
We eliminate the in-file `## Execution Journal`. Git commits already record author, commit time, and file movement (`git log --follow --stat`). Avoiding in-file edits on move operations prevents Git conflicts.

### 4.4 Flexible Columns with Mandatory Backlog & Archive
- Active board columns are configurable (`["ready", "doing", "done"]` by default).
- `backlog/` and `archive/` are reserved mandatory tiers to prevent large file counts from crowding the active pipeline.

### 4.5 Dual Workflow Modality: Directory-Driven vs. Document-Driven
- **Directory-based workflow**: Users who appreciate Kanban boards move files across physical stage directories (`01-ready` $\rightarrow$ `02-doing` $\rightarrow$ `03-done`).
- **Document-based workflow**: Users who want minimal file moves can keep tasks in one place and manage execution stages directly using **Markdown sections** (`## Spec`, `## Implementation`, `## Review`) and **checklists** (`- [ ]`).
- Dirban imposes zero friction on either style—the CLI and UI surface checklist progress regardless of which folder the file lives in.

### 4.6 Flexible Task Identity
- Default to slug-based identification (`fix-auth-flow.md`), allowing the CLI and future VS Code extension to use fuzzy matching.
- Support optional sequential numeric IDs (`042-fix-auth-flow.md`) or custom generator hooks for projects requiring numbers.

### 4.7 No OKF Formatter or Document Rewriter
- Dirban deliberately omits an OKF serializer/formatter.
- Forcing a serializer would rewrite arbitrary markdown files, stripping user comments, reformatting custom sections, and creating noisy git diffs.
- Task movement is purely a filesystem operation (`fs.rename`). The content of the markdown file remains untouched by the engine unless the user explicitly checks a box.

### 4.8 Priority Instead of Manual Rank (Why No Drag-and-Drop Ranking Index)
- **The Problem with "Rank" in File-Based Systems**:
  - In cloud tools (Jira Lexorank, Linear), dragging an issue between two cards generates fractional string indices (e.g. `order: 0|hzzzzz:`).
  - In flat files, maintaining manual vertical order requires either:
    1. Prefixing every filename with numbers (`01-task.md`, `02-task.md`), causing massive cascading renames whenever a task is inserted into the middle.
    2. Injecting and rewriting an `order: 12` integer into frontmatter, which pollutes Git diffs and creates constant merge conflicts.
- **The Priority Alternative**:
  - If a task needs to be done sooner, **elevate its priority** (`p0` > `p1` > `p2` > `p3`).
  - Priority communicates *intent and business value*, whereas arbitrary drag rank is often accidental or subjective.
  - Within the same priority tier, cards sort deterministically by **date** or **ticket ID**.
  - This keeps files completely static, avoids cascading renames, and produces zero artificial Git diff churn.

### 4.9 Optional Task Assignment (Assignee / Owner Not Enforced)
- **Optional, Never Required**:
  - Developers can freely put their name on a task (e.g. `assignee: alice` or `owner: bob` in frontmatter, or `@username` in the markdown body), but **it is strictly optional**.
  - Dirban will never fail validation or block task transitions if a name is omitted.
  - In small teams ($\le 5$) and AI pairing workflows, task ownership is often already evident from Git commits or branch names.
  - Eliminates the need to maintain user registries, authentication maps, or team directory configs.

---

## 5. Validation Strategy

1. **Unit Testing**: Update parser test suite to verify that pure markdown documents without frontmatter parse successfully with default priorities and progress counters.
2. **CLI Usability**: Implement `dirban init` with interactive prompts and a `--yes` flag to confirm instant project scaffolding.
3. **Operations Testing**: Validate atomic file moves without modifying file bodies, ensuring clean Git diffs.
