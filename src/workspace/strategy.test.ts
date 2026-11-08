import { describe, expect, it } from "bun:test"
import { err, ok } from "neverthrow"
import type { BoardTask } from "../board/types.ts"
import { DEFAULT_CONFIG } from "../config/config.ts"
import type { VersionControlProvider, VcsContext, VcsError } from "../vcs/types.ts"
import { NoopVcsProvider } from "../vcs/noop.ts"
import { CurrentBranchStrategy } from "./current-branch-strategy.ts"
import { DirectoryOnlyStrategy } from "./directory-only-strategy.ts"
import { GitBranchStrategy } from "./git-branch-strategy.ts"
import { GitWorktreeStrategy } from "./git-worktree-strategy.ts"
import { detectWorkspaceDoneStrategy, resolveWorkspaceStrategy } from "./resolve-strategy.ts"
import type { WorkspaceLifecycleContext } from "./types.ts"

const MOCK_TASK: BoardTask = {
  filename: "26-001-sample-feature.md",
  filePath: "/workspace/docs/tasks/01-todo/26-001-sample-feature.md",
  column: "01-todo",
  document: {
    title: "Sample Feature",
    titleHeader: "# Sample Feature",
    objectiveScope: "",
    verificationPlan: "",
    executionJournal: [],
    otherSections: [],
    rawBody: "",
    frontmatter: { id: "26-001" },
    id: "26-001",
    priority: "p1",
    tags: [],
    acceptanceCriteria: [{ index: 0, checked: false, text: "Verify functionality", rawLine: "- [ ] Verify functionality" }],
  },
}

