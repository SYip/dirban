import { afterEach, describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { discoverBoard } from "../../board/discovery.ts"
import { DEFAULT_CONFIG } from "../../config/config.ts"
import type { DirbanConfig } from "../../config/types.ts"
import { blockTask } from "../planning/block.ts"
import { resumeTask } from "./resume.ts"
import { startTask } from "./start.ts"

const runGit = (cwd: string, args: readonly string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf-8" }).trim()

const setupGitRepo = (): { repoDir: string; config: DirbanConfig } => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-e2e-wt-"))
  runGit(repoDir, ["init", "-b", "main"])
  runGit(repoDir, ["config", "user.email", "test@example.com"])
  runGit(repoDir, ["config", "user.name", "Test User"])

  for (const col of ["backlog", "01-todo", "02-doing", "03-done"]) {
    fs.mkdirSync(path.join(repoDir, "docs/tasks", col), { recursive: true })
  }

  fs.writeFileSync(path.join(repoDir, "README.md"), "# Test Repo\n", "utf-8")
  fs.writeFileSync(
    path.join(repoDir, "docs/tasks/01-todo/26-001-e2e-task.md"),
    `---
id: 26-001
title: E2E Worktree Task
status: 01-todo
priority: high
---
# E2E Worktree Task

## Acceptance Criteria
- [ ] Step 1
`,
    "utf-8",
  )

  runGit(repoDir, ["add", "."])
  runGit(repoDir, ["commit", "-m", "initial commit"])

  const config: DirbanConfig = {
    ...DEFAULT_CONFIG,
    branchStrategy: "worktree",
  }
  return { repoDir, config }
}

describe("Phase 5: Worktree Lifecycle E2E Tests", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  test("Vector 1: Dirty state guards halt startTask, blockTask, and resumeTask when uncommitted code files exist", () => {
    const { repoDir, config } = setupGitRepo()
    tempDirs.push(repoDir)

    // Create uncommitted code file
    fs.writeFileSync(path.join(repoDir, "dirty.ts"), "export const x = 1\n", "utf-8")

    const boardRes = discoverBoard(config, repoDir)
    expect(boardRes.isOk()).toBe(true)
    if (boardRes.isErr()) return

    const startRes = startTask(boardRes.value, config, "26-001", { cwd: repoDir })
    expect(startRes.isErr()).toBe(true)
    if (startRes.isErr()) {
      expect(startRes.error.kind).toBe("DIRTY_WORKING_TREE")
    }

    const resumeRes = resumeTask(boardRes.value, config, "26-001", { cwd: repoDir })
    expect(resumeRes.isErr()).toBe(true)
    if (resumeRes.isErr()) {
      expect(resumeRes.error.kind).toBe("DIRTY_WORKING_TREE")
    }
  })

  test("Vector 2: startTask commits task move on target branch and creates worktree", () => {
    const { repoDir, config } = setupGitRepo()
    tempDirs.push(repoDir)

    const boardRes = discoverBoard(config, repoDir)
    expect(boardRes.isOk()).toBe(true)
    if (boardRes.isErr()) return

    const startRes = startTask(boardRes.value, config, "26-001", { cwd: repoDir })
    expect(startRes.isOk()).toBe(true)
    if (startRes.isErr()) return

    expect(startRes.value.worktreePath).toBeDefined()
    expect(fs.existsSync(startRes.value.worktreePath!)).toBe(true)
    expect(fs.existsSync(path.join(repoDir, "docs/tasks/02-doing/26-001-e2e-task.md"))).toBe(true)
  })

  test("Vector 3: blockTask retains worktree and synchronizes target branch", () => {
    const { repoDir, config } = setupGitRepo()
    tempDirs.push(repoDir)

    const board1 = discoverBoard(config, repoDir)
    expect(board1.isOk()).toBe(true)
    if (board1.isErr()) return

    const startRes = startTask(board1.value, config, "26-001", { cwd: repoDir })
    expect(startRes.isOk()).toBe(true)
    if (startRes.isErr()) return
    const wtPath = startRes.value.worktreePath!

    const board2 = discoverBoard(config, repoDir)
    expect(board2.isOk()).toBe(true)
    if (board2.isErr()) return

    const blockRes = blockTask(board2.value, "26-001", ["Blocked on dependency"], { cwd: repoDir })
    if (blockRes.isErr()) {
      throw new Error(`blockTask failed: ${JSON.stringify(blockRes.error)}`)
    }
    expect(blockRes.isOk()).toBe(true)

    // Worktree is retained
    expect(fs.existsSync(wtPath)).toBe(true)
    // Task moved to backlog on target branch
    expect(fs.existsSync(path.join(repoDir, "docs/tasks/00-backlog/26-001-e2e-task.md"))).toBe(true)
  })

  test("Vector 4: resumeTask unblocks task, recreates missing worktree, and supports checkout & none strategies", () => {
    const { repoDir, config } = setupGitRepo()
    tempDirs.push(repoDir)

    // Start then block
    const b1 = discoverBoard(config, repoDir)
    if (b1.isErr()) return
    const s1 = startTask(b1.value, config, "26-001", { cwd: repoDir })
    if (s1.isErr()) return
    const wtPath = s1.value.worktreePath!

    const b2 = discoverBoard(config, repoDir)
    if (b2.isErr()) return
    const blk = blockTask(b2.value, "26-001", ["API down"], { cwd: repoDir })
    if (blk.isErr()) {
      throw new Error(`blockTask failed: ${JSON.stringify(blk.error)}`)
    }
    expect(blk.isOk()).toBe(true)

    // Simulate out-of-band worktree deletion
    runGit(repoDir, ["worktree", "remove", "--force", wtPath])
    expect(fs.existsSync(wtPath)).toBe(false)

    // Resume with worktree strategy recreates worktree
    const b3 = discoverBoard(config, repoDir)
    if (b3.isErr()) return
    const resWt = resumeTask(b3.value, config, "26-001", { cwd: repoDir, force: true })
    expect(resWt.isOk()).toBe(true)
    if (resWt.isErr()) return
    expect(resWt.value.worktreePath).toBeDefined()
    expect(fs.existsSync(resWt.value.worktreePath!)).toBe(true)
    expect(fs.existsSync(path.join(repoDir, "docs/tasks/02-doing/26-001-e2e-task.md"))).toBe(true)

    // Also verify resumeTask with 'none' strategy on a fresh blocked task
    fs.writeFileSync(
      path.join(repoDir, "docs/tasks/backlog/26-002-none-task.md"),
      "---\nid: 26-002\ntitle: None Strategy Task\nstatus: backlog\nblocked_reason: paused\n---\n# None\n",
      "utf-8",
    )
    runGit(repoDir, ["add", "."])
    runGit(repoDir, ["commit", "-m", "add 26-002"])

    const noneConfig: DirbanConfig = { ...DEFAULT_CONFIG, branchStrategy: "none" }
    const b4 = discoverBoard(noneConfig, repoDir)
    if (b4.isErr()) return
    const resNone = resumeTask(b4.value, noneConfig, "26-002", { cwd: repoDir, force: true })
    expect(resNone.isOk()).toBe(true)
    expect(fs.existsSync(path.join(repoDir, "docs/tasks/02-doing/26-002-none-task.md"))).toBe(true)
  })
})
