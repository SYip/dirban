---
id: 26-035
title: Implement Monorepo Version Bump Script and Release Workflow
status: backlog
priority: p2
assignee: unassigned
tags:
  - release
  - workflow
  - automation
  - tooling
created: 2026-11-11T20:20:00Z
updated: 2026-11-11T20:20:00Z
relationships:
  depends_on: []
---

# Implement Monorepo Version Bump Script and Release Workflow

## Problem Statement
Dirban contains multiple publishable packages in a single monorepo:
1. `dirban` root CLI package (`package.json`) published to npm and GitHub Releases.
2. `syip.dirban-vscode` extension (`packages/vscode-extension/package.json`) published to the VS Code Marketplace and Open VSX.

Currently, bumping versions requires manually editing multiple `package.json` files, ensuring lockfiles are updated, and manually typing git tags. This creates human error risk where package versions drift or git tags don't match the internal `package.json` version strings.

## Proposed Solution
Create a local release helper script `scripts/bump.ts` (invoked via `bun run bump <patch|minor|major|version>`) that:
1. Reads current version from root `package.json`.
2. Calculates the new SemVer target (`patch`, `minor`, `major`, or explicit string like `0.1.3`).
3. Updates `version` in `./package.json` and `./packages/vscode-extension/package.json`.
4. Runs `bun install` to update `bun.lock` with the new workspace versions.
5. Optionally (with `--tag` or by default with confirmation):
   - Git stages modified files (`package.json`, `packages/vscode-extension/package.json`, `bun.lock`).
   - Creates a commit: `release: vX.Y.Z`.
   - Creates an annotated Git tag: `vX.Y.Z`.
6. Prints the next push instruction: `git push origin main --tags`.

## Acceptance Criteria
- [ ] Create `scripts/bump.ts` supporting `patch`, `minor`, `major`, and explicit semver arguments.
- [ ] Add `"bump": "bun run scripts/bump.ts"` to root `package.json` scripts.
- [ ] Synchronously bump both `./package.json` and `./packages/vscode-extension/package.json`.
- [ ] Run `bun install` programmatically to keep `bun.lock` synchronized.
- [ ] Support `--dry-run` to preview version changes without writing files.
- [ ] Support `--no-git` to skip committing/tagging when only file updates are wanted.
- [ ] Output clear instructions to push tag to trigger `.github/workflows/publish.yml`.
