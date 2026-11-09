export type OperationError =
  | {
    readonly kind: "TASK_NOT_FOUND"
    readonly message: string
    readonly id: string
  }
  | {
    readonly kind: "COLUMN_NOT_FOUND"
    readonly message: string
    readonly column: string
  }
  | { readonly kind: "FS_ERROR"; readonly message: string }
  | {
    readonly kind: "INDEX_OUT_OF_BOUNDS"
    readonly message: string
    readonly index: number
  }
  | { readonly kind: "INVALID_MUTATION"; readonly message: string }
