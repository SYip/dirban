---
okf_version: "1.0"
id: "okf.dirban.concepts.forget-about-dirban"
title: "Forget About Dirban: Zero Lock-In & Plain Shell Equivalents"
type: "concept"
status: "accepted"
owner: "developer"
last_updated: "2026-11-10"
tags:
  - philosophy
  - unix
  - shell
  - zero-lock-in
  - cli-equivalents
relationships:
  depends_on: []
  supersedes: []
  related_to:
    - "docs/concepts/why-dirban.md"
    - "docs/concepts/git-workflow.md"
    - "docs/cli-reference.md"
---

# Forget About Dirban: The Native Shell Equivalent Guide

## The Core Premise: Zero Lock-In

> **You can stop using Dirban at any moment without changing a single file.**

Dirban uses no databases, background daemons, or proprietary sync protocols. Tasks are standard Markdown files, and workflow columns are plain directories. Moving a task between stages is just moving a file (`mv`).

If you prefer managing work with standard shell commands (`mv`, `ls`, `cat`), Finder, or VS Code Explorer, every task operation maps directly to standard POSIX tools and Git primitives. If Dirban were uninstalled tomorrow, your board remains 100% intact, readable, and editable with standard Unix tools.

---

## Complete Command & Shell Equivalent Matrix

Dirban operates in three simple **Workflow Modes**:
1. **Folder Mode (Directory-Only)**: Pure filesystem movement without Git branch manipulation (`--strategy=none` or unversioned folders).
2. **Branch Mode (Default)**: Automatically checks out a short-lived `task/<id>-<slug>` Git branch in your working directory and auto-merges it back to trunk on completion.
3. **Worktree Mode**: Runs each task in an isolated workspace under `.worktrees/` (`--strategy=worktree`), enabling seamless parallel multitasking and agent execution without disturbing your active editor directory.

Below, commands are organized into **Board & Task Management** (shared across all modes), followed by mode-specific lifecycle equivalents for **Folder Mode**, **Branch Mode**, and **Worktree Mode**.

---

### 1. General Board & Task Management (Shared Across All Modes)

| Dirban Command | What Dirban Does | Pure Shell Equivalent |
| :--- | :--- | :--- |
| **`dirban init`** | Creates folder structure & `.gitkeep` files | `mkdir -p docs/tasks/{backlog,01-todo,02-doing,03-done,archive} && touch docs/tasks/{backlog,01-todo,02-doing,03-done,archive}/.gitkeep` |
| **`dirban board --static`** | Lists all tasks grouped by column | `for col in docs/tasks/*/; do echo "=== $(basename "$col") ==="; ls -1 "$col"*.md 2>/dev/null; done` |
| **`dirban current`** / **`focus`** | Inspects active task in progress | `ls -1 docs/tasks/02-doing/` |
| **`dirban next`** | Finds highest priority task from `01-todo` | `grep -rn "priority: \"p0\"" docs/tasks/01-todo/ \| head -n 1 \| cut -d: -f1` *(fallback to p1, p2)* |
| **`dirban new "<title>"`** | Creates a new Markdown file with frontmatter | `cat << 'EOF' > docs/tasks/00-backlog/26-001-my-task.md`<br>`---`<br>`id: "26-001"`<br>`title: "My Task"`<br>`priority: "p2"`<br>`---`<br>`# My Task`<br>`## Acceptance Criteria`<br>`- [ ] Task item`<br>`EOF` |
| **`dirban next-id`** | Computes the next sequential ID for the year | `printf "%02d-%03d\n" $(date +%y) $(( $(find docs/tasks -name "[0-9][0-9]-[0-9][0-9][0-9]*" \| wc -l) + 1 ))` |
| **`dirban move <id> <col>`** | Moves a task file into a target column folder | `mv docs/tasks/*/26-001*.md docs/tasks/<col>/` |
| **`dirban ready <id>`** | Moves task from `backlog` into `01-todo` | `mv docs/tasks/00-backlog/26-001*.md docs/tasks/01-todo/` |
| **`dirban view <id>`** | Renders task metadata, criteria, and body | `cat docs/tasks/*/26-001*.md` |
| **`dirban check <id> <n>`** | Toggles $n$-th checkbox item to `[x]` | Edit file in editor or via `sed`: `sed -i '' 's/- \[ \]/- \[x\]/1' docs/tasks/*/26-001*.md` |
| **`dirban set <id> --priority=p1`** | Updates frontmatter variable | Edit file in editor or via `sed -i '' 's/priority: .*/priority: "p1"/' file.md` |
| **`dirban archive <id>`** | Moves task to historical partitioned archive directory | `mkdir -p docs/tasks/04-archive/$(date +%Y) && mv docs/tasks/03-done/26-001*.md docs/tasks/04-archive/$(date +%Y)/` |
| **`dirban plan`** | Separates backlog tasks by dependency status | `grep -rn "depends_on:" docs/tasks/00-backlog/` |
| **`dirban block <id> <reason>`** | Adds blocker reason and moves to `backlog` | Edit `relationships.depends_on` and `mv docs/tasks/*/26-001*.md docs/tasks/00-backlog/` |
| **`dirban unblock <id> <reason>`** | Removes dependency entry from frontmatter | Edit frontmatter to clear `depends_on` item |
| **`dirban path <id>`** | Resolves task file path | `find docs/tasks -name "26-001*.md"` |

