---
okf_version: "1.0"
id: "okf.dirban.decision.acceptance-criteria-over-prescriptive-specs"
title: "Outcome-Driven Acceptance Criteria Over Prescriptive Specifications"
type: "decision"
status: "accepted"
owner: "developer"
last_updated: "2026-11-09"
tags:
  - architecture
  - philosophy
  - task-design
  - acceptance-criteria
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "docs/concepts/why-dirban.md"
    - "docs/decisions/2026-10-12-plain-markdown-and-git-audit.md"
---

# Outcome-Driven Acceptance Criteria Over Prescriptive Specifications

## 1. Context & Problem Statement

Task definitions in software projects often oscillate between two extremes:
1. **Under-specified:** Vague, one-line titles lacking clear boundaries, leading to misaligned expectations.
2. **Prescriptive Over-specification:** Exhaustive upfront design documents that prescribe internal file structures, pseudocode, private helper signatures, and low-level mechanics before coding begins.

When working with autonomous AI coding agents and fast-moving teams, prescriptive over-specification introduces serious drawbacks:
- **Sequential Specification Drift (The A $\rightarrow$ B $\rightarrow$ C Dilemma):** When planning tasks A, B, and C in advance:
  - While implementing A and B, discoveries or refactorings inevitably shift the codebase. By the time C is started, the implementation details prescribed in C's spec are already obsolete.
  - Conversely, while implementing A and B, the developer or agent was focused on their immediate requirements and did not foresee the exact structure C would need. If C's spec rigidly fixed class names or function shapes upfront, it forces an awkward fit against the actual architecture left behind by A and B.
- **Instant Bit-Rot:** Prescribed implementation details become obsolete the moment the code undergoes its first refactor.
- **Cognitive Fatigue:** Long narrative documents are difficult for human reviewers to audit, causing critical edge cases to be overlooked.
- **Duplication of Truth:** Git commit histories, PR diffs, and automated tests already capture *how* code is implemented with far greater accuracy than markdown prose.

## 2. Decision

Dirban adopts **Outcome-Driven Acceptance Criteria** as the primary contract for all task cards, rejecting prescriptive implementation documents.

A Dirban task card defines:
1. **Why (Context & Rationale):** The problem being solved and the desired capability.
2. **What (Acceptance Criteria):** An atomic, point-form checklist (`- [ ]`) defining observable, verifiable outcomes.

```markdown
## Acceptance Criteria

- [ ] Add `autoMerge?: boolean` to `DirbanConfig` schema in `src/config/types.ts`.
- [ ] Add `--no-merge` and `--merge` flags to `CLI_PARSE_OPTIONS`.
- [ ] Preserve branch without merging when `noMerge` is true.
- [ ] Add unit test vector verifying `--merge` overrides `autoMerge: false`.
- [ ] All tests pass (`bun test`) and strict typing passes (`bun run typecheck`).
```

Internal implementation mechanics, module colocation, and refactoring choices are deliberately left to the developer or autonomous agent at implementation time.

## 3. Rationale

### A. Point-Form Scannability & Human Auditability
Checklists are scannable in 15 seconds. Human reviewers can quickly verify deliverables against explicit, binary statements of intent without parsing through walls of narrative text.

### B. Freedom to Refactor & Sequential Resilience
Because the task card specifies *what* must be true rather than *how* private functions are arranged:
- Developers and agents have full freedom to refactor, split files, and improve architectures during development without breaking downstream task definitions.
- When working through tasks A, B, and C in sequence, task C's acceptance criteria remain completely valid even if the implementation of A and B shifted the underlying modules in unexpected ways. Task C merely integrates into the real codebase as it exists today.

### C. Machine-Readable Progress Tracking
Point-form checkbox items (`- [ ]` and `- [x]`) are natively parsed by Dirban to generate deterministic progress badges (`[3/5] 60%`) across CLI lists, TUI views, and IDE extensions without requiring specialized metadata.

### D. Clear Division of Responsibilities
- **Task Card:** Captures intent, boundaries, and acceptance criteria.
- **Code & Test Suite:** Represents the executable behavior and unambiguous specification.
- **Git VCS:** Records the immutable timeline and granular diffs of how the implementation was realized.

## 4. Consequences

### Positive
- **Zero Maintenance Overhead:** Task cards do not require updating when internal implementation details or private helpers are refactored.
- **Higher Review Velocity:** Reviewers verify whether checkboxes and test vectors are satisfied rather than reconciling drifted design specs.
- **Token Efficiency:** AI agents only consume the concise criteria needed to execute, reducing hallucination and context bloat.

### Negative / Trade-offs
- **Requires Clear Acceptance Criteria:** Authors must write precise, verifiable bullet points rather than dumping unrefined thoughts.
- **High-Level Design Must Precede Tasks:** Complex cross-cutting architecture decisions belong in ADRs (like this document), not scattered as ad-hoc prose inside individual task cards.
