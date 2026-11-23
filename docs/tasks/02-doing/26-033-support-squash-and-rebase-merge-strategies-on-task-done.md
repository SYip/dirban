---
id: "26-033"
title: "Support squash and rebase integration strategies on task done"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-10"
last_updated: "2026-11-10"
tags:
  - git
  - vcs
  - trunk-based-development
  - workflow
relationships:
  depends_on: []
  blocks: []
  related_to:
    - "docs/concepts/git-workflow.md"
    - "src/vcs/git.ts"
    - "src/workspace/types.ts"
---

# Support squash and rebase integration strategies on task done

Currently, `dirban done` defaults to standard `--no-ff` merge commits (`git merge --no-ff`). While this records branch ancestry, trunk-based development workflows often demand a clean, linear git history with one atomic squashed commit per completed task.

We should introduce configurable Git integration strategies (`squash`, `rebase`, `merge`) both via configuration (`.dirban.json`) and CLI flags (`dirban done --squash`, `dirban done --rebase`).

## Objectives & Scope

1. **Configurable Integration Strategy**:
   - Add `mergeStrategy?: "squash" | "rebase" | "merge"` to `DirbanConfig` schema (defaulting to `"merge"` for backward compatibility, or `"squash"` if configured).
   - Support CLI override flags on `dirban done`: `--squash`, `--rebase`, `--no-ff` (or `--merge`).

2. **VCS Execution Implementation (`src/vcs/git.ts`)**:
   - **Squash Mode (`squash`)**:
     - `git checkout <baseBranch>`
     - `git merge --squash <taskBranch>`
     - `git commit -m "<commitMsg>"` (using task ID & title, e.g. `feat: 26-001 <title>`)
     - Delete local task branch: `git branch -D <taskBranch>`.
   - **Rebase Mode (`rebase`)**:
     - Rebase task branch onto trunk: `git checkout <taskBranch> && git rebase <baseBranch>`.
     - Fast-forward trunk: `git checkout <baseBranch> && git merge --ff-only <taskBranch>`.
     - Delete local task branch: `git branch -d <taskBranch>`.
   - **Worktree Handling**:
     - Support equivalent rebase and squash operations when completing from an isolated worktree before `git worktree remove`.

3. **Conflict Handling & Guardrails**:
   - Cleanly abort and report actionable messages if rebase or squash encounters merge conflicts (e.g. `git merge --abort` or `git rebase --abort`).

4. **Testing**:
   - Vector tests verifying strategy resolution (`resolveWorkspaceStrategy`).
   - Mocked/unit tests verifying git CLI invocations for `squash`, `rebase`, and standard `merge`.

## Acceptance Criteria
- [ ] `DirbanConfig` accepts `mergeStrategy` with `"squash" | "rebase" | "merge"`.
- [ ] `dirban done --squash` integrates changes as a single squashed commit into base branch.
- [ ] `dirban done --rebase` rebases task branch onto base branch and fast-forwards.
- [ ] Automatic fallback and clean error propagation if rebase or merge conflicts occur.
- [ ] Unit and vector tests pass in `src/workspace/strategy.test.ts`.
- [ ] Documentation updated in `docs/concepts/git-workflow.md` and `docs/concepts/configuration.md`.
