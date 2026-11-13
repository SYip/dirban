import * as fs from "node:fs"
import * as path from "node:path"
import { err, ok, type Result } from "neverthrow"
import { findTaskByIdOrName } from "../../board/discovery.ts"
import type { Board, BoardTask } from "../../board/types.ts"
import { resolveFocusColumn } from "../../config/config.ts"
import type { DirbanConfig } from "../../config/types.ts"
import { getVcsProvider, type VersionControlProvider } from "../../vcs/index.ts"
import {
  type LifecycleStrategyType,
  resolveWorkspaceStrategy,
  type WorkspaceLifecycleStrategy,
} from "../../workspace/index.ts"
import { unblockTask } from "../planning/block.ts"
import { assertWorkingTreeClean, isVcsOperationSkipped } from "./guard.ts"

export interface ResumeTaskSuccess {
  readonly task: BoardTask
  readonly branchName: string
  readonly strategy: LifecycleStrategyType
  readonly worktreePath?: string
  readonly advisoryMessage?: string
}

export type ResumeTaskError =
  | { readonly kind: "TASK_NOT_FOUND"; readonly id: string; readonly message: string }
  | { readonly kind: "TASK_NOT_BLOCKED"; readonly message: string }
  | {
      readonly kind: "DIRTY_WORKING_TREE"
      readonly message: string
      readonly dirtyFiles: readonly string[]
    }
  | {
      readonly kind: "HAS_ACTIVE_BLOCKERS"
      readonly message: string
      readonly blockers: readonly string[]
    }
  | { readonly kind: "GIT_CONFLICT"; readonly message: string }
  | { readonly kind: "FS_ERROR"; readonly message: string }

export interface ResumeTaskOptions {
  readonly cwd?: string
  readonly vcsProvider?: VersionControlProvider
  readonly noGit?: boolean
  readonly workspaceStrategy?: WorkspaceLifecycleStrategy
  readonly force?: boolean
  readonly sync?: boolean
}

const resolveWorktreeOrBranch = (
  strategyName: string,
  effectiveId: string,
  vcs: VersionControlProvider,
  vcsCtx: { readonly repoRoot?: string },
  config: DirbanConfig,
  cwd: string,
): { readonly worktreePath?: string; readonly branchName: string } => {
  const branchPrefix = config.branchPrefix ?? "task/"
  const branchName = vcs.deriveBranchName(branchPrefix, effectiveId, "")

  if (strategyName === "checkout") {
    vcs.switchOrCreateBranch(branchName, cwd)
    return { branchName }
  }

  if (strategyName !== "worktree") {
    return { branchName }
  }

  const wtRes = vcs.resolveWorktreePath(effectiveId, cwd)
  if (wtRes.isOk()) {
    return { worktreePath: wtRes.value, branchName }
  }

  if (vcsCtx.repoRoot != null) {
    const worktreesDirTemplate = config.worktreesDir ?? ".worktrees/{taskId}"
    const targetPath = vcs.deriveWorktreePath(
      vcsCtx.repoRoot,
      worktreesDirTemplate,
      effectiveId,
      "",
    )
    const createRes = vcs.createWorktree(targetPath, branchName, cwd)
    if (createRes.isOk()) {
      return { worktreePath: targetPath, branchName }
    }
  }

  return { branchName }
}

const syncResumedFileToWorktree = (
  activeWorktreePath: string | undefined,
  tasksDir: string,
  focusColName: string,
  filename: string,
  sourceFilePath: string,
): void => {
  if (activeWorktreePath == null) return
  const worktreeTarget = path.join(activeWorktreePath, tasksDir, focusColName, filename)
  const worktreeOld = path.join(activeWorktreePath, tasksDir, "backlog", filename)
  try {
    fs.mkdirSync(path.dirname(worktreeTarget), { recursive: true })
    if (fs.existsSync(worktreeOld) && worktreeOld !== worktreeTarget) {
      fs.unlinkSync(worktreeOld)
    }
    fs.copyFileSync(sourceFilePath, worktreeTarget)
  } catch {
    // Non-fatal sync
  }
}

