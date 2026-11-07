---
name: code-review
description: >-
  Perform systematic, rigorous code reviews for diffs, pull requests, staged changes, or recent commits.
  Verifies correctness, architecture compliance, TypeScript standards (FP, immutability, no semicolons,
  single concern, named constants/regexes), test vector coverage, and security invariants.
---

# Code Review Skill

This skill guides agents and developers through a structured, objective code review of uncommitted changes, branches, or PR diffs against repository standards.

---

## 1. Review Triggers & Input Inspection

Run code review before completing tasks, creating pull requests, or when asked to inspect changes.

### Step 1: Gather the Diff
Determine what changes are being reviewed:

```bash
# Unstaged working tree changes
git diff

# Staged changes ready for commit
git diff --cached

# Changes against base branch (main)
git diff main...HEAD

# Recent commit
git diff HEAD~1..HEAD
```

### Step 2: Check Active Task & Context
If reviewing work on an active task, inspect its acceptance criteria:

```bash
dirban current --raw
```

---

## 2. Review Checklist & Evaluation Dimensions

Evaluate the diff against these 6 core dimensions:

### A. Architectural & Scope Principles
- [ ] **Review Scope & Focus**:
  - Focus strictly on modified code and touched functions in the diff.
  - Ignore untouched existing code; do not flag or expand scope to clean up legacy code unless the function itself was modified.
- [ ] **Check Existing Logic & Pragmatic Reuse**:
  - Check if a function or utility already exists before writing new ones.
  - Reusing existing logic is preferred, but intentional duplication is acceptable when it avoids premature abstractions, avoids unnecessary coupling across distinct boundaries, or keeps a module self-contained.
- [ ] **Progressive Enhancement**: Does the code keep filesystem-as-state primary? Is Git / external tooling strictly optional?
- [ ] **No Ball-of-Mud**: Are files, modules, and functions cohesive? Does each component have a single responsibility?
- [ ] **Documentation & Rule Integrity**: Are documentation and docstrings preserved?

### B. TypeScript Standards (`.agents/rules/typescript.md`)
- [ ] **No Semicolons**: Code uses `semi: false` (no trailing semicolons).
- [ ] **Flat Control Flow & Early Returns**:
  - Do your best to prevent nested levels of `if` blocks.
  - Invert conditions and use early `return`, `continue`, or `break` (guard clauses) to keep control flow flat wherever practical.
- [ ] **Logic Extraction**:
  - Check if any complex logic, calculations, or validations can be extracted into cohesive, pure helper functions.
- [ ] **Named Magic Values & Complex Booleans**:
  - Magic strings (column names, commands, status values) and numbers (timeouts, widths, limits) are defined as named constants (`const` / `as const`).
  - Complex boolean conditions (with multiple operators or non-trivial logic) are extracted into descriptive `const is... = ...` variables or predicate functions.
  - No anonymous inline regex literals (e.g. `const EXTRACT_REGEX = /.../`).
- [ ] **Functional & Immutable**:
  - Uses `map`, `filter`, `reduce`, `Object.fromEntries` instead of mutating arrays/objects.
  - Return values wrapped in `Object.freeze(...)` where appropriate.
  - No `push`, `splice`, or in-place property mutations.
- [ ] **Single Responsibility & Function Scope**:
  - Functions do one thing with one level of abstraction.
  - Long switchboards or sprawling multi-concern functions are refactored into smaller helpers or dispatch tables.
- [ ] **Error Handling with `neverthrow`**:
  - Domain operations return `Result<T, E>` (`ok` / `err`).
  - No uncaught throwing in core domain logic.
- [ ] **Strict Typing**:
  - Strict types with no `any` or untyped casts.
  - Null checks prefer `== null` / `!= null` to catch both `null` and `undefined`.
- [ ] **No Single-Letter Variable Names**:
  - Descriptive, self-documenting variable names (e.g., use `query`, `parsedItem`, `taskIndex`, NOT `q`, `p`, `x`). The only permitted single-letter variable is `i` in numeric index loops.

### C. Testing & Verification (`.agents/rules/tests.md`)
- [ ] **Test Vectors**: Are new behaviors covered by explicit test vectors (`Vector 1`, `Vector 2`, ...)?
- [ ] **Clean Suite**: Do all tests pass?
  ```bash
  bun test
  ```
- [ ] **Typecheck**: Does the compiler report zero errors?
  ```bash
  bun run typecheck
  ```

### D. File & Code Organization (`.agents/rules/file-naming.md`)
- [ ] **Kebab-Case**: Directory and file names are kebab-case (e.g., `task-mutation.ts`, `types.ts`).
- [ ] **PascalCase**: Classes, React/TUI components, and types use PascalCase.
- [ ] **Test Suffix**: Tests use `.test.ts` placed adjacent or in matching directory.

### E. Safety, Security & Git Constraints
- [ ] **No Unprompted Commits**: Never run `git commit` or `git reset` unless explicitly commanded by user.
- [ ] **Clean Resource Handling**: File descriptors, spawned child processes, and temporary directories are safely cleaned up.

---

## 3. Output Format

Present code review findings in a structured, actionable format:

```markdown
### Summary
A concise 1-2 sentence overview of the changeset and overall health.

### 🔴 Critical Issues (Blockers)
Issues that cause bugs, break invariants, or fail tests. Include file link and line numbers.

### 🟡 Improvements & Standards (Non-blocking)
TypeScript rule violations, immutability gaps, named regex suggestions, or refactoring opportunities.

### 🟢 Strengths & Highlights
Well-architected patterns, good test coverage, or clean type safety.

### Verification Status
- Tests: `bun test` (X passed, 0 failed)
- Typecheck: `bun run typecheck` (clean / errors)
```

