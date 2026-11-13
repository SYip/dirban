import pc from "picocolors"
import type { CommandDefinition, CommandHandler } from "../../cli/types.ts"
import { initializeBoard } from "./init.ts"

export const handleInit: CommandHandler = (ctx) => {
  const configTarget =
    ctx.flags.config === "vscode" || ctx.flags.config === "dirban" ? ctx.flags.config : "auto"

  const initRes = initializeBoard(ctx.config, ctx.cwd, { configTarget })
  if (initRes.isErr()) {
    console.error(pc.red(`Init Error: ${initRes.error.message}`))
    return 1
  }

  console.log(
    pc.bold(pc.green(`✔ Initialized Dirban board in ${pc.cyan(initRes.value.tasksDir)}:`)),
  )
  for (const col of ctx.config.columns) {
    console.log(`  ├── ${pc.yellow(col)}/`)
  }
  console.log(`  └── ${pc.gray("archive/")}`)

  if (initRes.value.configFileCreated != null) {
    console.log(
      pc.green(`\n✔ Created configuration in ${pc.cyan(initRes.value.configFileCreated)}`),
    )
  } else if (initRes.value.configFileUpdated != null) {
    console.log(
      pc.green(`\n✔ Added dirban settings to ${pc.cyan(initRes.value.configFileUpdated)}`),
    )
  }

  console.log(`\nRun "${pc.cyan("dirban board")}" to view your board.`)
  return 0
}

export const initCommand: CommandDefinition = {
  name: "init",
  summary: "Initialize board directory structure and settings (.dirban.json or .vscode)",
  usage: "dirban init [options]",
  options: [
    { flag: "--config=<vscode|dirban>", description: "Target configuration file format" },
    { flag: "-y, --yes", description: "Accept all defaults non-interactively" },
  ],
  examples: ["dirban init", "dirban init --config=dirban", "dirban init -y"],
  requiresTasksDir: false,
  execute: handleInit,
}
