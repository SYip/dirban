import { describe, expect, it } from "bun:test"
import { ok } from "neverthrow"
import * as path from "node:path"
import * as fs from "node:fs"
import * as os from "node:os"
import { DEFAULT_CONFIG } from "../config/config.ts"
import type { DirbanConfig } from "../config/types.ts"
import { discoverBoard } from "../board/discovery.ts"
import { moveTask } from "./move.ts"
import { checkTaskItem } from "./check.ts"
import { setTaskMetadata } from "./set.ts"
import { archiveTasks } from "./archive.ts"
import { calculateNextTaskId, createTask } from "./create.ts"
import { initializeBoard } from "./init.ts"
import { resolveCurrentTask } from "./current.ts"
import { startTask } from "./start.ts"
import { doneTask } from "./done.ts"
import { blockTask, unblockTask } from "./block.ts"
import { partitionBacklog, promoteTask, promoteTasks } from "./plan.ts"
import { evaluateTaskBlockers, isDependencyResolved } from "../board/dependencies.ts"
import {
  GitVcsProvider,
  NoopVcsProvider,
  getVcsProvider,
  parseGitWorktreeListPorcelain,
  type VersionControlProvider,
} from "../vcs/index.ts"

const SAMPLE_TASK = `---
okf_version: "1.0"
id: "task.26-001"
title: "Sample Task"
type: "task"
status: "backlog"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-10-10"
last_updated: "2026-10-10"
tags: []
relationships:
  depends_on: []
  blocks: []
  related_to: []
---

# Task: Sample Task

## 1. Objective & Scope
Test all operations.

## 2. Acceptance Criteria
- [ ] First criterion
- [ ] Second criterion

## 3. Verification Plan
\`\`\`bash
bun test
\`\`\`

## 4. Execution Journal
- **2026-10-10**: Initialized.
`

