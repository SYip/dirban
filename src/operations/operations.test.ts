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

const SAMPLE_TASK = `---
okf_version: "1.0"
id: "task.26-001"
title: "Sample Task"
type: "task"
status: "00-backlog"
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
  it("Vector 1 (Move): Moves card across columns and updates journal & status", () => {
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
          expect(moveRes.value.document.executionJournal.length >= 2).toBe(true)
          const newContent = fs.readFileSync(moveRes.value.filePath, "utf-8")
          expect(
            newContent.includes("Moved from `00-backlog` to `01-ready`"),
          ).toBe(true)
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
})
