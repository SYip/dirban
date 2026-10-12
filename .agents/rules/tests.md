---
trigger: model_decision
description: "Testing standards: native Bun test runner (bun test), test vector verification, and test organization."
---

# Testing Standards & Verification

## 1. Test Framework & Runner
* Use Bun's native test runner (`bun test`) for fast, zero-dependency testing.
* Tests must be colocated with source modules (e.g., `feature.ts` and `feature.test.ts`).

## 2. Test Vector Requirement
* Every core domain function must have unit tests asserting outputs against established test vectors.
* A minimum of 3 vectors is required:
  1. **Standard Baseline Case**: Typical real-world user scenario.
  2. **Minimum / Lower Boundary**: Smallest allowable values.
  3. **Maximum / Extreme Boundary**: Stress test with boundary values and extreme scenarios.

## 3. Pre-Commit / Build Verification
* No pull request or deploy may proceed if `bun test` fails.
* All tests must pass automated regression testing before deployment.

## 4. Test Organization & Grouping (Domain & Sub-Steps)
* **Group by Business Domain**: Group tests by business domain and statutory authority (e.g. statutory rules, edge cases, supporting utilities) rather than arbitrary technical buckets.
* **Use Nested Steps (`describe` / `it`)**: Use `describe(..., () => { it(...) })` from `bun:test` to group related scenarios within a domain or section, providing clear hierarchical test execution logs.
* **Self-Documenting Test Names**: Use descriptive, standard-referencing test titles (e.g., citing benchmark scenarios or vectors) so that test intent is evident without redundant explanatory comments.
