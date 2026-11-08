#!/usr/bin/env bun
import { parseArgs } from "node:util"
import * as process from "node:process"
import pc from "picocolors"
import { loadConfig } from "./src/config/config.ts"
import { dispatchCommand, printHelp } from "./src/cli/commands/router.ts"
import { CLI_PARSE_OPTIONS, type CliFlags } from "./src/cli/commands/types.ts"

export const runCli = async (args: readonly string[]): Promise<number> => {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: CLI_PARSE_OPTIONS,
    allowPositionals: true,
  })
  const flags = values as CliFlags

  if (flags.help && positionals.length === 0) {
    printHelp()
    return 0
  }

  if (flags.version) {
    console.log("dirban v0.1.0 (Phase 1)")
    return 0
  }

  const configRes = loadConfig()
  if (configRes.isErr()) {
    console.error(pc.red(`Configuration Error: ${configRes.error.message}`))
    return 1
  }

  const command = positionals[0] ?? "board"
  return dispatchCommand(command, {
    flags,
    positionals,
    config: configRes.value,
    cwd: process.cwd(),
  })
}

if (import.meta.main || process.argv[1]?.endsWith("main.ts")) {
  const exitCode = await runCli(process.argv.slice(2))
  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}
