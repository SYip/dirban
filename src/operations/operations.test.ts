import { describe, expect, it } from "bun:test"
import * as path from "node:path"
import * as fs from "node:fs"
import * as os from "node:os"
import { DEFAULT_CONFIG } from "../config/config.ts"
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
import {
  GitVcsProvider,
  NoopVcsProvider,
  getVcsProvider,
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

  it("Vector 4 (Archive): Partitions completed tasks into archive/YYYY/", () => {
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
          expect(targetDir.includes("archive")).toBe(true)
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

      // 2. dirban done in non-git directory without explicit ID (picks single doing task)
      const boardInDoing = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const doneRes = doneTask(boardInDoing, DEFAULT_CONFIG, undefined, { cwd: tempDir })
      expect(doneRes.isOk()).toBe(true)
      if (doneRes.isOk()) {
        expect(doneRes.value.task.column).toBe("03-done")
        expect(doneRes.value.gitSkipped).toBe(true)
        expect(doneRes.value.uncheckedCount).toBe(1)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
