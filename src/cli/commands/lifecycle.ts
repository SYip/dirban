import * as fs from "node:fs"
import * as process from "node:process"
import pc from "picocolors"
import { discoverBoard } from "../../board/discovery.ts"
import { formatCurrentTaskView } from "../formatters.ts"
import { resolveCurrentTask } from "../../operations/current.ts"
import { startTask } from "../../operations/start.ts"
import { doneTask } from "../../operations/done.ts"
import { getVcsProvider } from "../../vcs/index.ts"
import type { BranchStrategy } from "../../config/types.ts"
import type { CommandHandler } from "./types.ts"

export const handleCurrent: CommandHandler = (ctx) => {
  const explicitId = ctx.positionals[1]
  const boardRes = discoverBoard(ctx.config)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const currentRes = resolveCurrentTask(boardRes.value, ctx.config, explicitId)
  if (currentRes.isErr()) {
    console.log(currentRes.error.message)
    return 0
  }

  const { task, multipleInDoing, doingCount } = currentRes.value

  if (ctx.flags.raw) {
    try {
      const rawContent = fs.readFileSync(task.filePath, "utf-8")
      process.stdout.write(rawContent)
      return 0
    } catch (readErr) {
      console.error(
        pc.red(
          `Failed to read task file: ${readErr instanceof Error ? readErr.message : "Unknown error"}`,
        ),
      )
      return 1
    }
  }

  if (multipleInDoing) {
    console.log(
      pc.yellow(
        `Notice: Multiple tasks in doing (${doingCount}). Selected highest-priority task.`,
      ),
    )
  }

  console.log(formatCurrentTaskView(task))
  return 0
}

export const handleStart: CommandHandler = (ctx) => {
  const isWorktreeCmd = ctx.positionals[0] === "worktree"
  const taskId = isWorktreeCmd ? ctx.positionals[2] : ctx.positionals[1]
  if (taskId == null || taskId.trim() === "") {
    console.error(pc.red("Error: Missing task ID. Usage: dirban start <id> [--checkout|--worktree]"))
    return 1
  }

  const boardRes = discoverBoard(ctx.config)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const strategy: BranchStrategy | undefined = ctx.flags.worktree
    ? "worktree"
    : ctx.flags.checkout
    ? "checkout"
    : undefined

  const startRes = startTask(boardRes.value, ctx.config, taskId.trim(), { strategy })
  if (startRes.isErr()) {
    console.error(pc.red(`Start Error: ${startRes.error.message}`))
    return 1
  }

  const { task, branchName, strategy: usedStrategy, worktreePath, gitSkipped, gitMessage } = startRes.value
  console.log(
    pc.green(
      `✔ Moved task ${task.document.id ?? task.filename} to ${task.column}`,
    ),
  )

  if (gitSkipped && gitMessage != null) {
    console.log(pc.yellow(`Notice: ${gitMessage}`))
  } else if (usedStrategy === "worktree" && worktreePath != null) {
    console.log(
      pc.green(
        `✔ Created worktree for branch ${pc.cyan(branchName)} at ${pc.cyan(worktreePath)}`,
      ),
    )
  } else {
    console.log(
      pc.green(`✔ Active on branch ${pc.cyan(branchName)} (${usedStrategy})`),
    )
  }
  return 0
}

export const handleDone: CommandHandler = (ctx) => {
  const taskId = ctx.positionals[1]
  const boardRes = discoverBoard(ctx.config)
  if (boardRes.isErr()) {
    console.error(pc.red(`Board Error: ${boardRes.error.message}`))
    return 1
  }

  const doneRes = doneTask(boardRes.value, ctx.config, taskId)
  if (doneRes.isErr()) {
    console.error(pc.red(`Done Error: ${doneRes.error.message}`))
    return 1
  }

  const { task, uncheckedCount, mergedBranch, baseBranch, worktreeRemoved, gitSkipped, message } = doneRes.value
  console.log(
    pc.green(
      `✔ Completed task ${task.document.id ?? task.filename} (moved to ${task.column})`,
    ),
  )

  if (uncheckedCount > 0) {
    console.log(
      pc.yellow(
        `Notice: ${uncheckedCount} acceptance criteria remain unchecked.`,
      ),
    )
  }

  if (!gitSkipped && mergedBranch != null && baseBranch != null) {
    console.log(
      pc.green(`✔ Auto-merged branch ${pc.cyan(mergedBranch)} into ${pc.cyan(baseBranch)}`),
    )
    if (worktreeRemoved) {
      console.log(pc.green(`✔ Removed completed worktree directory`))
    }
  } else if (message != null) {
    console.log(pc.dim(`Git notice: ${message}`))
  }

  return 0
}

export const handlePath: CommandHandler = (ctx) => {
  const target = ctx.positionals[1]
  const vcsProvider = getVcsProvider()
  const pathResult = vcsProvider.resolveWorktreePath(target)

  if (pathResult.isErr()) {
    console.error(pc.red(`Error: ${pathResult.error.message}`))
    return 1
  }

  // Print raw path to stdout (clean for command substitution like `cd $(dirban path)`)
  console.log(pathResult.value)
  return 0
}

