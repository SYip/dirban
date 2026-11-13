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
    const pA = getRank(a.document.priority ?? a.document.frontmatter.priority ?? "p3")
    const pB = getRank(b.document.priority ?? b.document.frontmatter.priority ?? "p3")
    if (pA !== pB) {
      return pA - pB
    }
    const idA = a.document.id ?? a.document.frontmatter.id ?? a.filename
    const idB = b.document.id ?? b.document.frontmatter.id ?? b.filename
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" })
  })
}

export const sortTasksByRecency = (tasks: readonly BoardTask[]): readonly BoardTask[] => {
  return [...tasks].sort((a, b) => {
    const dateA =
      a.document.last_updated
      || a.document.created_date
      || a.document.frontmatter.last_updated
      || a.document.frontmatter.created_date
      || ""
    const dateB =
      b.document.last_updated
      || b.document.created_date
      || b.document.frontmatter.last_updated
      || b.document.frontmatter.created_date
      || ""
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA)
    }
    const idA = a.document.id ?? a.document.frontmatter.id ?? a.filename
    const idB = b.document.id ?? b.document.frontmatter.id ?? b.filename
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" })
  })
}

export const sortTasksById = (tasks: readonly BoardTask[]): readonly BoardTask[] => {
  return [...tasks].sort((a, b) => {
    const idA = a.document.id ?? a.document.frontmatter.id ?? a.filename
    const idB = b.document.id ?? b.document.frontmatter.id ?? b.filename
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" })
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

  return tasks.filter((task) => {
    const doc = task.document
    const tags = doc.tags ?? doc.frontmatter.tags ?? []

    const matchesTag =
      filter.tag == null
      || filter.tag === ""
      || tags.some((tag) => tag.toLowerCase() === filter.tag?.toLowerCase())

    const ownerVal = (doc.owner ?? doc.frontmatter.owner ?? "").toLowerCase()
    const assignedVal = (doc.assigned_to ?? doc.frontmatter.assigned_to ?? "").toLowerCase()
    const targetOwner = (filter.owner ?? "").toLowerCase()
    const matchesOwner =
      filter.owner == null
      || filter.owner === ""
      || ownerVal === targetOwner
      || assignedVal === targetOwner

    const searchQuery = (filter.search ?? "").toLowerCase()
    const title = (doc.title ?? doc.frontmatter.title ?? "").toLowerCase()
    const id = (doc.id ?? doc.frontmatter.id ?? "").toLowerCase()
    const filename = task.filename.toLowerCase()
    const inBody = doc.rawBody.toLowerCase().includes(searchQuery)
    const matchesSearch =
      filter.search == null
      || filter.search === ""
      || title.includes(searchQuery)
      || id.includes(searchQuery)
      || filename.includes(searchQuery)
      || inBody

    return matchesTag && matchesOwner && matchesSearch
  })
}
