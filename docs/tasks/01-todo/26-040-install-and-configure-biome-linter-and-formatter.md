---
id: 26-040
title: Install and Configure Biome Linter and Formatter
status: todo
priority: p2
assignee: unassigned
tags:
  - tooling
  - lint
  - format
  - biome
created: 2026-11-13T16:02:00Z
updated: 2026-11-13T16:02:00Z
relationships:
  depends_on: []
---

# Install and Configure Biome Linter and Formatter

## Problem Statement

The repository currently has `bun test` and `typecheck` scripts in `package.json`, but no automated linter or formatter. Adding `@biomejs/biome` as a pinned `devDependency` will enforce consistent TypeScript style (including `semicolons: "asNeeded"`, formatting, and lint rules) across the codebase.

## Acceptance Criteria

- [ ] **1. Install Pinned Dependency**
  - [ ] Add `@biomejs/biome` as an explicit pinned `devDependency` in `package.json` and commit updated `bun.lock`.
- [ ] **2. Configure Biome**
  - [ ] Create `biome.json` matching repository TypeScript standards (e.g., `semicolons: "asNeeded"`, 2-space indentation, double quotes).
  - [ ] Add `lint`, `format`, and `check` scripts to `package.json`.
- [ ] **3. Verification**
  - [ ] Run `bun run check` (or `biome check`) across `src/` and `packages/` and resolve any issues.
  - [ ] Verify `bun test` and `bun run typecheck` still pass.
