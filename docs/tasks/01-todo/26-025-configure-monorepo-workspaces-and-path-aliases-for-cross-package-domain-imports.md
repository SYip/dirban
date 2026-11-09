---
id: "26-025"
title: "Configure Monorepo Workspaces and Path Aliases for Cross-Package Domain Imports"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-09"
last_updated: "2026-11-09"
tags:
  - infra
  - monorepo
  - workspaces
  - typescript
  - vscode
relationships:
  depends_on:
    - "26-011"
  blocks:
    - "26-008"
  related_to:
    - "packages/vscode-extension/package.json"
---

# Configure Monorepo Workspaces and Path Aliases for Cross-Package Domain Imports

Configures Bun monorepo workspaces and clean TypeScript path aliases across the repository so packages (such as `packages/vscode-extension`) can seamlessly import core domain modules without brittle `../../src` relative path traversal or dependency desynchronization.

## Problem Statement

1. **Workspace Boundary**: `packages/vscode-extension` contains its own `package.json` and lockfile without root `workspaces` registration. Running `bun install` at root currently ignores `packages/vscode-extension`.
2. **Relative Path Traversal**: Extension host code needing core domain logic (`src/board`, `src/config`, `src/okf`) must currently use brittle relative paths (`../../src/...`), creating maintenance overhead during file reorganizations.
3. **Root Script Delegation**: Developers must change directories (`cd packages/vscode-extension`) to run extension builds, watch modes, or packaging.

## Requirements

1. **Monorepo Workspaces**:
   - Register `"workspaces": ["packages/*"]` in the root `package.json`.
   - Add root-level convenience delegation scripts (`build:extension`, `watch:extension`, `package:extension`).
2. **TypeScript Path Aliases (`@dirban/core/*`)**:
   - Configure `@dirban/core/*` alias mapped to `src/*` in root `tsconfig.json`.
   - Configure `@dirban/core/*` alias mapped to `../../src/*` in `packages/vscode-extension/tsconfig.json`.
   - Ensure `build.extension.ts` (esbuild) and `vite.config.ts` (Vite) resolve `@dirban/core/*` cleanly.
3. **Card State Synchronization**:
   - Ensure completed task `26-011` frontmatter status in `docs/tasks/03-done/` is normalized to `03-done`.

## Acceptance Criteria

- [ ] Add `"workspaces": ["packages/*"]` to root `package.json` and verify root `bun install` links workspace packages.
- [ ] Add root package scripts delegating build and watch commands to `packages/vscode-extension` (`build:extension`, `watch:extension`).
- [ ] Configure `@dirban/core/*` path alias in root `tsconfig.json` and `packages/vscode-extension/tsconfig.json`.
- [ ] Configure `vite.config.ts` in `packages/vscode-extension` to resolve `@dirban/core/*` alias.
- [ ] Verify `build.extension.ts` (esbuild) correctly resolves `@dirban/core/*` when compiling extension host code.
- [ ] Add a verification test or sample import from `@dirban/core` in `packages/vscode-extension/src/extension.ts` ensuring clean bundle generation and zero type errors.
- [ ] Normalize `docs/tasks/03-done/26-011-...md` frontmatter status to `03-done`.
- [ ] Run test suite and typechecks across both root and extension workspaces (`mise exec -- bun test && mise exec -- bun run typecheck`).
