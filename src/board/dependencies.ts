import type { Board, BoardTask } from "./types.ts"

const TASK_ID_REGEX = /^\d{2}-\d{3}$/

export const isTaskId = (value: string): boolean => TASK_ID_REGEX.test(value.trim())

export interface TaskBlockerEvaluation {
  readonly isBlocked: boolean
  readonly unresolved: readonly string[]
  readonly resolved: readonly string[]
}

const isDoneColumn = (columnName: string): boolean => {
  const normalized = columnName.toLowerCase()
  return normalized.includes("done") || normalized.startsWith("archive")
}

export const isDependencyResolved = (
  dependency: string,
  board: Board,
): boolean => {
  const trimmed = dependency.trim()
  if (!isTaskId(trimmed)) {
    // Freeform text blockers remain unresolved until explicitly unblocked
    return false
  }

  // Find target task by ID across all columns
  for (const column of board.columns) {
    for (const task of column.tasks) {
      const id = task.document.id ?? task.document.frontmatter.id
      if (id === trimmed) {
        return isDoneColumn(task.column)
      }
    }
  }

  // Task ID not found on board -> considered unresolved
  return false
}

export const evaluateTaskBlockers = (
  task: BoardTask,
  board: Board,
): TaskBlockerEvaluation => {
  const dependencies = task.document.frontmatter.relationships?.depends_on ?? []
  if (dependencies.length === 0) {
    return {
      isBlocked: false,
      unresolved: [],
      resolved: [],
    }
  }

  const resolved: string[] = []
  const unresolved: string[] = []

  for (const dep of dependencies) {
    if (isDependencyResolved(dep, board)) {
      resolved.push(dep)
    } else {
      unresolved.push(dep)
    }
  }

  return {
    isBlocked: unresolved.length > 0,
    unresolved,
    resolved,
  }
}