---

### 2. Folder Mode (Directory-Only, No Git Branching)

Ideal for non-Git directories, fast prototyping, or managing tasks without branch branching.

| Lifecycle Action | Dirban Command | Pure Shell Equivalent |
| :--- | :--- | :--- |
| **Start task** | `dirban start 26-001 --strategy=none` | `mv docs/tasks/*/26-001*.md docs/tasks/02-doing/` |
| **Inspect focus** | `dirban current` | `ls -1 docs/tasks/02-doing/` |
| **Complete task** | `dirban done 26-001` | `mv docs/tasks/02-doing/26-001*.md docs/tasks/03-done/` |

---

### 3. Branch Mode (In-Place Git Checkout, Default)

Ideal for single-developer trunk-based workflows where in-place branch checkout is preferred.

| Lifecycle Action | Dirban Command | Pure Git & Shell Equivalent |
| :--- | :--- | :--- |
| **Start task** | `dirban start 26-001` | `mv docs/tasks/*/26-001*.md docs/tasks/02-doing/ && git checkout -b task/26-001-my-task main` |
| **Inspect focus** | `dirban current` | `git branch --show-current && ls -1 docs/tasks/02-doing/` |
| **Complete task (auto-merge)** | `dirban done` | `mv docs/tasks/02-doing/26-001*.md docs/tasks/03-done/ && git checkout main && git merge --no-ff task/26-001-my-task && git branch -d task/26-001-my-task` |
| **Complete task (preserve branch for PR)** | `dirban done --no-merge` | `mv docs/tasks/02-doing/26-001*.md docs/tasks/03-done/` *(task branch retained; ready for `git push origin task/...`)* |

---

### 4. Worktree Mode (Parallel Workspace Isolation)

Ideal for parallel execution, agent sandboxing, and zero-disruption context switching.

| Lifecycle Action | Dirban Command | Pure Git & Shell Equivalent |
| :--- | :--- | :--- |
| **Start task** | `dirban start 26-001 --worktree` | `mv docs/tasks/*/26-001*.md docs/tasks/02-doing/ && git worktree add .worktrees/26-001 -b task/26-001-my-task main` |
| **Inspect focus / path** | `dirban path 26-001` | `echo "$PWD/.worktrees/26-001"` *(or `git worktree list`)* |
| **Complete task (auto-merge & cleanup)** | `dirban done` *(inside worktree)* | `mv docs/tasks/02-doing/26-001*.md docs/tasks/03-done/ && git -C <main-repo> merge --no-ff task/26-001-my-task && git worktree remove .worktrees/26-001 && git branch -d task/26-001-my-task` |
| **Complete task (keep worktree for review)** | `dirban done --no-merge` | `mv docs/tasks/02-doing/26-001*.md docs/tasks/03-done/` *(worktree and branch retained)* |

---

## Detailed Walkthroughs: Doing Common Tasks Without Dirban

### 1. Creating and Starting a Task

```bash
# 1. Create the task file in backlog
cat << 'EOF' > docs/tasks/00-backlog/26-001-user-auth.md
---
id: "26-001"
title: "Implement user auth"
priority: "p1"
---

# Implement user auth

## Acceptance Criteria
- [ ] Implement password hashing
- [ ] Add JWT signing
- [ ] Add integration test vectors
EOF

# 2. Pick it up and start work
mv docs/tasks/00-backlog/26-001-user-auth.md docs/tasks/02-doing/
git checkout -b task/26-001-user-auth main
```

---

### 2. Checking Work-in-Progress (WIP)

You never need a special command to know what's in progress:

```bash
# Instant O(1) query for active work
ls -1 docs/tasks/02-doing/
```

---

### 3. Completing Work

```bash
# 1. Check off criteria in your editor (or commit directly)
# 2. Move file to done
mv docs/tasks/02-doing/26-001-user-auth.md docs/tasks/03-done/

# 3. Integrate back into trunk
git checkout main
git merge --no-ff task/26-001-user-auth
git branch -d task/26-001-user-auth
```

---

## Why Use the `dirban` CLI at All?

If standard shell commands can do everything, why use `dirban`?

1. **Velocity & Convenience**: Instead of running 3 Git and `mv` commands each time, `dirban start 26-001` or `dirban done` does it in 1 command with error checks.
2. **Interactive TUI**: `dirban board` provides an interactive terminal Kanban UI with hotkey navigation, live column filtering, and instant card previews.
3. **Checklist Parsing**: Dirban automatically calculates acceptance criteria completion badges (`[3/5] 60%`) without opening individual files.
4. **Validation & Invariants**: Prevents invalid transitions (e.g. accidentally skipping execution columns or creating duplicate IDs).
5. **IDE Integration**: Shared TypeScript engine powers the official VS Code Extension (Kanban Webview, TreeViews, and status bar integration).

Use `dirban` when you want interactive terminal boards, criteria badges, and Git lifecycle automation. Use standard Unix commands whenever you want to script or inspect raw files. The underlying data is identical either way.
