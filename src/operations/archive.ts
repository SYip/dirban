import { err, ok, type Result } from "neverthrow"
import * as path from "node:path"
import * as fs from "node:fs"
import type { Board, BoardTask } from "../board/types.ts"
import type { DirbanConfig } from "../config/types.ts"
import { findTaskByIdOrName } from "../board/discovery.ts"
import type { OperationError } from "./types.ts"

export interface ArchiveResult {
  readonly archivedTasks: readonly BoardTask[]
  readonly targetDirectory: string
}

export const archiveTasks = (
  board: Board,
  config: DirbanConfig,
  taskIdOrAll?: string,
  workspaceRoot: string = process.cwd(),
): Result<ArchiveResult, OperationError> => {
  const archiveBaseDir = path.isAbsolute(config.archiveDir)
    ? config.archiveDir
    : path.join(workspaceRoot, config.archiveDir)

  try {
    fs.mkdirSync(archiveBaseDir, { recursive: true })
  } catch (mkdirErr) {
    return err({
      kind: "FS_ERROR",
      message: mkdirErr instanceof Error
        ? mkdirErr.message
        : "Failed to create archive directory",
    })
  }

  const tasksToArchive: BoardTask[] = []

  if (taskIdOrAll != null && taskIdOrAll !== "" && taskIdOrAll !== "all") {
    const task = findTaskByIdOrName(board, taskIdOrAll)
    if (task == null) {
      return err({
        kind: "TASK_NOT_FOUND",
        message: `Task not found: ${taskIdOrAll}`,
        id: taskIdOrAll,
      })
    }
    tasksToArchive.push(task)
  } else {
    // Archive all tasks in completed/done columns
    for (const col of board.columns) {
      if (
        col.name.toLowerCase().includes("done") ||
        col.name.toLowerCase().includes("completed")
      ) {
        tasksToArchive.push(...col.tasks)
      }
    }
  }

  const archived: BoardTask[] = []

  for (const task of tasksToArchive) {
    const destPath = path.join(archiveBaseDir, task.filename)
    try {
      fs.renameSync(task.filePath, destPath)
      archived.push({
        ...task,
        filePath: destPath,
        column: "archive",
      })
    } catch (renameErr) {
      return err({
        kind: "FS_ERROR",
        message: renameErr instanceof Error
          ? renameErr.message
          : "Failed to move task to archive directory",
      })
    }
  }

  return ok({
    archivedTasks: archived,
    targetDirectory: archiveBaseDir,
  })
}
