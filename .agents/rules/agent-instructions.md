---
trigger: model_decision
description: "Rules for maintaining AGENTS.md, CLAUDE.md, and agent instruction files (brevity, instruction budget, progressive disclosure, no ball-of-mud)."
---

# Rule: Agent Instructions & AGENTS.md Maintenance

## Purpose
Ensure all root and directory-level agent configuration files (`AGENTS.md`, `CLAUDE.md`, `.agents/`) remain lean, focused, and maintainable. Prevent "ball-of-mud" expansion and context window poisoning by strictly adhering to the **Instruction Budget** and **Progressive Disclosure** principles.

---

## 1. The Instruction Budget
* **Every line in `AGENTS.md` is loaded on every request**: Frontier models attend to approximately 150–200 instructions consistently before experiencing instruction drift or confusion.
* **Keep `AGENTS.md` under 40–50 lines**: Do not bloat root agent files with step-by-step runbooks, lengthy checklists, or boilerplate scripts.
* **Prohibited Content in `AGENTS.md`**:
  * ❌ Long lifecycle walkthroughs or multi-phase roadmaps (move to `docs/`).
  * ❌ Concrete, brittle file paths that might change as code moves (describe capabilities instead).
  * ❌ Language-specific style nitpicks (move to `.agents/rules/`).
  * ❌ Obvious general instructions (e.g., "write clean, readable code").

---

## 2. Progressive Disclosure
Instead of stuffing detailed operational knowledge directly into `AGENTS.md`:
1. **Provide a 1-sentence role anchor**: What the project/package does.
2. **State core non-negotiable architectural axioms**: e.g., zero-backend, isolated Terraform state.
3. **Use light-touch markdown pointers**:
   * For lifecycle workflows $\rightarrow$ link to `docs/LIFECYCLE.md`
   * For domain logic standards $\rightarrow$ link to `.agents/rules/document.md`
   * For TypeScript standards $\rightarrow$ link to `.agents/rules/typescript.md`
   * For testing rules $\rightarrow$ link to `.agents/rules/tests.md`

---

## 3. Monorepo & Directory Scoping
* **Root `AGENTS.md`**: Global monorepo purpose, shared workspace tools (Deno Workspaces), and top-level boundaries.
* **Sub-application `AGENTS.md` (e.g., `apps/<tool>/AGENTS.md`)**: Only created if a sub-application has unique tool-specific exceptions or workflows. Never duplicate root rules into sub-application files.

---

## 4. Maintenance & Refactoring Trigger
Whenever an agent or developer proposes adding instructions to `AGENTS.md`:
* Ask: *Does this instruction affect 100% of tasks across the entire repository?*
  * If **YES** and it can be stated in 1-2 bullet points $\rightarrow$ add to `AGENTS.md`.
  * If **NO** $\rightarrow$ place it in a specialized rule in `.agents/rules/` or an operational guide in `docs/`.
