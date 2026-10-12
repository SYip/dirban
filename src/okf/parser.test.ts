import { describe, expect, it } from "bun:test"
import { parseTaskDocument } from "./parser.ts"
import { serializeTaskDocument } from "./serializer.ts"

const SAMPLE_OKF_MARKDOWN = `---
okf_version: "1.0"
id: "task.project.core.26-001"
title: "Initialize Dirban CLI"
type: "task"
status: "todo"
priority: "p1"
owner: "developer"
assigned_to: "andrew"
created_date: "2026-10-11"
last_updated: "2026-10-11"
tags:
  - cli
  - core
relationships:
  depends_on:
    - "task.project.core.26-000"
  blocks: []
  related_to: []
---

# Task: Initialize Dirban CLI

## 1. Objective & Scope
Build the foundational Bun CLI for task management.

## 2. Acceptance Criteria
- [x] Create project structure
- [ ] Add CLI parser
- [ ] Verify test suite

## 3. Verification Plan
\`\`\`bash
bun test
\`\`\`

## 4. Execution Journal
- **2026-10-11**: Task initialized.
`

describe("OKF Parser and Serializer Tests", () => {
  it("Vector 1 (Baseline): Parses full standard OKF card", () => {
    const result = parseTaskDocument(SAMPLE_OKF_MARKDOWN)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const doc = result.value
      expect(doc.frontmatter.id).toBe("task.project.core.26-001")
      expect(doc.frontmatter.title).toBe("Initialize Dirban CLI")
      expect(doc.frontmatter.status).toBe("todo")
      expect(doc.frontmatter.priority).toBe("p1")
      expect(doc.frontmatter.assigned_to).toBe("andrew")
      expect(doc.frontmatter.tags).toEqual(["cli", "core"])
      expect(doc.frontmatter.relationships.depends_on).toEqual([
        "task.project.core.26-000",
      ])

      expect(doc.acceptanceCriteria.length).toBe(3)
      expect(doc.acceptanceCriteria[0]?.checked).toBe(true)
      expect(doc.acceptanceCriteria[0]?.text).toBe("Create project structure")
      expect(doc.acceptanceCriteria[1]?.checked).toBe(false)
      expect(doc.acceptanceCriteria[1]?.text).toBe("Add CLI parser")

      expect(doc.executionJournal.length).toBe(1)
      expect(doc.executionJournal[0]).toBe("- **2026-10-11**: Task initialized.")
    }
  })

  it("Vector 2 (Minimal / Missing Fields): Handles default priority and missing fields", () => {
    const minimal = `---
id: "task.26-002"
title: "Minimal Task"
---

# Minimal Task
`
    const result = parseTaskDocument(minimal)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const doc = result.value
      expect(doc.frontmatter.id).toBe("task.26-002")
      expect(doc.frontmatter.priority).toBe("p2")
      expect(doc.frontmatter.status).toBe("backlog")
      expect(doc.acceptanceCriteria.length).toBe(0)
    }
  })

  it("Vector 3 (Error Boundary): Rejects invalid frontmatter", () => {
    const invalidYaml = `---
id: [unclosed array
---
Body
`
    const result = parseTaskDocument(invalidYaml)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.kind).toBe("INVALID_YAML")
    }

    const missingId = `---
title: "No ID"
---
`
    const missingIdResult = parseTaskDocument(missingId)
    expect(missingIdResult.isErr()).toBe(true)
    if (missingIdResult.isErr()) {
      expect(missingIdResult.error.kind).toBe("INVALID_SCHEMA")
    }
  })

  it("Vector 4 (Serialization Roundtrip): Preserves frontmatter and structure", () => {
    const parseResult = parseTaskDocument(SAMPLE_OKF_MARKDOWN)
    expect(parseResult.isOk()).toBe(true)
    if (parseResult.isOk()) {
      const serialized = serializeTaskDocument(parseResult.value)
      const reParsed = parseTaskDocument(serialized)
      expect(reParsed.isOk()).toBe(true)
      if (reParsed.isOk()) {
        expect(reParsed.value.frontmatter.id).toBe(
          parseResult.value.frontmatter.id,
        )
        expect(reParsed.value.frontmatter.priority).toBe(
          parseResult.value.frontmatter.priority,
        )
        expect(reParsed.value.acceptanceCriteria.length).toBe(
          parseResult.value.acceptanceCriteria.length,
        )
      }
    }
  })
})
