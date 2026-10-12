export type Priority = "p0" | "p1" | "p2" | "p3"

export type TaskOwner = "developer" | "agent" | "unassigned" | string

export interface TaskRelationships {
  readonly depends_on: readonly string[]
  readonly blocks: readonly string[]
  readonly related_to: readonly string[]
}

export interface TaskFrontmatter {
  readonly okf_version: string
  readonly id: string
  readonly title: string
  readonly type: "task"
  readonly status: string
  readonly priority: Priority
  readonly owner: TaskOwner
  readonly assigned_to: string
  readonly created_date: string
  readonly last_updated: string
  readonly tags: readonly string[]
  readonly relationships: TaskRelationships
}

export interface ChecklistItem {
  readonly index: number
  readonly text: string
  readonly checked: boolean
  readonly rawLine: string
}

export interface TaskDocument {
  readonly frontmatter: TaskFrontmatter
  readonly titleHeader: string
  readonly objectiveScope: string
  readonly acceptanceCriteria: readonly ChecklistItem[]
  readonly verificationPlan: string
  readonly executionJournal: readonly string[]
  readonly otherSections: readonly {
    readonly heading: string
    readonly content: string
  }[]
  readonly rawBody: string
}

export type ParseError =
  | { readonly kind: "EMPTY_CONTENT"; readonly message: string }
  | { readonly kind: "MISSING_FRONTMATTER"; readonly message: string }
  | { readonly kind: "INVALID_YAML"; readonly message: string }
  | {
    readonly kind: "INVALID_SCHEMA"
    readonly message: string
    readonly field?: string
  }
