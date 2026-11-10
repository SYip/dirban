---
name: code-review
description: >-
  Perform systematic, rigorous code reviews for diffs, pull requests, staged changes, or recent commits.
  Verifies correctness, architecture compliance, algorithmic complexity (Big O analysis & O(n²) flags),
  design patterns for maintainability, TypeScript standards (FP, immutability, no semicolons,
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

Evaluate the diff against these 7 core dimensions:

### A. Architectural & Scope Principles
- [ ] **Review Scope & Focus**:
  - Focus strictly on modified code and touched functions in the diff.
  - Ignore untouched existing code; do not flag or expand scope to clean up legacy code unless the function itself was modified.
- [ ] **Check Existing Logic & Pragmatic Reuse**:
  - Check if a function or utility already exists before writing new ones.
  - Reusing existing logic is preferred, but intentional duplication is acceptable when it avoids premature abstractions, avoids unnecessary coupling across distinct boundaries, or keeps a module self-contained.
- [ ] **Progressive Enhancement**: Does the code keep filesystem-as-state primary? Is Git / external tooling strictly optional?
- [ ] **No Ball-of-Mud**: Are files, modules, and functions cohesive? Does each component have a single responsibility?
- [ ] **Design Pattern Recommendations**:
  - Suggest proven design patterns that elevate code quality, decouplability, and testability:
    - **Strategy Pattern**: When branching logic or runtime variants are hardcoded in sprawling conditionals (e.g. interchangeable VCS providers, workspace lifecycles, formatting engines).
    - **Adapter / Facade Pattern**: When wrapping raw external third-party APIs or Node.js primitives into pure, neverthrow-safe domain interfaces.
    - **Factory / Builder Pattern**: When constructing complex data structures or domain models with numerous optional parameters or invariant validation.
    - **Command / Dispatch Table**: Replace large `switch`/`case` branches with typed lookup dictionaries or command handler maps.
    - **Pipeline / Chain of Responsibility**: When processing data through multi-step transformations, validations, or sanitizations.
  - *Caution*: Do not recommend patterns that introduce unnecessary abstraction layers or over-engineering for simple, one-off logic.
- [ ] **Documentation & Rule Integrity**: Are documentation and docstrings preserved?

### B. Algorithmic Complexity & Big-O Analysis
- [ ] **Big-O Complexity Check**:
  - Evaluate time and space complexity of new or modified loops, lookups, and data transformations.
  - **Flag any $O(n^2)$ or worse quadratic patterns**:
    - Nested iterations over collections (e.g. `items.map(i => otherItems.find(o => o.id === i.id))`).
    - Calling `Array.prototype.includes`, `find`, `indexOf`, or `filter` inside loops over large or unbounded arrays.
    - Repeated array allocations, concatenations (`[...acc, item]`), or string slicing inside tight loops.
  - **Remediation**:
    - Pre-index collections into `Map` or `Set` ($O(1)$ lookup) before the loop to reduce complexity to $O(n)$.
    - If quadratic behavior is strictly unavoidable or operating on a tiny, fixed-size constant array (e.g. 3 columns), explicitly document the bound and rationale.

### C. TypeScript Standards (`.agents/rules/typescript.md`)
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
  - Prefers compile-time `readonly` types over noisy runtime `Object.freeze` wrapping.
  - Uses `map`, `filter`, `reduce`, `Object.fromEntries` instead of mutating arrays/objects.
  - Interfaces, parameters, and array return types use `readonly T[]` / `Readonly<T>`.
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

### D. Testing & Verification (`.agents/rules/tests.md`)
- [ ] **Test Vectors**: Are new behaviors covered by explicit test vectors (`Vector 1`, `Vector 2`, ...)?
- [ ] **Clean Suite**: Do all tests pass?
  ```bash
  bun test
  ```
- [ ] **Typecheck**: Does the compiler report zero errors?
  ```bash
  bun run typecheck
  ```

### E. File & Code Organization (`.agents/rules/file-naming.md`)
- [ ] **Kebab-Case**: Directory and file names are kebab-case (e.g., `task-mutation.ts`, `types.ts`).
- [ ] **PascalCase**: Classes, React/TUI components, and types use PascalCase.
- [ ] **Test Suffix**: Tests use `.test.ts` placed adjacent or in matching directory.

### F. Safety, Security & Git Constraints
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

### 🟡 Complexity & Algorithmic Improvements (Big-O & Performance)
Identified O(n²) or quadratic patterns, unnecessary nested lookups, unindexed scans, or recommendations to pre-index into Set/Map.

### 🟡 Design Patterns & Architectural Improvements
Concrete design pattern suggestions (e.g. Strategy, Adapter, Dispatch Map, Pipeline) that simplify conditionals, decouple dependencies, or improve testability.

### 🟡 Improvements & Standards (Non-blocking)
TypeScript rule violations, immutability gaps, named regex suggestions, or refactoring opportunities.

### 🟢 Strengths & Highlights
Well-architected patterns, good test coverage, or clean type safety.

### Verification Status
- Tests: `bun test` (X passed, 0 failed)
- Typecheck: `bun run typecheck` (clean / errors)
```

