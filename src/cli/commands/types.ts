import { parseArgs } from "node:util"

export interface CliFlags {
  readonly help?: boolean
  readonly version?: boolean
  readonly static?: boolean
  readonly open?: boolean
  readonly column?: string
  readonly tag?: string
  readonly owner?: string
  readonly search?: string
  readonly sort?: string
  readonly priority?: string
  readonly assignee?: string
  readonly title?: string
  readonly tags?: string
  readonly config?: string
  readonly yes?: boolean
  readonly raw?: boolean
  readonly checkout?: boolean
  readonly worktree?: boolean
  readonly ready?: boolean
  readonly blocked?: boolean
  readonly promote?: string
  readonly to?: string
  readonly interactive?: boolean
}

export type ParseArgsConfig = NonNullable<Parameters<typeof parseArgs>[0]>

export const CLI_PARSE_OPTIONS: NonNullable<ParseArgsConfig["options"]> = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  static: { type: "boolean", short: "s" },
  open: { type: "boolean" },
  column: { type: "string" },
  tag: { type: "string" },
  owner: { type: "string" },
  search: { type: "string" },
  sort: { type: "string" },
  priority: { type: "string" },
  assignee: { type: "string" },
  title: { type: "string" },
  tags: { type: "string" },
  config: { type: "string" },
  yes: { type: "boolean", short: "y" },
  raw: { type: "boolean" },
  checkout: { type: "boolean" },
  worktree: { type: "boolean" },
  ready: { type: "boolean" },
  blocked: { type: "boolean" },
  promote: { type: "string" },
  to: { type: "string" },
  interactive: { type: "boolean", short: "i" },
}

export interface CliContext {
  readonly flags: CliFlags
  readonly positionals: readonly string[]
  readonly config: import("../../config/types.ts").DirbanConfig
  readonly cwd: string
}

export type CommandHandler = (ctx: CliContext) => Promise<number> | number

export interface CommandOption {
  readonly flag: string
  readonly description: string
}

export interface CommandDefinition {
  readonly name: string
  readonly aliases?: readonly string[]
  readonly summary: string
  readonly usage: string
  readonly options?: readonly CommandOption[]
  readonly examples?: readonly string[]
  readonly requiresTasksDir?: boolean
  readonly execute: CommandHandler
}
