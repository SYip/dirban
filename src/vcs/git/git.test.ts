import { describe, expect, it } from "bun:test"
import { NoopVcsProvider } from "../noop.ts"
import { GitVcsProvider, parseGitWorktreeListPorcelain } from "./index.ts"

describe("VCS Git Provider Tests", () => {
  it("Vector 9 (Git helper functions & VCS Providers): Derives deterministic branch names, worktree paths, and extracts IDs", () => {
    const gitProvider = new GitVcsProvider()
    expect(gitProvider.deriveBranchName("task/", "26-003", "git-workflow")).toBe(
      "task/26-003-git-workflow",
    )
    expect(gitProvider.deriveBranchName("feature", "26-003", "my Feature!")).toBe(
      "feature/26-003-my-feature",
    )
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
    expect(gitProvider.extractTaskId(undefined, "/path/to/.dirban.worktrees/26-003-git-flow")).toBe(
      "26-003",
    )

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
})
