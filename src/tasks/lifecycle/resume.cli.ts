import { err, ok } from "neverthrow"
import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { toRelativePath } from "../../cli/formatters.ts"
import type { CommandDefinition, CommandHandler, CommandParser } from "../../cli/types.ts"
import { resumeTask } from "./resume.ts"

export interface ResumeCommandParams {
  readonly taskId: string
  readonly force?: boolean
  readonly sync?: boolean
}

export const parseResume: CommandParser<ResumeCommandParams> = (ctx) => {
  const taskId = ctx.positionals[1]?.trim()
  if (taskId == null || taskId === "") {
    return err({ message: "Task ID required. Usage: dirban resume <id> [--force] [--sync]" })
  }
  const force = ctx.flags.force === true
  const sync = ctx.flags.sync === true
  return ok({ taskId, force, sync })
}

export const handleResume: CommandHandler = (ctx) => {
  const parseRes = parseResume(ctx)
  if (parseRes.isErr()) {
    console.error(pc.red(`Error: ${parseRes.error.message}`))
    return 1
  }

  const { taskId, force, sync } = parseRes.value
  const boardRes = discoverBoard(ctx.config, ctx.cwd)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const resumeRes = resumeTask(boardRes.value, ctx.config, taskId, {
    cwd: ctx.cwd,
    force,
    sync,
  })

  if (resumeRes.isErr()) {
    console.error(pc.red(`Resume Error: ${resumeRes.error.message}`))
    return 1
  }

  const { task, branchName, strategy, worktreePath, advisoryMessage } = resumeRes.value
  const relPath = toRelativePath(task.filePath, ctx.cwd)

  console.log(pc.green(`✔ Resumed task ${task.document.id}: ${pc.cyan(relPath)}`))
  if (strategy === "worktree" && worktreePath != null) {
    console.log(pc.gray(`   Workspace active at: ${pc.yellow(worktreePath)}`))
  } else if (strategy === "checkout") {
    console.log(pc.gray(`   Switched to branch: ${pc.yellow(branchName)}`))
  }

  if (advisoryMessage != null) {
    console.log(pc.cyan(`   ℹ ${advisoryMessage}`))
  }

  return 0
}

export const resumeCommand: CommandDefinition = {
  name: "resume",
  summary: "Resume a blocked or previously started task into active WIP",
  aliases: ["continue"],
  usage: "dirban resume <id> [--force] [--sync]",
  parse: parseResume,
  execute: handleResume,
}
