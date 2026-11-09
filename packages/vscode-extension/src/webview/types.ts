import type { BoardTask } from "@dirban/core/board/types.ts"

export interface WebviewColumn {
  readonly name: string
  readonly title: string
  readonly tasks: readonly BoardTask[]
}

export interface WebviewBoardState {
  readonly workspaceRoot: string
  readonly columns: readonly WebviewColumn[]
  readonly activeTaskId?: string
}

export type WebviewMessageToExtension =
  | { readonly type: "requestBoardState" }
  | { readonly type: "moveTask"; readonly taskId: string; readonly targetColumn: string }
  | { readonly type: "toggleCriterion"; readonly taskId: string; readonly itemIndex: number; readonly checked: boolean }
  | { readonly type: "openFile"; readonly filePath: string }
  | { readonly type: "createTask"; readonly title: string; readonly priority?: string; readonly column?: string }

export type ExtensionMessageToWebview =
  | { readonly type: "boardState"; readonly state: WebviewBoardState }
  | { readonly type: "notification"; readonly kind: "info" | "error" | "warn"; readonly message: string }
