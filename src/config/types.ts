export interface DirbanConfig {
  readonly tasksDir: string
  readonly columns: readonly string[]
  readonly archiveDir: string
  readonly defaultPriority: "p0" | "p1" | "p2" | "p3"
}

export type ConfigError =
  | { readonly kind: "FILE_READ_ERROR"; readonly message: string }
  | { readonly kind: "JSON_PARSE_ERROR"; readonly message: string }
  | { readonly kind: "VALIDATION_ERROR"; readonly message: string }
