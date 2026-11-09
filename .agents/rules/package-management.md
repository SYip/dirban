---
trigger: model_decision
description: "Rules for package management and CLI tool execution: enforce mise for runtime version management, forbid unpinned/unaudited on-the-fly execution tools (npx, bunx), and enforce explicit pinned dependencies."
---

# Package Management & Tool Execution Standards

## 1. Runtime Management with `mise`
* **Use `mise` for environment and runtime management**:
  * The project standard runtimes (`bun`, `node`) are declared and version-pinned in [`mise.toml`](file:///Users/andrew/Projects/dirban/mise.toml).
  * Use `mise install` to install or sync toolchains.
  * Execute commands through `mise exec -- <command>` (or active mise shell environment) to ensure exact pinned runtime versions are used across developer machines and sub-packages.

## 2. Absolute Prohibition of `npx` and `bunx`
* **Never use `npx` or `bunx` to execute packages or binaries**:
  * ❌ `npx <package>`
  * ❌ `bunx <package>`
* **Rationale**:
  * Both `npx` and `bunx` pull and execute the latest unpinned, unaudited package versions from the npm registry by default when not installed or version-locked.
  * Running arbitrary latest packages poses supply-chain security risks, breaks reproducibility across developer environments, and bypasses local lockfile audit checks.

## 3. Mandatory Local Development Dependencies
* Any CLI tool, bundler, compiler, or utility required by scripts, tasks, or agents must be explicitly declared as a dependency or `devDependency` in `package.json`.
* Always pin versions in `package.json` (e.g., `^1.2.3` or exact) and commit the corresponding lockfile (`bun.lock`).

## 4. Approved Execution Commands
* Execute local package binaries using local npm/bun run scripts or direct workspace resolution:
  * ✅ `bun run <script>` (e.g. `bun run typecheck`, `bun run build`)
  * ✅ `bun run <bin>` (resolves binaries from local `node_modules/.bin`)
  * ✅ `./node_modules/.bin/<bin>`
  * ✅ `mise exec -- <command>`
