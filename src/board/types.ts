import type { TaskDocument } from "../okf/types.ts"

export interface BoardTask {
  readonly filePath: string
  readonly filename: string
  readonly column: string
  readonly document: TaskDocument
}

export interface Column {
  readonly name: string
  readonly path: string
  readonly orderIndex: number
  readonly tasks: readonly BoardTask[]
}

export interface Board {
  readonly rootDir: string
  readonly columns: readonly Column[]
  readonly totalTasks: number
}

export type SortMode = "priority" | "recency" | "id"

export interface BoardFilterOptions {
  readonly tag?: string
  readonly owner?: string
  readonly search?: string
  readonly sortMode?: SortMode
}

export type BoardError =
  | {
    readonly kind: "DIRECTORY_NOT_FOUND"
    readonly message: string
    readonly path: string
  }
  | {
    readonly kind: "FILE_READ_ERROR"
    readonly message: string
    readonly path: string
  }
  | {
    readonly kind: "TASK_PARSE_ERROR"
    readonly message: string
    readonly path: string
  }
