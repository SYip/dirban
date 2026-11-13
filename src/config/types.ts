export type BranchStrategy = "checkout" | "worktree" | "none"

export interface DirbanConfig {
  readonly tasksDir: string
  readonly archiveDir: string
  readonly priorities: readonly string[]
  readonly defaultPriority: string
  readonly branchStrategy?: BranchStrategy
  readonly autoMerge?: boolean
  readonly worktreesDir?: string
  readonly branchPrefix?: string
  readonly focusColumn?: string
}

export type ConfigError =
  | { readonly kind: "FILE_READ_ERROR"; readonly message: string }
  | { readonly kind: "JSON_PARSE_ERROR"; readonly message: string }
  | { readonly kind: "VALIDATION_ERROR"; readonly message: string }
