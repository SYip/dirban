---
trigger: model_decision
description: "Documentation standard: Google OKF (Open Knowledge Format) frontmatter, domain logic contracts, E-E-A-T editorial schema, and structural markdown conventions."
---

# Rule: Documentation Standard

## Purpose

Ensure all technical specifications, architectural decisions, domain logic contracts, API schemas,
and user/developer-facing documentation conform to the Google Open Knowledge Format (OKF)
specification for machine readability, semantic consistency, and automated indexing across Project
Raven.

## Scope

- Applicable to all documentation generated or refactored under `docs/`, `specs/`,
  and internal architectural decision records (ADRs).
- Triggers whenever drafting new markdown files, updating domain logic specifications,
  or reviewing technical documentation.

---

## 1. File Structure & Frontmatter

Every compliant documentation file must begin with valid YAML frontmatter containing core metadata
fields:

```yaml
---
okf_version: "1.0"
id: "okf.<project>.<domain>.<document_name>"
title: "Human-Readable Title"
type: "concept" # Options: concept | how-to | reference | architecture-decision | api-spec | domain-logic | task
status: "draft" # Options: draft | proposed | accepted | deprecated | superseded | todo | in-progress | blocked | done
owner: "team-or-username"
last_updated: "YYYY-MM-DD"
tags:
  - knowledge-base
  - domain-name
relationships:
  depends_on: []
  supersedes: []
  related_to: []
---
```

---

## 2. Structural Requirements by Type

### A. Domain Logic Spec (`domain-logic`)

1. **Domain Metadata**: Name, vertical, target audience, version, status.
2. **Business Rules & Invariants**: Explicit logical constraints, validation rules, input/output
   boundaries, and state transitions.
3. **Core Workflow & Algorithms**: Algorithmic pseudocode or step-by-step logic definitions,
   handling of edge cases, and deterministic outcomes.

### B. Concept / Architecture Decision (`concept` / `architecture-decision`)

1. **Context & Problem Statement**: Clear motivation without implementation bias.
2. **Decision Drivers**: Core business or technical requirements influencing choice.
3. **Considered Options**: At least two alternative approaches considered.
4. **Outcome & Rationale**: The selected path and explicit trade-offs accepted.
5. **Validation Strategy**: How the implementation will be tested and monitored.

### C. How-To / Playbook (`how-to`)

1. **Prerequisites**: Environment variables, dependencies, and permissions.
2. **Deterministic Steps**: Imperative commands with expected output blocks.
3. **Verification**: Explicit commands to confirm the procedure succeeded.
4. **Troubleshooting / Rollback**: Mitigation steps for common failure modes.

### D. Reference / API Spec (`reference` / `api-spec`)

1. **Semantic Overview**: 1-2 sentence core definition.
2. **Schema & Types**: Strictly typed inputs, outputs, error states, and exceptions.
3. **Usage Examples**: Minimal reproducible code samples.

### E. Task Specification (`task`)

1. **Metadata & Status**: Stored in a centralized Kanban directory (`docs/tasks/00-backlog/`,
   `docs/tasks/01-ready/`, `docs/tasks/02-in-progress/`, `docs/tasks/03-done/`).
2. **Objective & Scope**: Concise statement of problem and expected outcome.
3. **Acceptance Criteria**: Strict checklist defining completion and performance guarantees.
4. **Verification Plan**: Exact commands (`deno test`, `deno lint`) to validate work.
5. **Execution Journal**: Running log of agent decisions and commit/diff references.

---

## 3. Formatting & Semantic Conventions

- **Semantic Headers**: Use `#` only for the document title (H1). Subsections must strictly follow
  H2 (`##`) and H3 (`###`) without skipping levels.
- **Explicit Callouts**: Use standard semantic blockquotes:
  - `> [!NOTE]` — Clarifications and edge-case behaviors.
  - `> [!WARNING]` — Destructive operations, performance bottlenecks, or security concerns.
  - `> [!IMPORTANT]` — Mandatory prerequisite conditions.
- **Code Fences**: All code snippets must include the syntax language identifier (e.g.,
  ``bash`, ``typescript`, ``json`). For LaTeX mathematical formulas and blocks, use ``math` (i.e. ````math ... ````). Never leave fences untyped.
- **Cross-Linking**: Always use relative links referencing valid OKF document IDs or standard
  workspace paths:
  - Format: `[Linked Topic](relative/path/to/doc.md#anchor-name)`

---

## 4. Execution Directives

When authoring or modifying documentation:

1. **Validate Metadata**: Ensure `id`, `type`, and `status` are non-empty and conform to allowed
   enum values.
2. **Enforce Brevity**: Do not pad explanations with conversational filler. Present structural
   facts, bullet points, and typed schema tables directly.
3. **No Stale Documentation**: When modifying code that alters public signatures, domain
   logic, or deployment flows, automatically update or flag the corresponding documentation in
   the same operation.