describe("Workspace Lifecycle Strategy Pattern", () => {
  describe("Strategy Factory (resolveWorkspaceStrategy)", () => {
    it("Vector 1 (Baseline / Auto-resolution): Returns GitBranchStrategy when git is available and no strategy specified", () => {
      const vcsCtx: VcsContext = {
        isAvailable: true,
        repoRoot: "/workspace",
        currentBranch: "main",
      }
      const strategy = resolveWorkspaceStrategy(undefined, vcsCtx, DEFAULT_CONFIG)
      expect(strategy.name).toBe("checkout")
      expect(strategy instanceof GitBranchStrategy).toBe(true)
    })

    it("Vector 2 (Worktree Resolution): Returns GitWorktreeStrategy when worktree flag or config is active", () => {
      const vcsCtx: VcsContext = {
        isAvailable: true,
        repoRoot: "/workspace",
        currentBranch: "main",
      }
      const flagStrategy = resolveWorkspaceStrategy({ strategy: "worktree" }, vcsCtx, DEFAULT_CONFIG)
      expect(flagStrategy.name).toBe("worktree")
      expect(flagStrategy instanceof GitWorktreeStrategy).toBe(true)

      const configStrategy = resolveWorkspaceStrategy(
        undefined,
        vcsCtx,
        { ...DEFAULT_CONFIG, branchStrategy: "worktree" },
      )
      expect(configStrategy.name).toBe("worktree")
      expect(configStrategy instanceof GitWorktreeStrategy).toBe(true)
    })

    it("Vector 3 (Non-git & Explicit directory-only): Resolves DirectoryOnlyStrategy when Git unavailable, noGit flag set, or directory-only", () => {
      const gitUnavailableCtx: VcsContext = { isAvailable: false }
      const s1 = resolveWorkspaceStrategy(undefined, gitUnavailableCtx, DEFAULT_CONFIG)
      expect(s1.name).toBe("directory-only")
      expect(s1 instanceof DirectoryOnlyStrategy).toBe(true)

      const gitAvailableCtx: VcsContext = { isAvailable: true, repoRoot: "/workspace", currentBranch: "main" }
      const s2 = resolveWorkspaceStrategy({ noGit: true }, gitAvailableCtx, DEFAULT_CONFIG)
      expect(s2.name).toBe("directory-only")
      expect(s2 instanceof DirectoryOnlyStrategy).toBe(true)

      const s3 = resolveWorkspaceStrategy({ strategy: "directory-only" }, gitAvailableCtx, DEFAULT_CONFIG)
      expect(s3.name).toBe("directory-only")
      expect(s3 instanceof DirectoryOnlyStrategy).toBe(true)
    })

    it("Vector 4 (Automatic Detection on Done): Auto-detects worktree from cwd or matching task worktree without user flags", () => {
      const worktreeVcs: VersionControlProvider = Object.assign(Object.create(new NoopVcsProvider()), {
        resolveWorktreePath: (id: string) => (id === "26-001" ? ok("/worktrees/26-001") : err({ kind: "WORKTREE_ERROR" as const, message: "not found" })),
        extractTaskId: () => null,
      })

      const inWorktreeCtx: VcsContext = {
        isAvailable: true,
        repoRoot: "/workspace",
        currentBranch: "task/26-001-sample-feature",
        isWorktree: true,
      }
      const s1 = detectWorkspaceDoneStrategy(MOCK_TASK, undefined, inWorktreeCtx, worktreeVcs, DEFAULT_CONFIG, "/worktrees/26-001")
      expect(s1.name).toBe("worktree")
      expect(s1 instanceof GitWorktreeStrategy).toBe(true)

      const inMainRepoCtx: VcsContext = {
        isAvailable: true,
        repoRoot: "/workspace",
        currentBranch: "main",
        isWorktree: false,
      }
      const s2 = detectWorkspaceDoneStrategy(MOCK_TASK, undefined, inMainRepoCtx, worktreeVcs, DEFAULT_CONFIG, "/workspace")
      expect(s2.name).toBe("worktree")
      expect(s2 instanceof GitWorktreeStrategy).toBe(true)
    })

    it("Vector 5 (Automatic Detection on Done - In-place Branch): Auto-detects in-place branch when active on task branch", () => {
      const branchVcs: VersionControlProvider = Object.assign(Object.create(new NoopVcsProvider()), {
        resolveWorktreePath: () => err({ kind: "WORKTREE_ERROR" as const, message: "not found" }),
        extractTaskId: (branch?: string) => (branch?.includes("26-001") ? "26-001" : null),
      })

      const onBranchCtx: VcsContext = {
        isAvailable: true,
        repoRoot: "/workspace",
        currentBranch: "task/26-001-sample-feature",
        isWorktree: false,
      }
      const s = detectWorkspaceDoneStrategy(MOCK_TASK, undefined, onBranchCtx, branchVcs, DEFAULT_CONFIG, "/workspace")
      expect(s.name).toBe("checkout")
      expect(s instanceof GitBranchStrategy).toBe(true)
    })

    it("Vector 6 (Current Branch Strategy 'none'): Resolves CurrentBranchStrategy when strategy is 'none'", () => {
      const vcsCtx: VcsContext = {
        isAvailable: true,
        repoRoot: "/workspace",
        currentBranch: "feature/pre-created-branch",
      }
      const s1 = resolveWorkspaceStrategy({ strategy: "none" }, vcsCtx, DEFAULT_CONFIG)
      expect(s1.name).toBe("none")
      expect(s1 instanceof CurrentBranchStrategy).toBe(true)

      const s2 = detectWorkspaceDoneStrategy(
        MOCK_TASK,
        { strategy: "none" },
        vcsCtx,
        new NoopVcsProvider(),
        DEFAULT_CONFIG,
        "/workspace",
      )
      expect(s2.name).toBe("none")
      expect(s2 instanceof CurrentBranchStrategy).toBe(true)

      const s3 = detectWorkspaceDoneStrategy(
        MOCK_TASK,
        undefined,
        vcsCtx,
        new NoopVcsProvider(),
        { ...DEFAULT_CONFIG, branchStrategy: "none" },
        "/workspace",
      )
      expect(s3.name).toBe("none")
      expect(s3 instanceof CurrentBranchStrategy).toBe(true)
    })
  })

  describe("DirectoryOnlyStrategy", () => {
    it("Vector 1 (Baseline Pure Filesystem): Succeeded with gitSkipped=true without mutating VCS", () => {
      const strategy = new DirectoryOnlyStrategy()
      const noopVcs = new NoopVcsProvider()
      const ctx: WorkspaceLifecycleContext = {
        vcs: noopVcs,
        vcsCtx: { isAvailable: false },
        config: DEFAULT_CONFIG,
        cwd: "/workspace",
      }

      const startRes = strategy.onStart(MOCK_TASK, ctx)
      expect(startRes.isOk()).toBe(true)
      if (startRes.isOk()) {
        expect(startRes.value.gitSkipped).toBe(true)
        expect(startRes.value.branchName).toBe("task/26-001-sample-feature")
        expect(startRes.value.strategy).toBe("directory-only")
      }

      const doneRes = strategy.onDone(MOCK_TASK, ctx)
      expect(doneRes.isOk()).toBe(true)
      if (doneRes.isOk()) {
        expect(doneRes.value.gitSkipped).toBe(true)
      }
    })
  })

  describe("GitBranchStrategy", () => {
    it("Vector 1 (Baseline Checkout & Merge): Checks out branch onStart and squash/merges onDone", () => {
      let switchedBranch = ""
      let mergedBranchName = ""

      const mockVcs: VersionControlProvider = Object.assign(Object.create(new NoopVcsProvider()), {
        switchOrCreateBranch: (branch: string) => {
          switchedBranch = branch
          return ok({ alreadyOnBranch: false })
        },
        extractTaskId: (branch: string) => (branch.includes("26-001") ? "26-001" : null),
        autoMergeAndCleanup: (options: { taskBranch: string }) => {
          mergedBranchName = options.taskBranch
          return ok({ worktreeRemoved: false })
        },
      })

      const strategy = new GitBranchStrategy()
      const startCtx: WorkspaceLifecycleContext = {
        vcs: mockVcs,
        vcsCtx: { isAvailable: true, repoRoot: "/workspace", currentBranch: "main" },
        config: DEFAULT_CONFIG,
        cwd: "/workspace",
      }

      const startRes = strategy.onStart(MOCK_TASK, startCtx)
      expect(startRes.isOk()).toBe(true)
      expect(switchedBranch).toBe("task/26-001-sample-feature")
      if (startRes.isOk()) {
        expect(startRes.value.gitSkipped).toBe(false)
        expect(startRes.value.branchName).toBe("task/26-001-sample-feature")
      }

      const doneCtx: WorkspaceLifecycleContext = {
        vcs: mockVcs,
        vcsCtx: { isAvailable: true, repoRoot: "/workspace", currentBranch: "task/26-001-sample-feature" },
        config: DEFAULT_CONFIG,
        cwd: "/workspace",
      }

      const doneRes = strategy.onDone(MOCK_TASK, doneCtx)
      expect(doneRes.isOk()).toBe(true)
      expect(mergedBranchName).toBe("task/26-001-sample-feature")
      if (doneRes.isOk()) {
        expect(doneRes.value.gitSkipped).toBe(false)
        expect(doneRes.value.mergedBranch).toBe("task/26-001-sample-feature")
      }
    })

    it("Vector 2 (Boundary - Already started guards & conflicts): Rejects onStart when branch already active", () => {
      const strategy = new GitBranchStrategy()
      const mockVcs = new NoopVcsProvider()
      const ctx: WorkspaceLifecycleContext = {
        vcs: mockVcs,
        vcsCtx: { isAvailable: true, repoRoot: "/workspace", currentBranch: "task/26-001-sample-feature" },
        config: DEFAULT_CONFIG,
        cwd: "/workspace",
      }

      const startRes = strategy.onStart(MOCK_TASK, ctx)
      expect(startRes.isErr()).toBe(true)
      if (startRes.isErr()) {
        expect(startRes.error.kind).toBe("ALREADY_STARTED")
      }
    })

    it("Vector 4 (No-merge flag / config): Preserves branch without merging when noMerge is specified", () => {
      let mergeAttempted = false
      const mockVcs: VersionControlProvider = Object.assign(Object.create(new NoopVcsProvider()), {
        extractTaskId: (branch: string) => (branch.includes("26-001") ? "26-001" : null),
        autoMergeAndCleanup: () => {
          mergeAttempted = true
          return ok({ worktreeRemoved: false })
        },
      })

      const strategy = new GitBranchStrategy()
      const ctx: WorkspaceLifecycleContext = {
        vcs: mockVcs,
        vcsCtx: { isAvailable: true, repoRoot: "/workspace", currentBranch: "task/26-001-sample-feature" },
        config: DEFAULT_CONFIG,
        cwd: "/workspace",
      }

      // 1. Explicit noMerge option
      const doneWithOptionRes = strategy.onDone(MOCK_TASK, ctx, { noMerge: true })
      expect(doneWithOptionRes.isOk()).toBe(true)
      expect(mergeAttempted).toBe(false)
      if (doneWithOptionRes.isOk()) {
        expect(doneWithOptionRes.value.gitSkipped).toBe(true)
        expect(doneWithOptionRes.value.message).toContain("--no-merge")
      }

      // 2. Config autoMerge: false
      const doneWithConfigRes = strategy.onDone(
        MOCK_TASK,
        { ...ctx, config: { ...DEFAULT_CONFIG, autoMerge: false } },
        undefined,
      )
      expect(doneWithConfigRes.isOk()).toBe(true)
      expect(mergeAttempted).toBe(false)
      if (doneWithConfigRes.isOk()) {
        expect(doneWithConfigRes.value.gitSkipped).toBe(true)
      }
    })
  })

  describe("GitWorktreeStrategy", () => {
    it("Vector 1 (Baseline Worktree Allocation & Removal): Allocates worktree path and cleans up on done", () => {
      let createdPath = ""
      let worktreeRemoved = false

      const mockVcs: VersionControlProvider = Object.assign(Object.create(new NoopVcsProvider()), {
        resolveWorktreePath: () => err({ kind: "WORKTREE_ERROR" as const, message: "Not found" } as VcsError),
        deriveWorktreePath: () => "/workspace.worktrees/26-001-sample-feature",
        createWorktree: (targetPath: string) => {
          createdPath = targetPath
          return ok(undefined)
        },
        extractTaskId: (branch: string) => (branch.includes("26-001") ? "26-001" : null),
        autoMergeAndCleanup: () => {
          worktreeRemoved = true
          return ok({ worktreeRemoved: true })
        },
      })

      const strategy = new GitWorktreeStrategy()
      const startCtx: WorkspaceLifecycleContext = {
        vcs: mockVcs,
        vcsCtx: { isAvailable: true, repoRoot: "/workspace", currentBranch: "main" },
        config: DEFAULT_CONFIG,
        cwd: "/workspace",
      }

      const startRes = strategy.onStart(MOCK_TASK, startCtx)
      expect(startRes.isOk()).toBe(true)
      expect(createdPath).toBe("/workspace.worktrees/26-001-sample-feature")
      if (startRes.isOk()) {
        expect(startRes.value.worktreePath).toBe("/workspace.worktrees/26-001-sample-feature")
        expect(startRes.value.strategy).toBe("worktree")
      }

      const doneCtx: WorkspaceLifecycleContext = {
        vcs: mockVcs,
        vcsCtx: {
          isAvailable: true,
          repoRoot: "/workspace",
          currentBranch: "task/26-001-sample-feature",
          isWorktree: true,
        },
        config: DEFAULT_CONFIG,
        cwd: "/workspace.worktrees/26-001-sample-feature",
      }

      const doneRes = strategy.onDone(MOCK_TASK, doneCtx)
      expect(doneRes.isOk()).toBe(true)
      expect(worktreeRemoved).toBe(true)
      if (doneRes.isOk()) {
        expect(doneRes.value.worktreeRemoved).toBe(true)
      }
    })

    it("Vector 2 (Boundary - Existing worktree guard): Rejects start if worktree already exists", () => {
      const mockVcs: VersionControlProvider = Object.assign(Object.create(new NoopVcsProvider()), {
        resolveWorktreePath: () => ok("/workspace.worktrees/26-001-sample-feature"),
      })

      const strategy = new GitWorktreeStrategy()
      const ctx: WorkspaceLifecycleContext = {
        vcs: mockVcs,
        vcsCtx: { isAvailable: true, repoRoot: "/workspace", currentBranch: "main" },
        config: DEFAULT_CONFIG,
        cwd: "/workspace",
      }

      const startRes = strategy.onStart(MOCK_TASK, ctx)
      expect(startRes.isErr()).toBe(true)
      if (startRes.isErr()) {
        expect(startRes.error.kind).toBe("ALREADY_STARTED")
      }
    })

    it("Vector 3 (Extreme / Error Boundary - Merge failure): Propagates git error onDone cleanly", () => {
      const mockVcs: VersionControlProvider = Object.assign(Object.create(new NoopVcsProvider()), {
        extractTaskId: () => "26-001",
        autoMergeAndCleanup: () => err({ kind: "MERGE_ERROR" as const, message: "Merge conflict in file" } as VcsError),
      })

      const strategy = new GitWorktreeStrategy()
      const ctx: WorkspaceLifecycleContext = {
        vcs: mockVcs,
        vcsCtx: {
          isAvailable: true,
          repoRoot: "/workspace",
          currentBranch: "task/26-001-sample-feature",
          isWorktree: true,
        },
        config: DEFAULT_CONFIG,
        cwd: "/workspace.worktrees/26-001-sample-feature",
      }

      const doneRes = strategy.onDone(MOCK_TASK, ctx)
      expect(doneRes.isErr()).toBe(true)
      if (doneRes.isErr()) {
        expect(doneRes.error.kind).toBe("GIT_ERROR")
      }
    })
    it("Vector 4 (No-merge flag / config on Worktree): Preserves worktree without merging when noMerge is specified", () => {
      let mergeAttempted = false
      const mockVcs: VersionControlProvider = Object.assign(Object.create(new NoopVcsProvider()), {
        extractTaskId: (branch: string) => (branch.includes("26-001") ? "26-001" : null),
        autoMergeAndCleanup: () => {
          mergeAttempted = true
          return ok({ worktreeRemoved: false })
        },
      })

      const strategy = new GitWorktreeStrategy()
      const ctx: WorkspaceLifecycleContext = {
        vcs: mockVcs,
        vcsCtx: {
          isAvailable: true,
          repoRoot: "/workspace",
          currentBranch: "task/26-001-sample-feature",
          isWorktree: true,
        },
        config: DEFAULT_CONFIG,
        cwd: "/workspace.worktrees/26-001-sample-feature",
      }

      const doneRes = strategy.onDone(MOCK_TASK, ctx, { noMerge: true })
      expect(doneRes.isOk()).toBe(true)
      expect(mergeAttempted).toBe(false)
      if (doneRes.isOk()) {
        expect(doneRes.value.gitSkipped).toBe(true)
        expect(doneRes.value.message).toContain("--no-merge")
      }
    })
  })
})
