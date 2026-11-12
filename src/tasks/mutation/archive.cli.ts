import { discoverBoard } from "../../board/discovery.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"
import pc from "picocolors"
import { toRelativePath } from "../../cli/formatters.ts"
import { archiveTasks } from "./archive.ts"

export const handleArchive: CommandHandler = (ctx) => {
  const target = ctx.positionals[1] || "all"

  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const archiveRes = archiveTasks(boardRes.value, ctx.config, target, ctx.cwd)
  if (archiveRes.isErr()) {
    console.error(pc.red(`Archive Error: ${archiveRes.error.message}`))
    return 1
  }

  const archivedTasks = archiveRes.value.archivedTasks
  if (archivedTasks.length === 1 && archivedTasks[0] != null) {
    const singleTask = archivedTasks[0]
    const taskIdDisplay = singleTask.document.id ?? singleTask.filename
    const relPath = toRelativePath(singleTask.filePath, ctx.cwd)
    console.log(
      pc.green(
        `✔ Archived task ${taskIdDisplay}: ${pc.cyan(relPath)}`,
      ),
    )
  } else {
    const relTargetDir = toRelativePath(archiveRes.value.targetDirectory, ctx.cwd)
    console.log(
      pc.green(
        `✔ Successfully archived ${archivedTasks.length} task(s) to ${pc.cyan(relTargetDir)}`,
      ),
    )
  }
  return 0
}

export const archiveCommand: CommandDefinition = {
  name: "archive",
  summary: "Archive completed tasks directly to archive/",
  usage: "dirban archive [<id>|all]",
  options: [],
  examples: [
    "dirban archive all",
    "dirban archive 26-001",
  ],
  requiresTasksDir: true,
  execute: handleArchive,
}
