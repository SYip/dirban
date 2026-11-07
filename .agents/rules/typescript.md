---
trigger: model_decision
description: "TypeScript standards: strict typing, no semicolons, pure functions & FP, immutability, SRP & single-concern functions, neverthrow error handling, Temporal API, guard clauses, and named constants & regexes."
---

# TypeScript Standards & Conventions

## 1. Strict Typing Policy
* `noImplicitAny: true` is strictly enforced.
* **Prohibited**: The `any` type is strictly forbidden for function inputs, intermediate state, and outputs.
* Use `unknown` with runtime type narrowing or validation (e.g., Zod or type guards) if handling raw external inputs.

## 2. Form State & Boundary Input Typing (String at the Boundary)
* **Form Inputs & Component Props**: User inputs bound to HTML inputs (`<input>`) and passed between UI components should be typed strictly as `string` (or `string | null` if optional), **never** `number | string`.
  * Preserves incomplete user keystrokes (e.g., empty string `""` on backspace, intermediate punctuation entry).
  * Prevents premature coercion or loss of precision during component-to-component transfers.
* **Domain Parsing**: Domain engines should accept string inputs at the boundary and parse/validate them into typed values explicitly, returning formatted string representations when communicating back to the presentation layer.

## 3. Formatting & Semicolons
* **No semicolons (`semi: false`)**: Do not use semicolons at the end of statements unless syntactically required (e.g., before an IIFE or array destructuring statement starting on a new line).
* Enforced via code formatter configuration (`"semiColons": false` / `"semi": false`).

## 4. Domain Models & Schemas
* Explicitly define interfaces and data schemas within their business domain module (e.g., `user-profile/types.ts`) or colocated with the domain logic module, never in a generic global technical bucket like `/types/`.

## 5. Declarative & Functional Programming (FP) & Immutability
* **Declarative / Functional Paradigm**: Prefer declarative and functional programming patterns over imperative loops, mutable state, and class hierarchies.
  * Use higher-order functions (`map`, `filter`, `reduce`, `flatMap`, `find`, `some`, `every`, `Object.fromEntries`) instead of imperative `for`/`while` loops and manual array pushes whenever viable.
  * Use pure functions with zero side effects for domain logic, transformations, and formatting.
* **Immutability by Default**:
  * Mark parameters and collection types as `readonly` (e.g., `Readonly<T>`, `readonly T[]`, `as const`).
  * Avoid in-place mutations (e.g. `push`, `splice`, direct property assignment); return fresh frozen or spread objects (`{ ...obj, updated }`, `[...arr, item]`).

## 6. Single Responsibility & Function Scope
* **Single Responsibility Principle (SRP)**: Each function must do one thing, do it completely, and do it well. Avoid monolithic "god functions" that mix parsing, business logic, I/O, validation, and presentation.
* **Allowable Long Functions**:
  * A function is permitted to be longer **only if it has a single, cohesive responsibility** (e.g., an exhaustive pattern match, a linear declarative layout builder, or a cohesive data table generator).
  * Arbitrary line length is not the issue; having **multiple distinct logic points or mixed concerns** in one body is prohibited.
* **Decompose Multiple Logic Points**:
  * Never mix orchestration, business validation, data transformation, and formatting in the same function.
  * Extract discrete decision branches, complex conditions, and separate subtasks into dedicated, pure helper functions.
  * Keep cyclomatic complexity low: avoid deeply interleaved branches or stateful multi-step control flow.
* **Separate Orchestration from Execution**: Orchestrator/dispatcher functions should only coordinate calls to specialized helpers; they should not embed detailed domain or parsing logic directly.

## 7. Robust Error Handling with `neverthrow`
* **Explicit Result Types**: Avoid throwing unexpected exceptions in domain logic.
* Use `neverthrow` (`Result<T, E>`, `ok`, `err`) to make success and failure branches explicit and force callers to handle errors at compile time.

## 8. Guard Clauses, Equality & Control Flow
* **Null & Undefined Checks**: Prefer using `== null` (and `!= null`) to check for both `null` and `undefined` simultaneously, unless they explicitly need to be differentiated and checked separately (in which case use `=== null` or `=== undefined`).
* **Strict Boolean Conditions**: Conditions in `if`, ternary, and logical expressions must be strictly boolean typed.
  * Disallow implicit truthy/falsy coercion for non-boolean types (e.g., strings, numbers, objects, arrays, or optional values). Require explicit comparisons (e.g. `val != null`, `str !== ""`, `arr.length > 0`).
  * If a variable or expression is already a `boolean` (e.g., `isActive`, `isValid`, `hasPermission`), use it directly (`if (isActive)`, `isValid ? ... : ...`); do NOT do redundant `=== true` checks.
* **Early Return / Break / Continue (Flat Control Flow)**:
  * Do your best to prevent nested levels of `if` blocks. Always prefer guard clauses with early `return`, `continue`, or `break` to keep control flow flat.
  * Invert conditions and exit early rather than wrapping entire blocks in nested `if` statements.
* **Review Scope & Focus**:
  * Focus strictly on modified code and touched functions.
  * Do not refactor or criticize untouched existing code unless the function itself was modified as part of the task.
* **Minimize `else`**: Avoid `else` / `else if` when a previous branch terminates or returns; use `else` only when strictly necessary.
* **Logic Extraction**: Extract any complex nested logic, calculations, or validations into small, cohesive, pure helper functions.

## 9. Named Constants, Regular Expressions & Variable Naming
* **No Single-Letter Variable Names**: Single-letter variable names are strictly prohibited, except `i` in loops. Always use descriptive, self-documenting names.
* **Named Constants & Magic Values**:
  * Never hardcode arbitrary numbers, strings, or complex boolean predicates inline.
  * For magic strings (column names, commands, status values) and magic numbers (timeouts, widths, limits), define self-documenting top-level `const` primitives or `as const` objects/mappings.
* **Named Complex Booleans**: If a boolean condition has more than one operator or is non-trivial, extract it to a descriptive `const is... = ...` variable or a predicate function.
* **Named Regular Expressions**: Never use anonymous, inline regex literals directly within functions or conditionals.
  * Every regular expression must be assigned to a self-documenting named variable or constant (e.g., `const CHECKBOX_LINE_REGEX = /^(\s*-\s*\[([ xX])\]\s*)(.+?)\r?$/`, `const LINE_SPLIT_REGEX = /\r?\n/`).
  * Naming conveys the regex's intent, simplifies testing, and prevents re-compilation in hot loops.

## 10. Date & Time (Temporal API)
* **Prefer Temporal API over legacy `Date`**: For dates, time, calendar years, and temporal offsets, use the modern `Temporal` API (`Temporal.Now.plainDateISO()`, `Temporal.PlainDate`) instead of legacy JavaScript `Date`.
* Prohibit `new Date()` for date arithmetic, timezone offsets, and temporal comparisons.

## 11. Bun & Modern ESM Standards
* Use explicit extensions (`.ts`, `.tsx`) in relative import paths as required by modern ESM.
* Use Bun native runtime and tooling (`bun run`, `bun test`).

## 12. Code Comments Policy (Self-Documenting Code)
* **Prohibit unnecessary comments**: Do not add comments that merely restate what clean function names, variable names, or types already convey.
* Comments are strictly prohibited **unless**:
  1. It explains complex domain logic that the function/variable name cannot sufficiently clarify.
  2. It marks or explains a deep UI/template section where understanding requires reading through long lines/blocks of markup.

