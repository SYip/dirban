import { err, ok, type Result } from "neverthrow"
import type { Board, BoardTask } from "../../board/types.ts"
import type { VersionControlProvider } from "../../vcs/index.ts"

export type WorktreeAuditStatus = "active" | "blocked" | "completed" | "orphan"

export interface AuditedWorktree {
  readonly path: string
  readonly branchRef?: string
  readonly taskId?: string | null
  readonly status: WorktreeAuditStatus
  readonly isDirty: boolean
}

export interface PruneWorktreesResult {
  readonly removed: readonly AuditedWorktree[]
  readonly skippedDirty: readonly AuditedWorktree[]
  readonly failed: readonly { readonly worktree: AuditedWorktree; readonly message: string }[]
}

const classifyTaskColumn = (task: BoardTask | undefined): WorktreeAuditStatus => {
  if (task == null) {
    return "orphan"
  }
  if (task.column === "backlog") {
    return "blocked"
  }
  if (task.column === "03-done" || task.column === "archive") {
    return "completed"
  }
  return "active"
}

export const auditWorktrees = (
  board: Board,
  vcs: VersionControlProvider,
  cwd: string = process.cwd(),
): Result<readonly AuditedWorktree[], { readonly message: string }> => {
  const vcsCtx = vcs.getContext(cwd)
  if (!vcsCtx.isAvailable) {
    return err({ message: "Git repository not detected" })
  }

  const listRes = vcs.listWorktrees(cwd)
  if (listRes.isErr()) {
    return err({ message: listRes.error.message })
  }

  // Pre-index board tasks by lowercase ID for O(1) lookup
  const taskMap = new Map<string, BoardTask>()
  for (const col of board.columns) {
    for (const task of col.tasks) {
      const id = task.document.id ?? task.document.frontmatter.id
      if (id != null) {
        taskMap.set(id.toLowerCase(), task)
      }
    }
  }

  const audited: AuditedWorktree[] = []
  for (const entry of listRes.value) {
    if (entry.path === vcsCtx.repoRoot) {
      continue
    }

    const matchedTask = entry.taskId != null ? taskMap.get(entry.taskId.toLowerCase()) : undefined
    const status = classifyTaskColumn(matchedTask)
    const cleanRes = vcs.checkWorkingTreeClean({ cwd: entry.path })
    const isDirty = cleanRes.isErr() && cleanRes.error.kind === "DIRTY_WORKING_TREE"

    audited.push({
      path: entry.path,
      branchRef: entry.branchRef,
      taskId: entry.taskId,
      status,
      isDirty,
    })
  }

  return ok(audited)
}

export const pruneWorktrees = (
  board: Board,
  vcs: VersionControlProvider,
  options?: { readonly cwd?: string; readonly force?: boolean },
): Result<PruneWorktreesResult, { readonly message: string }> => {
  const cwd = options?.cwd ?? process.cwd()
  const force = options?.force === true

  const auditRes = auditWorktrees(board, vcs, cwd)
  if (auditRes.isErr()) {
    return err(auditRes.error)
  }

  const removed: AuditedWorktree[] = []
  const skippedDirty: AuditedWorktree[] = []
  const failed: { readonly worktree: AuditedWorktree; readonly message: string }[] = []

  for (const wt of auditRes.value) {
    if (wt.status !== "completed" && wt.status !== "orphan") {
      continue
    }

    if (wt.isDirty && !force) {
      skippedDirty.push(wt)
      continue
    }

    const removeRes = vcs.removeWorktree(wt.path, force, cwd)
    if (removeRes.isOk()) {
      removed.push(wt)
    } else {
      failed.push({ worktree: wt, message: removeRes.error.message })
    }
  }

  return ok({
    removed,
    skippedDirty,
    failed,
  })
}
