import { describe, expect, it } from "bun:test"
import { parseTaskDocument } from "./parser.ts"

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

describe("Markdown & OKF Parser Tests", () => {
  it("Vector 1 (Baseline OKF): Parses full standard OKF card", () => {
    const result = parseTaskDocument(SAMPLE_OKF_MARKDOWN)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const doc = result.value
      expect(doc.id).toBe("task.project.core.26-001")
      expect(doc.title).toBe("Initialize Dirban CLI")
      expect(doc.priority).toBe("p1")
      expect(doc.assigned_to).toBe("andrew")
      expect(doc.tags).toEqual(["cli", "core"])

      expect(doc.acceptanceCriteria.length).toBe(3)
      expect(doc.acceptanceCriteria[0]?.checked).toBe(true)
      expect(doc.acceptanceCriteria[0]?.text).toBe("Create project structure")
      expect(doc.acceptanceCriteria[1]?.checked).toBe(false)
      expect(doc.acceptanceCriteria[1]?.text).toBe("Add CLI parser")

      expect(doc.executionJournal.length).toBe(1)
      expect(doc.executionJournal[0]).toBe("- **2026-10-11**: Task initialized.")
    }
  })

  it("Vector 2 (Plain Markdown without frontmatter): Parses pure markdown tasks", () => {
    const plain = `# Fix authentication token timeout

Here is context on the issue.

- [ ] Check redis TTL
- [x] Reproduce in integration test
`
    const result = parseTaskDocument(plain, "auth-timeout.md")
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const doc = result.value
      expect(doc.id).toBe("auth-timeout")
      expect(doc.title).toBe("Fix authentication token timeout")
      expect(doc.priority).toBe("p3") // defaults to p3
      expect(doc.acceptanceCriteria.length).toBe(2)
      expect(doc.acceptanceCriteria[0]?.checked).toBe(false)
      expect(doc.acceptanceCriteria[0]?.text).toBe("Check redis TTL")
      expect(doc.acceptanceCriteria[1]?.checked).toBe(true)
      expect(doc.acceptanceCriteria[1]?.text).toBe("Reproduce in integration test")
    }
  })

  it("Vector 3 (Minimal frontmatter): Extracts priority p0-p3, defaults to p3 if omitted", () => {
    const withPriority = `---
priority: p0
tags: [auth, bug]
---

# Urgent crash fix
- [ ] Deploy hotfix
`
    const res1 = parseTaskDocument(withPriority, "crash-fix.md")
    expect(res1.isOk()).toBe(true)
    if (res1.isOk()) {
      expect(res1.value.priority).toBe("p0")
      expect(res1.value.title).toBe("Urgent crash fix")
      expect(res1.value.tags).toEqual(["auth", "bug"])
    }

    const withoutPriority = `---
tags: [docs]
---

# Update readme
`
    const res2 = parseTaskDocument(withoutPriority, "update-readme.md")
    expect(res2.isOk()).toBe(true)
    if (res2.isOk()) {
      expect(res2.value.priority).toBe("p3")
      expect(res2.value.title).toBe("Update readme")
    }
  })

  it("Vector 4 (Error Boundary): Rejects invalid unclosed or malformed frontmatter", () => {
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

    const unclosedFrontmatter = `---
title: unclosed
`
    const unclosedRes = parseTaskDocument(unclosedFrontmatter)
    expect(unclosedRes.isErr()).toBe(true)
    if (unclosedRes.isErr()) {
      expect(unclosedRes.error.kind).toBe("MISSING_FRONTMATTER")
    }
  })
})
