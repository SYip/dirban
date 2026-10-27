import type { BoardTask, SortMode } from "./types.ts"

const DEFAULT_PRIORITY_ORDER: Record<string, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3,
}

export const sortTasksByPriority = (
  tasks: readonly BoardTask[],
  customPriorities?: readonly string[],
): readonly BoardTask[] => {
  const getRank = (p: string): number => {
    if (customPriorities != null && customPriorities.length > 0) {
      const idx = customPriorities.indexOf(p)
      return idx >= 0 ? idx : 999
    }
    return DEFAULT_PRIORITY_ORDER[p] ?? 999
  }

  return [...tasks].sort((a, b) => {
    const pA = getRank(a.document.frontmatter.priority)
    const pB = getRank(b.document.frontmatter.priority)
    if (pA !== pB) {
      return pA - pB
    }
    return a.document.frontmatter.id.localeCompare(
      b.document.frontmatter.id,
      undefined,
      { numeric: true, sensitivity: "base" },
    )
  })
}

export const sortTasksByRecency = (
  tasks: readonly BoardTask[],
): readonly BoardTask[] => {
  return [...tasks].sort((a, b) => {
    const dateA = a.document.frontmatter.last_updated ||
      a.document.frontmatter.created_date || ""
    const dateB = b.document.frontmatter.last_updated ||
      b.document.frontmatter.created_date || ""
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA)
    }
    return a.document.frontmatter.id.localeCompare(
      b.document.frontmatter.id,
      undefined,
      { numeric: true, sensitivity: "base" },
    )
  })
}

export const sortTasksById = (
  tasks: readonly BoardTask[],
): readonly BoardTask[] => {
  return [...tasks].sort((a, b) => {
    return a.document.frontmatter.id.localeCompare(
      b.document.frontmatter.id,
      undefined,
      { numeric: true, sensitivity: "base" },
    )
  })
}

export const sortTasks = (
  tasks: readonly BoardTask[],
  mode: SortMode = "priority",
  customPriorities?: readonly string[],
): readonly BoardTask[] => {
  if (mode === "recency") {
    return sortTasksByRecency(tasks)
  }
  if (mode === "id") {
    return sortTasksById(tasks)
  }
  return sortTasksByPriority(tasks, customPriorities)
}

export const filterTasks = (
  tasks: readonly BoardTask[],
  filter?: {
    readonly tag?: string
    readonly owner?: string
    readonly search?: string
  },
): readonly BoardTask[] => {
  if (filter == null) {
    return tasks
  }

  return tasks.filter((t) => {
    if (filter.tag != null && filter.tag !== "") {
      const matchTag = t.document.frontmatter.tags.some((tag) =>
        tag.toLowerCase() === filter.tag?.toLowerCase()
      )
      if (!matchTag) return false
    }

    if (filter.owner != null && filter.owner !== "") {
      const matchOwner = t.document.frontmatter.owner.toLowerCase() ===
          filter.owner.toLowerCase() ||
        t.document.frontmatter.assigned_to.toLowerCase() ===
          filter.owner.toLowerCase()
      if (!matchOwner) return false
    }

    if (filter.search != null && filter.search !== "") {
      const q = filter.search.toLowerCase()
      const inTitle = t.document.frontmatter.title.toLowerCase().includes(q)
      const inId = t.document.frontmatter.id.toLowerCase().includes(q)
      const inBody = t.document.rawBody.toLowerCase().includes(q)
      if (!inTitle && !inId && !inBody) return false
    }

    return true
  })
}
