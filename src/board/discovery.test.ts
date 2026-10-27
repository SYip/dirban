import { describe, expect, it } from "bun:test"
import * as path from "node:path"
import * as fs from "node:fs"
import * as os from "node:os"
import { DEFAULT_CONFIG } from "../config/config.ts"
import { discoverBoard, findTaskByIdOrName } from "./discovery.ts"

const TASK_P1_CARD = `---
okf_version: "1.0"
id: "task.26-001"
title: "First Task"
type: "task"
status: "00-backlog"
priority: "p1"
owner: "developer"
assigned_to: "andrew"
created_date: "2026-10-10"
last_updated: "2026-10-10"
tags:
  - backend
relationships:
  depends_on: []
  blocks: []
  related_to: []
---

# Task: First Task
`

const TASK_P0_CARD = `---
okf_version: "1.0"
id: "task.26-002"
title: "Critical Task"
type: "task"
status: "00-backlog"
priority: "p0"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-10-11"
last_updated: "2026-10-11"
tags:
  - security
relationships:
  depends_on: []
  blocks: []
  related_to: []
---

# Task: Critical Task
`

describe("Board Discovery and Sorting Tests", () => {
  it("Vector 1 (Baseline): Discovers columns and sorts tasks by priority", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-discovery-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "backlog"), { recursive: true })
      fs.mkdirSync(path.join(tasksDir, "01-todo"), { recursive: true })

      fs.writeFileSync(
        path.join(tasksDir, "backlog/26-001.md"),
        TASK_P1_CARD.replace("00-backlog", "backlog"),
        "utf-8",
      )
      fs.writeFileSync(
        path.join(tasksDir, "backlog/26-002.md"),
        TASK_P0_CARD.replace("00-backlog", "backlog"),
        "utf-8",
      )

      const result = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const board = result.value
        expect(board.totalTasks).toBe(2)
        const backlogCol = board.columns.find((c) => c.name === "backlog")
        expect(backlogCol != null).toBe(true)
        if (backlogCol != null) {
          expect(backlogCol.tasks.length).toBe(2)
          // p0 comes before p1
          expect(backlogCol.tasks[0]?.document.frontmatter.priority).toBe("p0")
          expect(backlogCol.tasks[1]?.document.frontmatter.priority).toBe("p1")
        }
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 2 (Self-healing & Lookup): Discovers mismatched status and heals it", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-discovery-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "01-todo"), { recursive: true })

      // File is physically in 01-todo, but frontmatter claims status: "backlog"
      fs.writeFileSync(
        path.join(tasksDir, "01-todo/26-001.md"),
        TASK_P1_CARD.replace("00-backlog", "backlog"),
        "utf-8",
      )

      const result = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const task = findTaskByIdOrName(result.value, "task.26-001")
        expect(task != null).toBe(true)
        if (task != null) {
          expect(task.column).toBe("01-todo")
          expect(task.document.frontmatter.status).toBe("01-todo")
        }

        // Test shorthand lookup
        const shortFound = findTaskByIdOrName(result.value, "26-001")
        expect(shortFound != null).toBe(true)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 3 (Unlisted Columns): Gracefully appends unlisted directories", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-discovery-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "backlog"), { recursive: true })
      fs.mkdirSync(path.join(tasksDir, "99-custom-stage"), {
        recursive: true,
      })

      const result = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const colNames = result.value.columns.map((c) => c.name)
        expect(colNames.includes("backlog")).toBe(true)
        expect(colNames.includes("99-custom-stage")).toBe(true)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("Vector 4 (Missing Directory Error): Fails cleanly without auto-creating directories", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-discovery-"))
    try {
      // docs/tasks is NOT created
      const result = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.kind).toBe("DIRECTORY_NOT_FOUND")
        expect(result.error.message.includes('Run "dirban init"')).toBe(true)
      }
      // Ensure directory was not secretly created
      expect(fs.existsSync(path.join(tempDir, "docs/tasks"))).toBe(false)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
