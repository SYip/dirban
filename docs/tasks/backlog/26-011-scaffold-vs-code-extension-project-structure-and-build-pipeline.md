---
id: "26-011"
title: "Scaffold VS Code Extension Project Structure and Build Pipeline"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-08"
last_updated: "2026-11-08"
tags:
  - vscode
  - extension
  - build
  - infra
relationships:
  depends_on: []
  blocks:
    - "26-008"
  related_to:
    - docs/decisions/2026-11-07-progressive-enhancement-optional-dependencies.md
---

# Scaffold VS Code Extension Project Structure and Build Pipeline

Establishes the monorepo architecture, build pipeline, and developer debugging harness for the official Dirban VS Code extension.

Because the VS Code Extension Host executes in a Node.js runtime, the extension requires a dedicated bundling pipeline and manifest separate from the standalone Bun CLI binary, while sharing the core domain logic (`src/board`, `src/config`, `src/operations`, `src/okf`).

## Key Setup Requirements

1. **Workspace Layout**:
   - Establish extension package directory structure under `packages/vscode-extension/` (or configured monorepo workspace).
   - Ensure clean module boundary so the extension can directly import core domain modules without code duplication.

2. **Extension Manifest & Required Packages**:
   - Create `package.json` with VS Code extension metadata (`engines.vscode: "^1.90.0"`, `activationEvents: ["onStartupFinished"]`, and base `contributes` declarations).
   - **Extension Host Dependencies (`devDependencies`)**:
     - `@types/vscode`: `^1.90.0`
     - `@types/node`: `^22.13.0`
     - `esbuild`: `^0.25.0` (backend bundler targeting Node/CJS)
     - `@vscode/vsce`: (VS Code extension packaging tool)
   - **Webview UI Dependencies (`dependencies` & `devDependencies`)**:
     - `vue`: `^3.5.0`
     - `@vitejs/plugin-vue`: `^5.2.0`
     - `vite`: `^6.0.0` (frontend webview bundler)
     - `@vscode/webview-ui-toolkit`: (VS Code native styled Web Components)

3. **Build & Bundle Pipeline**:
   - Extension Host: `esbuild` targeting Node/CommonJS format required by the VS Code Extension Host.
   - Webview UI: Vite + Vue 3 build pipeline compiling SFCs (`.vue`) into optimized webview assets (`dist/webview/`).
   - Support development watch mode (`bun run watch` or `npm run watch`) with hot reload and production packaging (`vsce package`).

4. **Debugging Experience (F5 Support)**:
   - Configure `.vscode/launch.json` with an "Extension Development Host" launch target.
   - Configure `.vscode/tasks.json` with pre-launch compilation and watch tasks.

## Acceptance Criteria

- [ ] Create `packages/vscode-extension/` directory structure with its own `package.json` and TypeScript configuration (`tsconfig.json`).
- [ ] Install and configure required packages:
  - Backend/Extension Host: `@types/vscode`, `esbuild`, `@vscode/vsce`.
  - Frontend/Webview: `vue`, `@vitejs/plugin-vue`, `vite`, `@vscode/webview-ui-toolkit`.
- [ ] Configure manifest declarations for the VS Code extension runtime (`engines.vscode: "^1.90.0"`, entrypoint `dist/extension.js`).
- [ ] Establish dual bundler pipeline (`esbuild` for extension host, Vite for Vue 3 webview) outputting `dist/extension.js` and `dist/webview/`.
- [ ] Create `.vscode/launch.json` and `.vscode/tasks.json` enabling one-click `F5` debugging in the VS Code Extension Development Host.
- [ ] Implement a minimal entrypoint `extension.ts` with a placeholder Vue 3 Webview panel verifying component rendering in the debug host.
- [ ] Document build and run instructions in `packages/vscode-extension/README.md`.
- [ ] Verify existing root test suite and typechecks continue passing (`bun test && bun run typecheck`).