describe("Task Operations Domain Tests", () => {
  it("Vector 1 (Move): Moves card across columns physically without mutating file content", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "00-backlog"), { recursive: true })
      fs.mkdirSync(path.join(tasksDir, "01-ready"), { recursive: true })
      fs.writeFileSync(
        path.join(tasksDir, "00-backlog/26-001.md"),
        SAMPLE_TASK,
        "utf-8",
      )

      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isOk()) {
        const moveRes = moveTask(boardRes.value, "26-001", "01-ready")
        expect(moveRes.isOk()).toBe(true)
        if (moveRes.isOk()) {
          expect(moveRes.value.column).toBe("01-ready")
          expect(moveRes.value.document.frontmatter.status).toBe("01-ready")
          // Check old file is deleted and new file exists
          expect(fs.existsSync(path.join(tasksDir, "00-backlog/26-001.md"))).toBe(false)
          expect(fs.existsSync(moveRes.value.filePath)).toBe(true)
          // Preserves original file content without journal injection
          const newContent = fs.readFileSync(moveRes.value.filePath, "utf-8")
          expect(newContent).toBe(SAMPLE_TASK)
        }
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 2 (Check): Toggles acceptance criteria checkbox item", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "00-backlog"), { recursive: true })
      fs.writeFileSync(
        path.join(tasksDir, "00-backlog/26-001.md"),
        SAMPLE_TASK,
        "utf-8",
      )

      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isOk()) {
        const checkRes = checkTaskItem(boardRes.value, "26-001", 1)
        expect(checkRes.isOk()).toBe(true)
        if (checkRes.isOk()) {
          expect(
            checkRes.value.document.acceptanceCriteria[0]?.checked,
          ).toBe(true)
          const content = fs.readFileSync(checkRes.value.filePath, "utf-8")
          expect(content.includes("- [x] First criterion")).toBe(true)
        }
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 3 (Set): Mutates priority, assignee and tags", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "00-backlog"), { recursive: true })
      fs.writeFileSync(
        path.join(tasksDir, "00-backlog/26-001.md"),
        SAMPLE_TASK,
        "utf-8",
      )

      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isOk()) {
        const setRes = setTaskMetadata(boardRes.value, "26-001", {
          priority: "p0",
          assignee: "andrew",
          tags: ["urgent", "core"],
        })
        expect(setRes.isOk()).toBe(true)
        if (setRes.isOk()) {
          expect(setRes.value.document.frontmatter.priority).toBe("p0")
          expect(setRes.value.document.frontmatter.assigned_to).toBe("andrew")
          expect(setRes.value.document.frontmatter.tags).toEqual([
            "urgent",
            "core",
          ])
        }
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 4 (Archive): Places completed tasks flat into archive/", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "03-done"), { recursive: true })
      fs.writeFileSync(
        path.join(tasksDir, "03-done/26-001.md"),
        SAMPLE_TASK,
        "utf-8",
      )

      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isOk()) {
        const archiveRes = archiveTasks(
          boardRes.value,
          DEFAULT_CONFIG,
          "all",
          tempDir,
        )
        expect(archiveRes.isOk()).toBe(true)
        if (archiveRes.isOk()) {
          expect(archiveRes.value.archivedTasks.length).toBe(1)
          const targetDir = archiveRes.value.targetDirectory
          expect(targetDir.endsWith(path.join("docs", "tasks", "archive"))).toBe(true)
          expect(fs.existsSync(path.join(targetDir, "26-001.md"))).toBe(true)
        }
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 5 (Next ID): Calculates next YY-001 ID from existing board tasks", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "00-backlog"), { recursive: true })
      fs.mkdirSync(path.join(tasksDir, "01-ready"), { recursive: true })

      // Empty board: defaults to 26-001 (for year 2026)
      const fixedDate = new Date("2026-10-26T12:00:00Z")
      let boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isOk()) {
        expect(calculateNextTaskId(boardRes.value, fixedDate)).toBe("26-001")
      }

      // Add task with 26-001
      fs.writeFileSync(
        path.join(tasksDir, "00-backlog/26-001-task.md"),
        SAMPLE_TASK,
        "utf-8",
      )

      // Add task with 26-009
      fs.writeFileSync(
        path.join(tasksDir, "01-ready/26-009-another.md"),
        SAMPLE_TASK.replace("task.26-001", "task.26-009"),
        "utf-8",
      )

      boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isOk()) {
        // Next should be 26-010
        expect(calculateNextTaskId(boardRes.value, fixedDate)).toBe("26-010")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 6 (Create Task): Creates markdown task with generated ID and frontmatter", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "00-backlog"), { recursive: true })
      fs.mkdirSync(path.join(tasksDir, "01-ready"), { recursive: true })

      const fixedDate = new Date("2026-10-26T12:00:00Z")
      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isOk()) {
        const createRes = createTask(
          boardRes.value,
          {
            title: "Implement OAuth2 login flow",
            column: "01-ready",
            priority: "p1",
            tags: ["auth", "security"],
            criteria: ["Configure OAuth client", "Add callback route"],
          },
          fixedDate,
        )

        expect(createRes.isOk()).toBe(true)
        if (createRes.isOk()) {
          expect(createRes.value.id).toBe("26-001")
          expect(createRes.value.column).toBe("01-ready")
          expect(createRes.value.filename).toBe(
            "26-001-implement-oauth2-login-flow.md",
          )
          expect(fs.existsSync(createRes.value.filePath)).toBe(true)

          const writtenContent = fs.readFileSync(
            createRes.value.filePath,
            "utf-8",
          )
          expect(writtenContent.includes('id: "26-001"')).toBe(true)
          expect(writtenContent.includes('priority: "p1"')).toBe(true)
          expect(writtenContent.includes("- auth")).toBe(true)
          expect(writtenContent.includes("- [ ] Configure OAuth client")).toBe(
            true,
          )
        }
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 7 (Init): Initializes directory tree according to config and writes .dirban.json", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-init-"))
    try {
      const initRes = initializeBoard(DEFAULT_CONFIG, tempDir)
      expect(initRes.isOk()).toBe(true)
      if (initRes.isOk()) {
        expect(fs.existsSync(path.join(tempDir, "docs/tasks"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/backlog"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/01-todo"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/02-doing"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/03-done"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/archive"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/backlog/.gitkeep"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/01-todo/.gitkeep"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/02-doing/.gitkeep"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/03-done/.gitkeep"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, "docs/tasks/archive/.gitkeep"))).toBe(true)
        expect(fs.existsSync(path.join(tempDir, ".dirban.json"))).toBe(true)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 8 (Init in VSCode workspace): Automatically updates .vscode/settings.json when .vscode exists", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-init-"))
    try {
      const vscodeDir = path.join(tempDir, ".vscode")
      fs.mkdirSync(vscodeDir, { recursive: true })
      fs.writeFileSync(
        path.join(vscodeDir, "settings.json"),
        JSON.stringify({ "editor.tabSize": 4 }),
        "utf-8",
      )

      const initRes = initializeBoard(DEFAULT_CONFIG, tempDir)
      expect(initRes.isOk()).toBe(true)
      if (initRes.isOk()) {
        expect(fs.existsSync(path.join(tempDir, ".dirban.json"))).toBe(false)
        const updatedSettings = JSON.parse(
          fs.readFileSync(path.join(vscodeDir, "settings.json"), "utf-8"),
        )
        expect(updatedSettings["editor.tabSize"]).toBe(4)
        expect(updatedSettings["dirban.tasksDir"]).toBe("docs/tasks")
        expect(updatedSettings["dirban.defaultPriority"]).toBe("p2")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 9 (Git helper functions & VCS Providers): Derives deterministic branch names, worktree paths, and extracts IDs", () => {
    const gitProvider = new GitVcsProvider()
    expect(gitProvider.deriveBranchName("task/", "26-003", "git-workflow")).toBe("task/26-003-git-workflow")
    expect(gitProvider.deriveBranchName("feature", "26-003", "my Feature!")).toBe("feature/26-003-my-feature")
    expect(gitProvider.deriveBranchName("task/", "26-003", "")).toBe("task/26-003")

    const derivedPath = gitProvider.deriveWorktreePath(
      "/Users/alice/projects/dirban",
      "../.{repo}.worktrees",
      "26-003",
      "my-task",
    )
    expect(derivedPath).toBe("/Users/alice/projects/.dirban.worktrees/26-003-my-task")

    expect(gitProvider.extractTaskId("task/26-003-my-feature")).toBe("26-003")
    expect(gitProvider.extractTaskId("26-003-my-feature")).toBe("26-003")
    expect(gitProvider.extractTaskId("26-003")).toBe("26-003")
    expect(gitProvider.extractTaskId("main")).toBe(null)
    expect(gitProvider.extractTaskId(undefined, "/path/to/.dirban.worktrees/26-003-git-flow")).toBe("26-003")

    const noopProvider = new NoopVcsProvider()
    expect(noopProvider.getContext().isAvailable).toBe(false)
    expect(noopProvider.extractTaskId("task/26-003-foo")).toBe(null)
    expect(noopProvider.resolveWorktreePath("26-003").isErr()).toBe(true)

    // Worktree porcelain parsing
    const samplePorcelain = `worktree /Users/alice/projects/dirban\nHEAD 1234\nbranch refs/heads/main\n\nworktree /Users/alice/projects/.dirban.worktrees/26-003-my-task\nHEAD 5678\nbranch refs/heads/task/26-003-my-task\n`
    const parsedEntries = parseGitWorktreeListPorcelain(samplePorcelain)
    expect(parsedEntries.length).toBe(2)
    expect(parsedEntries[0]?.path).toBe("/Users/alice/projects/dirban")
    expect(parsedEntries[0]?.branchRef).toBe("refs/heads/main")
    expect(parsedEntries[1]?.path).toBe("/Users/alice/projects/.dirban.worktrees/26-003-my-task")
    expect(parsedEntries[1]?.branchRef).toBe("refs/heads/task/26-003-my-task")

    // resolveWorktreePath for main in active git repo
    const mainPathRes = gitProvider.resolveWorktreePath("main")
    expect(mainPathRes.isOk()).toBe(true)
    if (mainPathRes.isOk()) {
      expect(mainPathRes.value).toBe(process.cwd())
    }
  })

  it("Vector 10 (Current task resolution): Explicit ID, Doing column, and priority fallback", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-current-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isErr()) return

      // Non-git directory: 0 tasks in doing -> NO_ACTIVE_TASK
      const res0 = resolveCurrentTask(boardRes.value, DEFAULT_CONFIG, undefined, tempDir)
      expect(res0.isErr()).toBe(true)
      if (res0.isErr()) {
        expect(res0.error.message).toBe("No task currently in progress.")
      }

      // Create a task in 01-todo and an explicit lookup
      const create1 = createTask(boardRes.value, {
        title: "Task One",
        priority: "p2",
        column: "01-todo",
      })
      expect(create1.isOk()).toBe(true)
      if (create1.isErr()) return

      const boardAfter1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const explicitRes = resolveCurrentTask(boardAfter1, DEFAULT_CONFIG, create1.value.id, tempDir)
      expect(explicitRes.isOk()).toBe(true)
      if (explicitRes.isOk()) {
        expect(explicitRes.value.source).toBe("explicit")
        expect(explicitRes.value.task.document.id).toBe(create1.value.id)
      }

      // Move Task 1 to 02-doing -> single doing task
      moveTask(boardAfter1, create1.value.id, "02-doing")
      const boardAfterMove = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const res1 = resolveCurrentTask(boardAfterMove, DEFAULT_CONFIG, undefined, tempDir)
      expect(res1.isOk()).toBe(true)
      if (res1.isOk()) {
        expect(res1.value.source).toBe("doing-column")
        expect(res1.value.multipleInDoing).toBe(false)
        expect(res1.value.task.document.id).toBe(create1.value.id)
      }

      // Add higher priority task to 02-doing -> picks highest priority (p0 over p2)
      createTask(boardAfterMove, {
        title: "High Priority Task",
        priority: "p0",
        column: "02-doing",
      })
      const boardAfter2 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const resMulti = resolveCurrentTask(boardAfter2, DEFAULT_CONFIG, undefined, tempDir)
      expect(resMulti.isOk()).toBe(true)
      if (resMulti.isOk()) {
        expect(resMulti.value.source).toBe("doing-column")
        expect(resMulti.value.multipleInDoing).toBe(true)
        expect(resMulti.value.doingCount).toBe(2)
        expect(resMulti.value.task.document.priority).toBe("p0")
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 11 (Start and Done lifecycle - non-git filesystem fallback): Transitions tasks cleanly", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-lifecycle-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isErr()) return

      const created = createTask(boardRes.value, {
        title: "Lifecycle Feature",
        priority: "p1",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardWithTask = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // 1. dirban start <id> in non-git directory
      const startRes = startTask(boardWithTask, DEFAULT_CONFIG, created.id, { cwd: tempDir })
      expect(startRes.isOk()).toBe(true)
      if (startRes.isOk()) {
        expect(startRes.value.task.column).toBe("02-doing")
        expect(startRes.value.gitSkipped).toBe(true)
        expect(startRes.value.branchName).toBe(`task/${created.id}-lifecycle-feature`)
      }

      // 1b. Guard check: starting a task when already on that branch fails with ALREADY_STARTED
      const baseNoop = new NoopVcsProvider()
      const mockGitVcs: VersionControlProvider = Object.assign(Object.create(baseNoop), {
        getContext: () => ({
          isAvailable: true,
          currentBranch: `task/${created.id}-lifecycle-feature`,
          repoRoot: tempDir,
          isWorktree: false,
        }),
      })
      const restartRes = startTask(boardWithTask, DEFAULT_CONFIG, created.id, {
        cwd: tempDir,
        vcsProvider: mockGitVcs,
      })
      expect(restartRes.isErr()).toBe(true)
      if (restartRes.isErr()) {
        expect(restartRes.error.kind).toBe("ALREADY_STARTED")
      }

      // 1c. Worktree guard check: starting with worktree strategy when worktree already exists fails
      const mockWorktreeVcs: VersionControlProvider = Object.assign(Object.create(baseNoop), {
        getContext: () => ({
          isAvailable: true,
          currentBranch: "main",
          repoRoot: tempDir,
          isWorktree: false,
        }),
        resolveWorktreePath: () => ok(path.join(tempDir, "existing-worktree")),
      })
      const startWorktreeRes = startTask(boardWithTask, DEFAULT_CONFIG, created.id, {
        cwd: tempDir,
        strategy: "worktree",
        vcsProvider: mockWorktreeVcs,
      })
      expect(startWorktreeRes.isErr()).toBe(true)
      if (startWorktreeRes.isErr()) {
        expect(startWorktreeRes.error.kind).toBe("ALREADY_STARTED")
      }

      // 2. dirban done in non-git directory without explicit ID (picks single doing task)
      const boardInDoing = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const doneRes = doneTask(boardInDoing, DEFAULT_CONFIG, undefined, { cwd: tempDir })
      expect(doneRes.isOk()).toBe(true)
      if (doneRes.isOk()) {
        expect(doneRes.value.task.column).toBe("03-done")
        expect(doneRes.value.gitSkipped).toBe(true)
        expect(doneRes.value.uncheckedCount).toBe(1)
      }

      // 3. Custom workflow with explicit focusColumn ("develop") and relative focus + 1 ("test")
      const customWorkflowConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        columns: ["todo", "develop", "test", "production"],
        focusColumn: "develop",
      }
      for (const col of customWorkflowConfig.columns) {
        fs.mkdirSync(path.join(tempDir, "docs/tasks", col), { recursive: true })
      }
      const boardCustom = discoverBoard(customWorkflowConfig, tempDir)._unsafeUnwrap()
      const customTask = createTask(boardCustom, {
        title: "Custom Flow Feature",
        column: "todo",
      })._unsafeUnwrap()

      const boardWithCustom = discoverBoard(customWorkflowConfig, tempDir)._unsafeUnwrap()
      const startCustomRes = startTask(boardWithCustom, customWorkflowConfig, customTask.id, { cwd: tempDir })
      expect(startCustomRes.isOk()).toBe(true)
      if (startCustomRes.isOk()) {
        expect(startCustomRes.value.task.column).toBe("develop")
      }

      // Verify current picks active task in "develop"
      const boardInDevelop = discoverBoard(customWorkflowConfig, tempDir)._unsafeUnwrap()
      const currentCustomRes = resolveCurrentTask(boardInDevelop, customWorkflowConfig, undefined, tempDir)
      expect(currentCustomRes.isOk()).toBe(true)
      if (currentCustomRes.isOk()) {
        expect(currentCustomRes.value.task.column).toBe("develop")
        expect(currentCustomRes.value.task.document.id).toBe(customTask.id)
      }

      // Verify done transitions task from "develop" to "test" (focus + 1)
      const doneCustomRes = doneTask(boardInDevelop, customWorkflowConfig, undefined, { cwd: tempDir })
      expect(doneCustomRes.isOk()).toBe(true)
      if (doneCustomRes.isOk()) {
        expect(doneCustomRes.value.task.column).toBe("test")
      }

      // 4. Zero-column workflow (columns: []): backlog -> archive transition
      const zeroColConfig: DirbanConfig = {
        ...DEFAULT_CONFIG,
        columns: [],
        focusColumn: undefined,
      }
      const boardZero = discoverBoard(zeroColConfig, tempDir)._unsafeUnwrap()
      const zeroTask = createTask(boardZero, {
        title: "Zero Column Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithZero = discoverBoard(zeroColConfig, tempDir)._unsafeUnwrap()
      const currentZeroRes = resolveCurrentTask(boardWithZero, zeroColConfig, undefined, tempDir)
      expect(currentZeroRes.isErr()).toBe(true)

      const doneZeroRes = doneTask(boardWithZero, zeroColConfig, zeroTask.id, { cwd: tempDir })
      expect(doneZeroRes.isOk()).toBe(true)
      if (doneZeroRes.isOk()) {
        expect(doneZeroRes.value.task.column).toContain("archive")
      }

      // 5. Strategy delegation verification in startTask and doneTask
      const customStrategyTrack: string[] = []
      const trackingStrategy = {
        name: "directory-only" as const,
        onStart: () => {
          customStrategyTrack.push("onStart")
          return ok({
            branchName: "custom/branch",
            strategy: "directory-only" as const,
            gitSkipped: true,
          })
        },
        onDone: () => {
          customStrategyTrack.push("onDone")
          return ok({
            gitSkipped: true,
          })
        },
      }

      const boardForTracking = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const taskForTracking = createTask(boardForTracking, {
        title: "Tracking Task",
        column: "01-todo",
      })._unsafeUnwrap()
      const refreshedBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      const startWithStrategyRes = startTask(refreshedBoard, DEFAULT_CONFIG, taskForTracking.id, {
        cwd: tempDir,
        workspaceStrategy: trackingStrategy,
      })
      expect(startWithStrategyRes.isOk()).toBe(true)
      expect(customStrategyTrack).toContain("onStart")

      const boardForDoneTracking = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const doneWithStrategyRes = doneTask(boardForDoneTracking, DEFAULT_CONFIG, taskForTracking.id, {
        cwd: tempDir,
        workspaceStrategy: trackingStrategy,
      })
      expect(doneWithStrategyRes.isOk()).toBe(true)
      expect(customStrategyTrack).toContain("onDone")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 12 (Block & Demotion): Appends blockers, normalizes IDs/paths/strings, and demotes to backlog", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-block-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create prerequisite task 26-001 in 01-todo
      const task1 = createTask(board, {
        title: "Database Schema",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardWithTask1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create dependent task 26-002 in 02-doing
      const task2 = createTask(boardWithTask1, {
        title: "API Endpoint",
        column: "02-doing",
      })._unsafeUnwrap()

      const boardWithBoth = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Block 26-002 with:
      // 1. Direct task ID "26-001"
      // 2. File path to task 1: "docs/tasks/01-todo/26-001-database-schema.md"
      // 3. Freeform text: "Waiting for external credentials"
      const blockRes = blockTask(boardWithBoth, task2.id, [
        task1.id,
        "docs/tasks/01-todo/26-001-database-schema.md",
        "Waiting for external credentials",
      ])

      expect(blockRes.isOk()).toBe(true)
      if (blockRes.isOk()) {
        const val = blockRes.value
        expect(val.demotedToBacklog).toBe(true)
        expect(val.task.column).toBe("backlog")
        // Normalized and deduplicated: 26-001 added only once + freeform text
        expect(val.task.document.frontmatter.relationships?.depends_on).toEqual([
          task1.id,
          "Waiting for external credentials",
        ])
      }

      // Verify file physically moved to backlog
      const reDiscovered = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const blockedTask = reDiscovered.columns
        .find((c) => c.name === "backlog")
        ?.tasks.find((t) => t.document.id === task2.id)

      expect(blockedTask != null).toBe(true)
      expect(blockedTask?.column).toBe("backlog")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 13 (Unblock & Dependency Resolution): Resolves task ID dependencies in done/archive, unblocks reasons one by one", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-unblock-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create task 26-001 in 01-todo
      const task1 = createTask(board, {
        title: "Prerequisite Task",
        column: "01-todo",
      })._unsafeUnwrap()

      const boardWithTask1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create task 26-002 in backlog
      const task2 = createTask(boardWithTask1, {
        title: "Dependent Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithBoth = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Add two blockers to task 2: task 1 ID and external API key string
      blockTask(boardWithBoth, task2.id, [task1.id, "Waiting on API token"])._unsafeUnwrap()

      let currentBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      let depTask = currentBoard.columns
        .find((c) => c.name === "backlog")
        ?.tasks.find((t) => t.document.id === task2.id)!

      // Initially: both 26-001 (still in 01-todo) and "Waiting on API token" are unresolved
      let evaluation = evaluateTaskBlockers(depTask, currentBoard)
      expect(evaluation.isBlocked).toBe(true)
      expect(evaluation.unresolved.length).toBe(2)
      expect(isDependencyResolved(task1.id, currentBoard)).toBe(false)

      // Move prerequisite task 1 to 03-done
      moveTask(currentBoard, task1.id, "03-done")._unsafeUnwrap()

      currentBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      depTask = currentBoard.columns
        .find((c) => c.name === "backlog")
        ?.tasks.find((t) => t.document.id === task2.id)!

      // Now: task 1 is in 03-done so it is automatically resolved!
      expect(isDependencyResolved(task1.id, currentBoard)).toBe(true)
      evaluation = evaluateTaskBlockers(depTask, currentBoard)
      expect(evaluation.resolved).toEqual([task1.id])
      expect(evaluation.unresolved).toEqual(["Waiting on API token"])
      expect(evaluation.isBlocked).toBe(true) // Still blocked by external string

      // Try unblocking without specifying when multiple blockers exist -> fails with error
      const multiUnblockErr = unblockTask(currentBoard, task2.id)
      expect(multiUnblockErr.isErr()).toBe(true)

      // Unblock the specific external string
      const unblockRes = unblockTask(currentBoard, task2.id, "Waiting on API token")
      expect(unblockRes.isOk()).toBe(true)
      if (unblockRes.isOk()) {
        expect(unblockRes.value.removedBlockers).toEqual(["Waiting on API token"])
        expect(unblockRes.value.remainingBlockers).toEqual([task1.id])
      }

      // Check final evaluation: only task1 remains in depends_on, and task1 is in done column
      currentBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      depTask = currentBoard.columns
        .find((c) => c.name === "backlog")
        ?.tasks.find((t) => t.document.id === task2.id)!

      evaluation = evaluateTaskBlockers(depTask, currentBoard)
      expect(evaluation.isBlocked).toBe(false)
      expect(evaluation.unresolved.length).toBe(0)
      expect(evaluation.resolved).toEqual([task1.id])

      // Clear the remaining resolved dependency as well (single item remaining -> auto-cleared)
      const clearLastRes = unblockTask(currentBoard, task2.id)
      expect(clearLastRes.isOk()).toBe(true)
      if (clearLastRes.isOk()) {
        expect(clearLastRes.value.remainingBlockers.length).toBe(0)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 14 (Plan & Promote): Partitions backlog into ready/blocked and promotes to config.columns[0]", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-plan-"))
    try {
      initializeBoard(DEFAULT_CONFIG, tempDir)
      const board = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create ready task 1 in backlog
      const readyTask = createTask(board, {
        title: "Ready Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWith1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Create blocked task 2 in backlog
      const blockedTask = createTask(boardWith1, {
        title: "Blocked Task",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWith2 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      blockTask(boardWith2, blockedTask.id, ["Waiting on human review"])._unsafeUnwrap()

      const boardPartitioned = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const plan = partitionBacklog(boardPartitioned)

      expect(plan.totalBacklog).toBe(2)
      expect(plan.ready.length).toBe(1)
      expect(plan.ready[0]?.task.document.id).toBe(readyTask.id)
      expect(plan.blocked.length).toBe(1)
      expect(plan.blocked[0]?.task.document.id).toBe(blockedTask.id)

      // Promote blocked task fails cleanly with error
      const promoteBlockedRes = promoteTask(boardPartitioned, DEFAULT_CONFIG, blockedTask.id)
      expect(promoteBlockedRes.isErr()).toBe(true)

      // Promote unblocked task succeeds and moves it to config.columns[0] ("01-todo")
      const promoteReadyRes = promoteTask(boardPartitioned, DEFAULT_CONFIG, readyTask.id)
      expect(promoteReadyRes.isOk()).toBe(true)
      if (promoteReadyRes.isOk()) {
        expect(promoteReadyRes.value.targetColumn).toBe("01-todo")
        expect(promoteReadyRes.value.task.column).toBe("01-todo")
      }

      // Verify on disk
      const finalBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const promotedInTodo = finalBoard.columns
        .find((c) => c.name === "01-todo")
        ?.tasks.find((t) => t.document.id === readyTask.id)

      expect(promotedInTodo != null).toBe(true)

      // Test batch promotion: promote multiple tasks and handle blocked tasks
      const batchTask1 = createTask(finalBoard, {
        title: "Batch Task 1",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithBatch1 = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const batchTask2 = createTask(boardWithBatch1, {
        title: "Batch Task 2",
        column: "backlog",
      })._unsafeUnwrap()

      const boardWithBothBatch = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()

      // Batch promote both unblocked tasks + the still-blocked task
      const batchRes = promoteTasks(
        boardWithBothBatch,
        DEFAULT_CONFIG,
        [batchTask1.id, blockedTask.id, batchTask2.id],
      )

      expect(batchRes.promoted.length).toBe(2)
      expect(batchRes.failed.length).toBe(1)
      expect(batchRes.failed[0]?.taskId).toBe(blockedTask.id)
      expect(batchRes.promoted.map((p) => p.task.document.id)).toEqual([
        batchTask1.id,
        batchTask2.id,
      ])
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
