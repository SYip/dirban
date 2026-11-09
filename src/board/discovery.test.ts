import { describe, expect, it } from "bun:test"
import * as path from "node:path"
import * as fs from "node:fs"
import * as os from "node:os"
import { DEFAULT_CONFIG } from "../config/config.ts"
import {
  discoverBoard,
  findTaskByIdOrName,
  findTaskByQuery,
  getAllBoardTasks,
} from "./discovery.ts"

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
      fs.mkdirSync(path.join(tasksDir, "01-todo"), { recursive: true })
      fs.mkdirSync(path.join(tasksDir, "archive"), { recursive: true })
      fs.mkdirSync(path.join(tasksDir, "99-custom-stage"), {
        recursive: true,
      })

      const result = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const colNames = result.value.columns.map((c) => c.name)
        expect(colNames.includes("backlog")).toBe(true)
        expect(colNames.includes("99-custom-stage")).toBe(true)
        expect(colNames.includes("archive")).toBe(true)
        // backlog is index 0 (far left)
        expect(colNames[0]).toBe("backlog")
        // archive is last index (far right)
        expect(colNames[colNames.length - 1]).toBe("archive")
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

  it("Vector 5 (Unified Task Query Resolution): Exact, short numeric suffix, ambiguity, and fuzzy matching", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-query-"))
    try {
      const tasksDir = path.join(tempDir, "docs/tasks")
      fs.mkdirSync(path.join(tasksDir, "01-todo"), { recursive: true })
      fs.mkdirSync(path.join(tasksDir, "02-doing"), { recursive: true })

      fs.writeFileSync(path.join(tasksDir, "01-todo/26-001-login-form.md"), TASK_P1_CARD)
      fs.writeFileSync(path.join(tasksDir, "02-doing/26-002-auth-security.md"), TASK_P0_CARD)

      const boardRes = discoverBoard(DEFAULT_CONFIG, tempDir)
      expect(boardRes.isOk()).toBe(true)
      if (boardRes.isErr()) return
      const board = boardRes.value
      const allTasks = getAllBoardTasks(board)

      // 1. Exact match by full ID
      const exactFull = findTaskByQuery(allTasks, "task.26-001")
      expect(exactFull.kind).toBe("FOUND")
      if (exactFull.kind === "FOUND") {
        expect(exactFull.task.filename).toBe("26-001-login-form.md")
      }

      // 2. Exact match by filename stem
      const exactStem = findTaskByQuery(allTasks, "26-002-auth-security")
      expect(exactStem.kind).toBe("FOUND")
      if (exactStem.kind === "FOUND") {
        expect(exactStem.task.filename).toBe("26-002-auth-security.md")
      }

      // 3. Short numeric suffix (string "001" and number "1")
      const suffix001 = findTaskByQuery(allTasks, "001")
      expect(suffix001.kind).toBe("FOUND")
      if (suffix001.kind === "FOUND") {
        expect(suffix001.task.filename).toBe("26-001-login-form.md")
      }

      const suffix1 = findTaskByQuery(allTasks, "1")
      expect(suffix1.kind).toBe("FOUND")
      if (suffix1.kind === "FOUND") {
        expect(suffix1.task.filename).toBe("26-001-login-form.md")
      }

      // 4. Fuzzy search (enabled via option)
      const fuzzyMatch = findTaskByQuery(allTasks, "security", { enableFuzzy: true })
      expect(fuzzyMatch.kind).toBe("FOUND")
      if (fuzzyMatch.kind === "FOUND") {
        expect(fuzzyMatch.task.filename).toBe("26-002-auth-security.md")
      }

      // 5. Ambiguity detection
      // Add another card with suffix "001" (e.g. from 2025: "25-001")
      fs.writeFileSync(
        path.join(tasksDir, "01-todo/25-001-legacy.md"),
        `---
okf_version: "1.0"
id: "task.25-001"
title: "Legacy Task"
type: "task"
status: "01-todo"
priority: "p2"
owner: "developer"
assigned_to: "unassigned"
created_date: "2025-10-10"
last_updated: "2025-10-10"
tags: []
relationships:
  depends_on: []
  blocks: []
  related_to: []
---
# Legacy Task
`,
      )

      const reloadedBoard = discoverBoard(DEFAULT_CONFIG, tempDir)._unsafeUnwrap()
      const reloadedTasks = getAllBoardTasks(reloadedBoard)

      const ambiguousRes = findTaskByQuery(reloadedTasks, "001")
      expect(ambiguousRes.kind).toBe("AMBIGUOUS")
      if (ambiguousRes.kind === "AMBIGUOUS") {
        const ids = ambiguousRes.matches.map((m) => m.document.id)
        expect(ids).toContain("task.26-001")
        expect(ids).toContain("task.25-001")
      }

      // 6. findTaskByIdOrName transparently resolves short ID across board
      const foundViaHelper = findTaskByIdOrName(reloadedBoard, "2")
      expect(foundViaHelper != null).toBe(true)
      expect(foundViaHelper?.document.id).toBe("task.26-002")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
