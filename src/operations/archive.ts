import { err, ok, type Result } from "neverthrow"
import * as path from "node:path"
import * as fs from "node:fs"
import type { Board, BoardTask } from "../board/types.ts"
import type { DirbanConfig } from "../config/types.ts"
import { findTaskByIdOrName } from "../board/discovery.ts"
import { getIsoDate } from "./move.ts"
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
  const currentYear = getIsoDate().slice(0, 4)
  const archiveBaseDir = path.isAbsolute(config.archiveDir)
    ? config.archiveDir
    : path.join(workspaceRoot, config.archiveDir)

  const targetYearDir = path.join(archiveBaseDir, currentYear)

  try {
    fs.mkdirSync(targetYearDir, { recursive: true })
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
    const destPath = path.join(targetYearDir, task.filename)
    try {
      fs.renameSync(task.filePath, destPath)
      archived.push(Object.freeze({
        ...task,
        filePath: destPath,
        column: `archive/${currentYear}`,
      }))
    } catch (renameErr) {
      return err({
        kind: "FS_ERROR",
        message: renameErr instanceof Error
          ? renameErr.message
          : "Failed to move task to archive directory",
      })
    }
  }

  return ok(Object.freeze({
    archivedTasks: Object.freeze(archived),
    targetDirectory: targetYearDir,
  }))
}
