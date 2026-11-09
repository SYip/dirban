import { discoverBoard } from "../../board/discovery.ts"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"
import pc from "picocolors"
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

  console.log(
    pc.green(
      `✔ Successfully archived ${archiveRes.value.archivedTasks.length} task(s) to ${archiveRes.value.targetDirectory}`,
    ),
  )
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
