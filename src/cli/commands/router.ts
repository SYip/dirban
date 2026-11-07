import pc from "picocolors"
import type { CliContext, CommandHandler } from "./types.ts"
import { handleCurrent, handleDone, handlePath, handleStart } from "./lifecycle.ts"
import {
  handleArchive,
  handleCheck,
  handleMove,
  handleNew,
  handleSet,
} from "./task-mutation.ts"
import { handleBoard, handleView } from "./board.ts"
import {
  handleHelp,
  handleInit,
  handleNextId,
  handlePriorities,
  printHelp,
} from "./system.ts"
import { handleBlock, handlePlan, handleUnblock } from "./plan.ts"

const COMMAND_MAP: Readonly<Record<string, CommandHandler>> = {
  init: handleInit,
  board: handleBoard,
  current: handleCurrent,
  focus: handleCurrent,
  start: handleStart,
  done: handleDone,
  finish: handleDone,
  path: handlePath,
  new: handleNew,
  create: handleNew,
  "next-id": handleNextId,
  priorities: handlePriorities,
  move: handleMove,
  view: handleView,
  check: handleCheck,
  set: handleSet,
  archive: handleArchive,
  plan: handlePlan,
  block: handleBlock,
  unblock: handleUnblock,
  help: handleHelp,
}

export const dispatchCommand = async (
  commandName: string,
  ctx: CliContext,
): Promise<number> => {
  // Support 'worktree add' compound command as an alias to 'start'
  if (commandName === "worktree" && ctx.positionals[1] === "add") {
    return handleStart(ctx)
  }

  const handler = COMMAND_MAP[commandName]
  if (handler == null) {
    console.error(
      pc.red(
        `Unknown command: ${commandName}. Run "dirban --help" for available commands.`,
      ),
    )
    return 1
  }

  return handler(ctx)
}

export { printHelp }

