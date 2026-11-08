export type BranchStrategy = "checkout" | "worktree"

export interface DirbanConfig {
  readonly tasksDir: string
  readonly columns: readonly string[]
  readonly archiveDir: string
  readonly priorities: readonly string[]
  readonly defaultPriority: string
  readonly branchStrategy?: BranchStrategy
  readonly worktreesDir?: string
  readonly branchPrefix?: string
  readonly focusColumn?: string
}

export type ConfigError =
  | { readonly kind: "FILE_READ_ERROR"; readonly message: string }
  | { readonly kind: "JSON_PARSE_ERROR"; readonly message: string }
  | { readonly kind: "VALIDATION_ERROR"; readonly message: string }
