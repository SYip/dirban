---
okf_version: "1.0"
id: "okf.dirban.architecture.progressive-enhancement-optional-dependencies"
title: "ADR: Progressive Enhancement & Optional Dependencies (Filesystem as Foundation, Git & VS Code as Optional Accelerators)"
type: "architecture-decision"
status: "accepted"
owner: "developer"
last_updated: "2026-11-07"
tags:
  - architecture
  - decisions
  - dependencies
  - git
  - vscode
  - filesystem
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "spec.md"
    - "docs/concepts/why-dirban.md"
    - "docs/decisions/2026-10-12-plain-markdown-and-git-audit.md"
---

# Architecture Decision Record: Progressive Enhancement & Optional Dependencies (Git & VS Code as Optional Accelerators)

## 1. Context & Problem Statement

Dirban provides Kanban task management centered around directory paths and plain Markdown documents. As we design advanced features—such as `dirban current` (focus view), `dirban start` (worktree / branch provisioning), and VS Code workspace integration—an essential architectural principle must be defined:

**Should Git and VS Code be required dependencies of Dirban, or should the engine remain 100% functional on the raw filesystem alone?**

---

## 2. Decision Drivers

- **Zero Lock-In & Total Longevity**: Task boards must survive and remain fully usable even in environments without Git (e.g., zip downloads, air-gapped systems, containerized CI runners, Dropbox / Syncthing folders, non-git directories).
- **Zero Process Coupling**: Core card reading, writing, moving, and checking should not fail or throw errors if the `git` binary is missing from `PATH`.
- **Progressive Enhancement**: When Git and VS Code are present, Dirban should seamlessly leverage them to enhance developer ergonomics, eliminate context switches, and prevent branch collisions.
- **Single Source of Truth**: The filesystem directory structure is the ultimate arbiter of state. Tools and editors are lenses, not gatekeepers.

---

## 3. Decision: The Tiered Architectural Hierarchy

We adopt a strict **Progressive Enhancement** model:

```
┌────────────────────────────────────────────────────────┐
│ Tier 3: Editor Accelerators (VS Code Extension / TUI)  │  (Optional UI Lens)
├────────────────────────────────────────────────────────┤
│ Tier 2: VCS Accelerators (Git Worktrees & Branches)   │  (Optional Workflow)
├────────────────────────────────────────────────────────┤
│ Tier 1: Filesystem & Markdown Engine (OS & node:fs)    │  (Mandatory Foundation)
└────────────────────────────────────────────────────────┘
```

### Tier 1: Filesystem & Markdown Engine (Mandatory Foundation)
- **100% Self-Sufficient**: The core engine requires only the file system (`node:fs` / Bun runtime).
- All primary board operations (`init`, `board`, `view`, `new`, `move`, `check`, `set`, `archive`) operate strictly on disk directories and files.
- If Git is not installed or the directory is not a Git repository, **every core command continues to work without degradation**.

### Tier 2: Git as an Optional Accelerator
- **Audit Logging**: Git naturally acts as the immutable event log (`git log --follow`) without requiring in-file execution journal churn.
- **Branch-Aware Focus (`dirban current`)**:
  - **Filesystem First**: Inspects the physical `02-doing` (or active) column. If exactly 1 task is present, it is resolved in $O(1)$ time with zero subprocess calls.
  - **Git as Tie-Breaker**: If Git is available and multiple tasks are in progress, Dirban checks `git rev-parse --abbrev-ref HEAD` to automatically match the active branch name (e.g., `task/26-003`). If Git is absent or fails, it cleanly falls back to manual selection without error.
- **Lifecycle Provisioning (`dirban start` / `dirban worktree`)**:
  - `dirban start <id>` moves the card to `02-doing` on the filesystem.
  - If `--checkout` or `--worktree` is invoked:
    - If Git is present: provisions the branch or worktree directory.
    - If Git is not installed or the workspace is not a Git repository: gracefully notifies the user (`"Git repository not detected; card moved to doing on filesystem only."`) without crashing.

### Tier 3: VS Code as an Optional Accelerator
- **Configuration Discovery**:
  - Dirban checks for `.dirban.json` first.
  - If absent, it checks `.vscode/settings.json` for `"dirban.*"` keys as a zero-config convenience for VS Code users.
  - If `.vscode/` does not exist, it defaults cleanly to standard defaults or `.dirban.json`.
- **Editor Integration (`dirban view --open`)**:
  - Attempts to launch `$EDITOR` or `code`. If neither exists, it prints the full formatted task detail to stdout without blocking.
- **VS Code Extension**:
  - The extension is merely a visual TreeDataProvider reading the filesystem folders. It does not introduce proprietary database formats or alter markdown schemas.

---

## 4. Consequences & Guarantees

### Positive Consequences
1. **Air-Gapped & Minimal Environments**: Dirban runs cleanly inside Docker scratch images, serverless runners, or non-git workspaces.
2. **Deterministic Fallbacks**: Every Git or VS Code integration has an immediate filesystem equivalent (`02-doing/` folder, `.dirban.json`, terminal stdout).
3. **Graceful Degradation**: Process spawns for `git` commands are wrapped in error boundaries; a broken Git index or detached HEAD never corrupts task files.

### Negative Consequences
1. Engine features that rely on Git (e.g. worktree isolation) must explicitly implement detection checks (`isGitRepository()`) and informative fallback messages.

---

## 5. Summary Table

| Capability | Tier 1: Filesystem Only | Tier 2: With Git | Tier 3: With VS Code |
|---|---|---|---|
| **Board & Tasks** | Ordinary directories & `.md` files | Version-controlled with full history | Graphical sidebar tree view |
| **Active Task Focus** | Resolved via `02-doing` directory | Resolved via active Git branch | Active editor tab / tree badge |
| **Task Claiming (`start`)** | Physical move to `02-doing` | Automatic branch or worktree isolation | Command palette action |
| **Config Storage** | `.dirban.json` | `.dirban.json` (tracked in git) | Embedded in `.vscode/settings.json` |
| **Audit Trail** | Current state on disk | `git log --follow --stat` | GitLens / Source Control UI |

