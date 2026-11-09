import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { discoverBoard } from "../../board/discovery.ts"
import { DEFAULT_CONFIG } from "../../config/config.ts"
import { archiveTasks } from "../mutation/archive.ts"
import { calculateNextTaskId, createTask } from "../mutation/create.ts"
import { initializeBoard } from "./init.ts"

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
`

describe("Project and Lifecycle Storage Operations Tests", () => {
  it("Vector 4 (Archive): Places completed tasks flat into archive/", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-archive-"))
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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-nextid-"))
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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-create-"))
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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-init-"))
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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-ops-vscode-"))
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
})
