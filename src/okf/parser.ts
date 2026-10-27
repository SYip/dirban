import { err, ok, type Result } from "neverthrow"
import YAML from "yaml"
import type {
  ChecklistItem,
  ParseError,
  Priority,
  TaskDocument,
  TaskFrontmatter,
  TaskRelationships,
} from "./types.ts"

const FRONTMATTER_DELIMITER = "---"

const parsePriority = (val: unknown): Priority => {
  if (typeof val === "string" && val.trim() !== "") {
    return val.trim()
  }
  return "p2"
}

const parseStringArray = (val: unknown): readonly string[] => {
  if (Array.isArray(val)) {
    return Object.freeze(
      val.filter((x): x is string => typeof x === "string" && x.trim() !== ""),
    )
  }
  return Object.freeze([])
}

const parseRelationships = (val: unknown): TaskRelationships => {
  if (val != null && typeof val === "object") {
    const record = val as Record<string, unknown>
    return Object.freeze({
      depends_on: parseStringArray(record.depends_on),
      blocks: parseStringArray(record.blocks),
      related_to: parseStringArray(record.related_to),
    })
  }
  return Object.freeze({
    depends_on: Object.freeze([]),
    blocks: Object.freeze([]),
    related_to: Object.freeze([]),
  })
}

const parseAcceptanceCriteria = (body: string): readonly ChecklistItem[] => {
  const acMatch = body.match(
    /##\s+2\.\s+Acceptance Criteria[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/i,
  )
  if (acMatch == null || acMatch[1] == null) {
    return Object.freeze([])
  }

  const sectionLines = acMatch[1].split("\n")
  const items: ChecklistItem[] = []
  let itemIndex = 1

  for (const line of sectionLines) {
    const match = line.match(/^(\s*-\s*\[([ xX])\]\s*)(.+)$/)
    if (match != null && match[2] != null && match[3] != null) {
      const isChecked = match[2].toLowerCase() === "x"
      const text = match[3].trim()
      items.push(Object.freeze({
        index: itemIndex,
        text,
        checked: isChecked,
        rawLine: line,
      }))
      itemIndex += 1
    }
  }

  return Object.freeze(items)
}

const parseJournal = (body: string): readonly string[] => {
  const journalMatch = body.match(
    /##\s+4\.\s+Execution Journal[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/i,
  )
  if (journalMatch == null || journalMatch[1] == null) {
    return Object.freeze([])
  }

  const lines = journalMatch[1].split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-") || l.startsWith("*"))

  return Object.freeze(lines)
}

const extractSection = (body: string, sectionHeadingRegex: RegExp): string => {
  const match = body.match(sectionHeadingRegex)
  if (match == null || match[1] == null) {
    return ""
  }
  return match[1].trim()
}

export const parseTaskDocument = (
  rawContent: string,
): Result<TaskDocument, ParseError> => {
  if (rawContent.trim() === "") {
    return err({
      kind: "EMPTY_CONTENT",
      message: "Task file is empty",
    })
  }

  const lines = rawContent.split("\n")
  if (lines.length === 0 || lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    return err({
      kind: "MISSING_FRONTMATTER",
      message: "Document does not start with YAML frontmatter delimiter (---)",
    })
  }

  const secondDelimiterIndex = lines.slice(1).findIndex((line) =>
    line.trim() === FRONTMATTER_DELIMITER
  )
  if (secondDelimiterIndex === -1) {
    return err({
      kind: "MISSING_FRONTMATTER",
      message: "Unclosed YAML frontmatter: missing closing delimiter (---)",
    })
  }

  const frontmatterRaw = lines.slice(1, secondDelimiterIndex + 1).join("\n")
  const rawBody = lines.slice(secondDelimiterIndex + 2).join("\n")

  let parsedYaml: unknown
  try {
    parsedYaml = YAML.parse(frontmatterRaw)
  } catch (yamlErr) {
    return err({
      kind: "INVALID_YAML",
      message: yamlErr instanceof Error
        ? yamlErr.message
        : "YAML parsing failure",
    })
  }

  if (parsedYaml == null || typeof parsedYaml !== "object") {
    return err({
      kind: "INVALID_SCHEMA",
      message: "YAML frontmatter is not a key-value object",
    })
  }

  const record = parsedYaml as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id.trim() : ""
  if (id === "") {
    return err({
      kind: "INVALID_SCHEMA",
      field: "id",
      message: "Frontmatter missing required 'id' field",
    })
  }

  const title = typeof record.title === "string" ? record.title.trim() : ""
  const okf_version = typeof record.okf_version === "string"
    ? record.okf_version
    : "1.0"
  const status = typeof record.status === "string"
    ? record.status.trim()
    : "backlog"
  const priority = parsePriority(record.priority)
  const owner = typeof record.owner === "string" ? record.owner : "developer"
  const assigned_to = typeof record.assigned_to === "string"
    ? record.assigned_to
    : "unassigned"
  const created_date = typeof record.created_date === "string"
    ? record.created_date
    : ""
  const last_updated = typeof record.last_updated === "string"
    ? record.last_updated
    : ""
  const tags = parseStringArray(record.tags)
  const relationships = parseRelationships(record.relationships)

  const frontmatter: TaskFrontmatter = Object.freeze({
    okf_version,
    id,
    title,
    type: "task",
    status,
    priority,
    owner,
    assigned_to,
    created_date,
    last_updated,
    tags,
    relationships,
  })

  const titleHeader = extractSection(rawBody, /^#\s+(?:Task:\s*)?([^\n]+)/m)
  const objectiveScope = extractSection(
    rawBody,
    /##\s+1\.\s+Objective & Scope[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/i,
  )
  const acceptanceCriteria = parseAcceptanceCriteria(rawBody)
  const verificationPlan = extractSection(
    rawBody,
    /##\s+3\.\s+Verification Plan[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/i,
  )
  const executionJournal = parseJournal(rawBody)

  return ok(Object.freeze({
    frontmatter,
    titleHeader: titleHeader !== "" ? titleHeader : title,
    objectiveScope,
    acceptanceCriteria,
    verificationPlan,
    executionJournal,
    otherSections: Object.freeze([]),
    rawBody,
  }))
}
