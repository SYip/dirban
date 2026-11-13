import pc from "picocolors"
import { boardCommand, viewCommand } from "../board/board.cli.ts"
import { validateConfig } from "../config/config.ts"
import { currentCommand, } from "../tasks/lifecycle/current.cli.ts"
import { doneCommand, } from "../tasks/lifecycle/done.cli.ts"
import { nextCommand } from "../tasks/lifecycle/next.cli.ts"
import { pathCommand } from "../tasks/lifecycle/path.cli.ts"
import { readyCommand } from "../tasks/lifecycle/ready.cli.ts"
import { resumeCommand } from "../tasks/lifecycle/resume.cli.ts"
import { startCommand } from "../tasks/lifecycle/start.cli.ts"
import { pruneCommand, worktreeCommand } from "../tasks/lifecycle/worktree.cli.ts"
import { archiveCommand, } from "../tasks/mutation/archive.cli.ts"
import { checkCommand, } from "../tasks/mutation/check.cli.ts"
import { newCommand } from "../tasks/mutation/create.cli.ts"
import { moveCommand } from "../tasks/mutation/move.cli.ts"
import { nextIdCommand } from "../tasks/mutation/next-id.cli.ts"
import { setCommand } from "../tasks/mutation/set.cli.ts"
import {
  blockCommand,
  unblockCommand,
} from "../tasks/planning/block.cli.ts"
import { planCommand } from "../tasks/planning/plan.cli.ts"
import { helpCommand, } from "../tasks/project/help.cli.ts"
import { initCommand } from "../tasks/project/init.cli.ts"
import { prioritiesCommand } from "../tasks/project/priorities.cli.ts"
import type { CliContext, CommandDefinition, } from "./types.ts"

export const ALL_COMMANDS: readonly CommandDefinition[] = Object.freeze([
  initCommand,
  boardCommand,
  nextCommand,
  currentCommand,
  readyCommand,
  startCommand,
  resumeCommand,
  doneCommand,
  worktreeCommand,
  pruneCommand,
  pathCommand,
  newCommand,
  nextIdCommand,
  prioritiesCommand,
  moveCommand,
  viewCommand,
  checkCommand,
  setCommand,
  archiveCommand,
  planCommand,
  blockCommand,
  unblockCommand,
  helpCommand,
])

export const findCommandDefinition = (nameOrAlias: string): CommandDefinition | undefined => {
  const target = nameOrAlias.trim().toLowerCase()
  return ALL_COMMANDS.find((cmd) => {
    if (cmd.name.toLowerCase() === target) return true
    return cmd.aliases?.some((alias) => alias.toLowerCase() === target) ?? false
  })
}

export const printCommandHelp = (cmd: CommandDefinition): void => {
  console.log(`\n${pc.bold(pc.cyan(`dirban ${cmd.name}`))} - ${cmd.summary}\n`)

  console.log(`${pc.bold("USAGE:")}`)
  for (const line of cmd.usage.split("\n")) {
    console.log(`  ${line}`)
  }

  if (cmd.aliases != null && cmd.aliases.length > 0) {
    console.log(`\n${pc.bold("ALIASES:")} ${cmd.aliases.join(", ")}`)
  }

  if (cmd.options != null && cmd.options.length > 0) {
    console.log(`\n${pc.bold("OPTIONS:")}`)
    for (const opt of cmd.options) {
      console.log(`  ${pc.yellow(opt.flag.padEnd(24))} ${opt.description}`)
    }
  }

  if (cmd.examples != null && cmd.examples.length > 0) {
    console.log(`\n${pc.bold("EXAMPLES:")}`)
    for (const ex of cmd.examples) {
      console.log(`  ${pc.gray(ex)}`)
    }
  }
  console.log()
}

export const printGlobalHelp = (): void => {
  console.log(`
${pc.bold(pc.cyan("Dirban (dirban)"))} - Zero-Database, Agent-Native Kanban Backed by Git & OKF

${pc.bold("USAGE:")}
  dirban [command] [options]
  dirban <command> --help

${pc.bold("COMMANDS:")}`)

  for (const cmd of ALL_COMMANDS) {
    if (cmd.name === "help") continue
    const aliasStr =
      cmd.aliases != null && cmd.aliases.length > 0 ? ` (aliases: ${cmd.aliases.join(", ")})` : ""
    console.log(`  ${pc.yellow(cmd.name.padEnd(16))} ${cmd.summary}${pc.gray(aliasStr)}`)
  }

  console.log(`
Run "${pc.cyan("dirban <command> --help")}" or "${pc.cyan("dirban help <command>")}" for detailed options and examples.
`)
}

export const dispatchCommand = async (commandName: string, ctx: CliContext): Promise<number> => {
  // Support 'worktree add' compound command as an alias to 'start'
  if (commandName === "worktree" && ctx.positionals[1] === "add") {
    return dispatchCommand("start", ctx)
  }

  // Handle 'dirban help <command>' or 'dirban help'
  if (commandName === "help") {
    const targetCmdName = ctx.positionals[1]
    if (targetCmdName != null && targetCmdName.trim() !== "") {
      const targetCmd = findCommandDefinition(targetCmdName)
      if (targetCmd != null) {
        printCommandHelp(targetCmd)
        return 0
      }
    }
    printGlobalHelp()
    return 0
  }

  const cmdDef = findCommandDefinition(commandName)
  if (cmdDef == null) {
    console.error(
      pc.red(`Unknown command: ${commandName}. Run "dirban --help" for available commands.`),
    )
    return 1
  }

  // Handle 'dirban <command> --help' or '-h'
  if (ctx.flags.help) {
    printCommandHelp(cmdDef)
    return 0
  }

  // Pre-execution Config Validation Pipeline
  const validationRes = validateConfig(ctx.config, {
    requireTasksDir: cmdDef.requiresTasksDir ?? false,
    workspaceRoot: ctx.cwd,
  })

  if (validationRes.isErr()) {
    console.error(pc.red(`Configuration Error: ${validationRes.error.message}`))
    return 1
  }

  // Pre-execution Command-level Parsing & Validation Pipeline
  if (cmdDef.parse != null) {
    const parseRes = cmdDef.parse(ctx)
    if (parseRes.isErr()) {
      console.error(pc.red(`Error: ${parseRes.error.message}`))
      return 1
    }
  }

  return cmdDef.execute(ctx)
}

export { printGlobalHelp as printHelp }
