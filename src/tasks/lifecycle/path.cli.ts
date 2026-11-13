import pc from "picocolors"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"
import { getVcsProvider } from "../../vcs/index.ts"

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

export const pathCommand: CommandDefinition = {
  name: "path",
  summary: "Print absolute filesystem path of a task worktree or main repository",
  usage: "dirban path [id|main]",
  options: [],
  examples: ["cd $(dirban path)", "cd $(dirban path 26-001)"],
  requiresTasksDir: false,
  execute: handlePath,
}