export const resumeTask = (
  board: Board,
  config: DirbanConfig,
  taskId: string,
  options?: ResumeTaskOptions,
): Result<ResumeTaskSuccess, ResumeTaskError> => {
  const cwd = options?.cwd ?? process.cwd()
  const vcs = options?.vcsProvider ?? getVcsProvider(cwd)
  const task = findTaskByIdOrName(board, taskId)
  if (task == null) {
    return err({
      kind: "TASK_NOT_FOUND",
      id: taskId,
      message: `Task not found: ${taskId}`,
    })
  }

  const effectiveId = task.document.id ?? task.filename
  const focusColName = resolveFocusColumn(config) ?? "02-doing"

  // Check if task is already in focus column
  if (task.column === focusColName) {
    return err({
      kind: "TASK_NOT_BLOCKED",
      message: `Task ${effectiveId} is already active in '${focusColName}'.`,
    })
  }

  // Check if task still has active blockers (unless forced)
  const deps = task.document.frontmatter.relationships?.depends_on ?? []
  if (deps.length > 0 && !options?.force) {
    return err({
      kind: "HAS_ACTIVE_BLOCKERS",
      message: `Cannot resume task ${effectiveId}: task still has ${deps.length} unresolved blocker(s): [${deps.join(", ")}]. Use 'dirban unblock' or pass --force.`,
      blockers: deps,
    })
  }

  const vcsCtx = vcs.getContext(cwd)
  const strategy = options?.workspaceStrategy ?? resolveWorkspaceStrategy(undefined, vcsCtx, config)

  // Dirty working tree check on target branch / root
  const cleanRes = assertWorkingTreeClean({
    vcs,
    vcsCtx,
    tasksDir: config.tasksDir ?? "docs/tasks",
    cwd,
    strategyName: strategy.name,
    noGit: options?.noGit,
    force: options?.force,
  })
  if (cleanRes.isErr()) {
    return err(cleanRes.error)
  }

  // If forced with remaining blockers, clear them
  let workingTask = task
  if (deps.length > 0 && options?.force) {
    const unblockAllRes = unblockTask(board, taskId)
    if (unblockAllRes.isOk()) {
      workingTask = unblockAllRes.value.task
    }
  }

  // 1. Resolve worktree or branch
  const { worktreePath: activeWorktreePath, branchName } = resolveWorktreeOrBranch(
    strategy.name,
    effectiveId,
    vcs,
    vcsCtx,
    config,
    cwd,
  )

  // 2. Move file from backlog/ to focus column (e.g. 02-doing/)
  const tasksDir = config.tasksDir ?? "docs/tasks"
  const repoRoot = vcsCtx.repoRoot
  const tasksRoot =
    repoRoot != null && fs.existsSync(repoRoot)
      ? path.join(repoRoot, tasksDir)
      : path.dirname(path.dirname(workingTask.filePath))
  const targetColDir = path.join(tasksRoot, focusColName)
  const targetFilePath = path.join(targetColDir, workingTask.filename)

  try {
    fs.mkdirSync(targetColDir, { recursive: true })
    if (workingTask.filePath !== targetFilePath && fs.existsSync(workingTask.filePath)) {
      fs.renameSync(workingTask.filePath, targetFilePath)
    }
  } catch (fsErr) {
    return err({
      kind: "FS_ERROR",
      message: fsErr instanceof Error ? fsErr.message : "Failed to move resumed task file",
    })
  }

  // Also sync into worktree if active
  syncResumedFileToWorktree(
    activeWorktreePath,
    tasksDir,
    focusColName,
    workingTask.filename,
    targetFilePath,
  )

  const updatedTask: BoardTask = {
    ...workingTask,
    column: focusColName,
    filePath: targetFilePath,
  }

  // 3. Commit on target branch
  if (!isVcsOperationSkipped(vcsCtx, strategy.name, options?.noGit)) {
    const taskTitle = task.document.frontmatter.title ?? effectiveId
    const commitMsg = `chore(task): resume ${effectiveId} ${taskTitle}`.trim()
    vcs.commitFile(targetFilePath, commitMsg, cwd)
  }

  return ok({
    task: updatedTask,
    branchName,
    strategy: strategy.name,
    worktreePath: activeWorktreePath,
  })
}
