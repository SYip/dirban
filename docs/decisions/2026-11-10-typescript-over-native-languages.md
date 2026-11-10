---
okf_version: "1.0"
id: "okf.dirban.decision.typescript-over-native-languages"
title: "Selection of TypeScript and Bun Over Systems Languages (Rust, Go, C++)"
type: "decision"
status: "accepted"
owner: "developer"
last_updated: "2026-11-10"
tags:
  - architecture
  - runtime
  - languages
  - vscode
  - performance
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "docs/concepts/why-dirban.md"
    - "spec.md"
---

# Selection of TypeScript and Bun Over Systems Languages (Rust, Go, C++)

## 1. Context & Problem Statement

When building a developer CLI tool, systems languages such as Rust, Go, or Zig are common choices because they compile directly to standalone native binaries and offer sub-millisecond execution times.

However, Dirban is designed from day one to provide two synchronized interfaces:
1. A fast terminal CLI and interactive TUI (`dirban board`).
2. A first-class **VS Code extension** featuring a sidebar Focus View, reactive status bar badges, and an embedded Webview Kanban board.

We evaluated whether to author the core engine in a systems language (Rust or Go) versus TypeScript on modern runtimes (Bun and Node).

---

## 2. Decision

We chose **TypeScript (using Bun for runtime execution and native standalone binary compilation)** as the sole implementation language for both the Dirban CLI engine and the VS Code extension.

---

## 3. Rationale

### A. 100% Zero-Bridge Code Sharing with the VS Code Extension
- The VS Code extension host and Webview environments run strictly on JavaScript/TypeScript.
- By implementing the core Markdown parser, filesystem watchers, board discovery, and task lifecycle operations in TypeScript, the VS Code extension imports the exact same domain code as the CLI (`packages/vscode-extension` imports directly from the core monorepo packages).
- Choosing Rust, Go, or C++ would require either:
  1. Maintaining two duplicate codebases (one in Rust for the CLI, one in TypeScript for the extension).
  2. Compiling the core engine to WebAssembly (WASM) and managing complex, brittle FFI bridges across Node and browser Webview contexts.

### B. Pragmatic Scale: Projects Have Hundreds of Tasks, Not Millions
- Benchmark comparisons showcasing Rust or C++ parsing millions of files per second are irrelevant to Dirban's problem domain.
- Dirban is designed for solo builders and small teams ($\le 5$). A real-world repository board rarely contains more than a few dozen active tasks and a few hundred archived notes.
- On modern JavaScript runtimes (V8 and JavaScriptCore via Bun), parsing a few hundred Markdown files takes single-digit milliseconds—orders of magnitude faster than human perception or terminal rendering.
- Sacrificing developer ergonomics and zero-bridge code sharing for micro-benchmark advantages on 100,000 files solves a problem that small teams do not have.

### C. Standalone Native Executable Compilation via Bun
- Using `bun build --compile`, TypeScript source compiles into a self-contained, standalone native binary (`dirban`) requiring no Node, Bun, or external runtime on the user's machine.
- This gives users the deployment convenience of a native Go/Rust binary while retaining TypeScript's shared ecosystem advantages.

---

## 4. Consequences & Trade-offs

- **Memory Baseline**: A Bun-compiled binary carries a higher baseline memory footprint (~30–50MB) compared to a bare C/Rust binary (~5–10MB). This is completely acceptable for a local developer tool.
- **Cross-Compilation**: Native standalone binaries must be built per target OS/architecture (macOS arm64/x64, Linux arm64/x64) via GitHub Actions CI.
- **Architecture Simplicity**: Zero duplicate domain logic across CLI and VS Code extension; bug fixes and feature additions immediately benefit both interfaces.
