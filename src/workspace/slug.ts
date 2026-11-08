import type { BoardTask } from "../board/types.ts"

const SLUG_CLEANUP_REGEX = /[^a-z0-9]+/g
const SLUG_TRIM_HYPHENS_REGEX = /^-+|-+$/g
const MD_EXTENSION_REGEX = /\.md$/

export const extractSlugFromTask = (task: BoardTask): string => {
  const stem = task.filename.replace(MD_EXTENSION_REGEX, "")
  const id = task.document.id ?? task.document.frontmatter.id ?? ""
  if (id !== "" && stem.startsWith(id)) {
    return stem.slice(id.length).replace(SLUG_TRIM_HYPHENS_REGEX, "")
  }
  const title = task.document.title ?? ""
  if (title !== "") {
    return title
      .toLowerCase()
      .replace(SLUG_CLEANUP_REGEX, "-")
      .replace(SLUG_TRIM_HYPHENS_REGEX, "")
  }
  return stem
}

export const getEffectiveTaskId = (task: BoardTask): string => {
  return task.document.id ?? task.document.frontmatter.id ?? task.filename
}
