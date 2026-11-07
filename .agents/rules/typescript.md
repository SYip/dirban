---
trigger: model_decision
description: "TypeScript standards: strict typing, no semicolons, pure functions & FP, immutability, SRP & single-concern functions, neverthrow error handling, Temporal API, guard clauses, and named constants."
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

## 5. Functional Programming & Immutability
* **Functional Programming (FP)**: Prefer pure functions, immutability, and declarative patterns over imperative state mutation and class hierarchies.
* Domain logic routines and helper utilities must be pure functions with zero side effects.
* Mark parameters and collection types as `readonly` (e.g., `Readonly<T>`, `readonly T[]`) to guarantee immutability.

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
* **Early Return / Break / Continue**: Return, continue, or break early to eliminate deeply nested `if` / loop blocks (guard clauses).
* **Minimize `else`**: Avoid `else` / `else if` when a previous branch terminates or returns; use `else` only when strictly necessary.

## 9. No Magic Numbers or Magic Strings
* **Named Constants**: Never hardcode arbitrary numbers or strings inline.
* Define self-documenting top-level `const` primitives or `as const` objects/mappings within the module or a dedicated domain constants file.

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

