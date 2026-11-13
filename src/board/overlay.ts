import * as fs from "node:fs"
import * as path from "node:path"
import { parseTaskDocument } from "../okf/parser.ts"
import type { VersionControlProvider } from "../vcs/index.ts"
import type { BoardTask } from "./types.ts"

/**
 * Builds a Map<taskId, worktreePath> from active VCS worktrees for O(1) lookup.
 */
export const buildWorktreeTaskMap = (
  vcs: VersionControlProvider,
  workspaceRoot: string,
): ReadonlyMap<string, string> => {
  const vcsCtx = vcs.getContext(workspaceRoot)
  if (!vcsCtx.isAvailable) {
    return new Map()
  }

  const listRes = vcs.listWorktrees(workspaceRoot)
  if (listRes.isErr()) {
    return new Map()
  }

  const map = new Map<string, string>()
  for (const entry of listRes.value) {
    if (entry.taskId != null && entry.path !== vcsCtx.repoRoot) {
      map.set(entry.taskId.toLowerCase(), entry.path)
    }
  }

  return map
}

/**
 * Overlays live task document content (e.g. checked-off acceptance criteria)
 * from an active worktree if the task exists there, preserving the board column.
 */
export const overlayWorktreeTask = (
  task: BoardTask,
  worktreeMap: ReadonlyMap<string, string>,
  tasksDir: string,
): BoardTask => {
  if (worktreeMap.size === 0) {
    return task
  }

  const taskId = task.document.id ?? task.document.frontmatter.id
  if (taskId == null) {
    return task
  }

  const worktreePath = worktreeMap.get(taskId.toLowerCase())
  if (worktreePath == null) {
    return task
  }

  const worktreeTaskFile = path.join(worktreePath, tasksDir, task.column, task.filename)
  if (!fs.existsSync(worktreeTaskFile)) {
    return task
  }

  try {
    const content = fs.readFileSync(worktreeTaskFile, "utf-8")
    const parseRes = parseTaskDocument(content, task.filename)
    if (parseRes.isErr()) {
      return task
    }

    const overlaidDoc = {
      ...parseRes.value,
      frontmatter: {
        ...parseRes.value.frontmatter,
        status: task.column,
      },
    }

    return {
      ...task,
      document: overlaidDoc,
    }
  } catch {
    return task
  }
}
