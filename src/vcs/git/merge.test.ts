import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { integrateBranch, mergeInPlaceBranch, mergeWorktreeAndCleanup } from "./merge.ts"

const git = (args: readonly string[], cwd: string): string => {
  const res = spawnSync("git", [...args], { cwd, encoding: "utf-8" })
  if (res.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${res.stderr}`)
  }
  return res.stdout.trim()
}

describe("Git Merge & Integration Strategies (src/vcs/git/merge.ts)", () => {
  let repoDir: string

  beforeEach(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "dirban-merge-test-"))
    git(["init", "-b", "main"], repoDir)
    git(["config", "user.email", "test@dirban.dev"], repoDir)
    git(["config", "user.name", "Dirban Test"], repoDir)
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Init\n", "utf-8")
    git(["add", "."], repoDir)
    git(["commit", "-m", "chore: initial commit"], repoDir)
  })

  afterEach(() => {
    fs.rmSync(repoDir, { recursive: true, force: true })
  })

  it("Vector 1 (squash): squashes branch commits into a single commit on main and deletes branch", () => {
    git(["checkout", "-b", "task/26-001-feat"], repoDir)
    fs.writeFileSync(path.join(repoDir, "a.txt"), "one\n", "utf-8")
    git(["add", "a.txt"], repoDir)
    git(["commit", "-m", "wip 1"], repoDir)
    fs.writeFileSync(path.join(repoDir, "b.txt"), "two\n", "utf-8")
    git(["add", "b.txt"], repoDir)
    git(["commit", "-m", "wip 2"], repoDir)

    const res = mergeInPlaceBranch(
      repoDir,
      {
        taskBranch: "task/26-001-feat",
        baseBranch: "main",
        commitMessage: "feat: 26-001 squashed",
      },
      "squash",
    )

    expect(res.isOk()).toBe(true)
    expect(git(["rev-list", "--count", "main"], repoDir)).toBe("2")
    expect(git(["log", "-1", "--pretty=%s", "main"], repoDir)).toBe("feat: 26-001 squashed")
    expect(git(["branch", "--list", "task/26-001-feat"], repoDir)).toBe("")
  })

  it("Vector 2 (rebase): rebases branch onto main, fast-forwards, and deletes branch", () => {
    git(["checkout", "-b", "task/26-002-rebase"], repoDir)
    fs.writeFileSync(path.join(repoDir, "feature.txt"), "feature\n", "utf-8")
    git(["add", "feature.txt"], repoDir)
    git(["commit", "-m", "feat: add feature"], repoDir)

    git(["checkout", "main"], repoDir)
    fs.writeFileSync(path.join(repoDir, "main.txt"), "main\n", "utf-8")
    git(["add", "main.txt"], repoDir)
    git(["commit", "-m", "chore: main progress"], repoDir)

    const res = integrateBranch(repoDir, "task/26-002-rebase", "main", "rebase")

    expect(res.isOk()).toBe(true)
    expect(git(["rev-list", "--count", "main"], repoDir)).toBe("3")
    expect(git(["log", "-1", "--pretty=%s", "main"], repoDir)).toBe("feat: add feature")
    expect(git(["branch", "--list", "task/26-002-rebase"], repoDir)).toBe("")
  })

  it("Vector 3 (merge): creates a --no-ff merge commit on main", () => {
    git(["checkout", "-b", "task/26-003-merge"], repoDir)
    fs.writeFileSync(path.join(repoDir, "m.txt"), "merge\n", "utf-8")
    git(["add", "m.txt"], repoDir)
    git(["commit", "-m", "feat: merge item"], repoDir)

    const res = mergeInPlaceBranch(
      repoDir,
      { taskBranch: "task/26-003-merge", baseBranch: "main" },
      "merge",
    )

    expect(res.isOk()).toBe(true)
    expect(git(["log", "-1", "--pretty=%s", "main"], repoDir)).toBe(
      "Merge branch 'task/26-003-merge' into main",
    )
  })

  it("Vector 4 (conflict): aborts cleanly and returns MERGE_ERROR on squash conflict", () => {
    git(["checkout", "-b", "task/26-004-conflict"], repoDir)
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Branch\n", "utf-8")
    git(["add", "README.md"], repoDir)
    git(["commit", "-m", "branch edit"], repoDir)

    git(["checkout", "main"], repoDir)
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Main\n", "utf-8")
    git(["add", "README.md"], repoDir)
    git(["commit", "-m", "main edit"], repoDir)

    const res = integrateBranch(repoDir, "task/26-004-conflict", "main", "squash")

    expect(res.isErr()).toBe(true)
    if (res.isErr()) {
      expect(res.error.kind).toBe("MERGE_ERROR")
    }
    expect(git(["status", "--porcelain"], repoDir)).toBe("")
  })

  it("Vector 5 (worktree + rebase): rebases worktree branch onto main, fast-forwards, and removes worktree", () => {
    const wtDir = path.join(os.tmpdir(), `dirban-wt-rebase-${Date.now()}`)
    git(["worktree", "add", "-b", "task/26-005-wt-rebase", wtDir], repoDir)
    fs.writeFileSync(path.join(wtDir, "wt.txt"), "worktree\n", "utf-8")
    git(["add", "wt.txt"], wtDir)
    git(["commit", "-m", "feat: worktree change"], wtDir)

    fs.writeFileSync(path.join(repoDir, "main.txt"), "main\n", "utf-8")
    git(["add", "main.txt"], repoDir)
    git(["commit", "-m", "chore: main advance"], repoDir)

    const res = mergeWorktreeAndCleanup(
      repoDir,
      wtDir,
      { taskBranch: "task/26-005-wt-rebase", baseBranch: "main" },
      "rebase",
    )

    expect(res.isOk()).toBe(true)
    if (res.isOk()) {
      expect(res.value.worktreeRemoved).toBe(true)
    }
    expect(fs.existsSync(wtDir)).toBe(false)
    expect(git(["log", "-1", "--pretty=%s", "main"], repoDir)).toBe("feat: worktree change")
    expect(git(["branch", "--list", "task/26-005-wt-rebase"], repoDir)).toBe("")
  })

  it("Vector 6 (worktree + squash): squashes worktree commits into main and removes worktree", () => {
    const wtDir = path.join(os.tmpdir(), `dirban-wt-squash-${Date.now()}`)
    git(["worktree", "add", "-b", "task/26-006-wt-squash", wtDir], repoDir)
    fs.writeFileSync(path.join(wtDir, "w1.txt"), "1\n", "utf-8")
    git(["add", "w1.txt"], wtDir)
    git(["commit", "-m", "wip 1"], wtDir)
    fs.writeFileSync(path.join(wtDir, "w2.txt"), "2\n", "utf-8")
    git(["add", "w2.txt"], wtDir)
    git(["commit", "-m", "wip 2"], wtDir)

    const res = mergeWorktreeAndCleanup(
      repoDir,
      wtDir,
      {
        taskBranch: "task/26-006-wt-squash",
        baseBranch: "main",
        commitMessage: "feat: 26-006 worktree squashed",
      },
      "squash",
    )

    expect(res.isOk()).toBe(true)
    if (res.isOk()) {
      expect(res.value.worktreeRemoved).toBe(true)
    }
    expect(fs.existsSync(wtDir)).toBe(false)
    expect(git(["rev-list", "--count", "main"], repoDir)).toBe("2")
    expect(git(["log", "-1", "--pretty=%s", "main"], repoDir)).toBe("feat: 26-006 worktree squashed")
    expect(git(["branch", "--list", "task/26-006-wt-squash"], repoDir)).toBe("")
  })
})
