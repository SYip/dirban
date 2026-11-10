---
id: "26-032"
title: "Configure automated release pipeline and publish to npm and VS Code Marketplace"
type: "task"
status: "in-progress"
priority: "p1"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-10"
last_updated: "2026-11-10"
tags:
  - npm
  - vscode
  - marketplace
  - release
  - ci-cd
  - cli
relationships:
  depends_on: []
  blocks: []
  related_to:
    - "README.md"
    - "packages/vscode-extension/package.json"
---

# Configure automated release pipeline and publish to npm and VS Code Marketplace

To make Dirban easily installable via package managers (`bun add -g dirban`, `npm install -g dirban`, or `npx dirban`) and within VS Code via the Visual Studio Marketplace / Open VSX, we need to set up package metadata, build artifacts, and an automated release workflow for both the core CLI and the VS Code extension.

## Objectives & Scope
1. **Core CLI Packaging & npm**:
   - Ensure root `package.json` has complete metadata: `name`, `version`, `bin`, `files`, `repository`, `keywords`, and `license`.
   - Ensure the bundled CLI entrypoint includes a valid shebang (`#!/usr/bin/env node` or `#!/usr/bin/env bun`) and packages runtime dependencies cleanly.
   - Configure files allowlist to exclude test suites, scratch docs, and dev configs.
2. **VS Code Extension Packaging (`packages/vscode-extension`)**:
   - Verify `packages/vscode-extension/package.json` metadata: publisher, display name, icon/branding, categories, repository links, and activation events.
   - Configure packaging with `@vscode/vsce` to produce `.vsix` packages.
   - Prepare credentials setup (Visual Studio Marketplace Personal Access Token `VSCE_PAT` and Open VSX token `OVSX_PAT`).
3. **Automated Publishing Workflow**:
   - Set up a GitHub Actions release workflow (`.github/workflows/release.yml`) triggered by version tags (`v*`) or manual release dispatch.
   - Automate testing, dry-run packaging, npm publishing, and marketplace extension deployment (`vsce publish`).
4. **Documentation**:
   - Update `README.md` to restore `bun add -g dirban` / `npm install -g dirban` and add the VS Code Marketplace installation badge/link.

## Acceptance Criteria
- [x] Root `package.json` configured and verified with `bun pm pack` or `npm pack --dry-run` for npm release.
- [x] Core CLI build script produces an executable entrypoint with shebang and bundled dependencies.
- [x] VS Code extension package verified with `vsce package` producing a clean, valid `.vsix` bundle.
- [x] GitHub Actions release pipeline created to automate building, testing, npm publishing, and VS Code Marketplace publishing.
- [x] Documentation updated with official package links and one-click installation instructions.
