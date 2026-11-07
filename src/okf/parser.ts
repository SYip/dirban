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
export const LINE_SPLIT_REGEX = /\r?\n/

const ACCEPTANCE_CRITERIA_SECTION_REGEX =
  /##\s+(?:\d+\.\s+)?Acceptance Criteria[^\r\n]*\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i

const CHECKBOX_LINE_REGEX = /^(\s*-\s*\[([ xX])\]\s*)(.+?)\r?$/

const EXECUTION_JOURNAL_SECTION_REGEX =
  /##\s+(?:\d+\.\s+)?Execution Journal[^\r\n]*\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i

const OBJECTIVE_SCOPE_SECTION_REGEX =
  /##\s+(?:\d+\.\s+)?Objective & Scope[^\r\n]*\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i

const VERIFICATION_PLAN_SECTION_REGEX =
  /##\s+(?:\d+\.\s+)?Verification Plan[^\r\n]*\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i

const TITLE_HEADING_REGEX = /^#\s+(?:Task:\s*)?([^\r\n]+)/m
const MD_EXTENSION_REGEX = /\.md$/i

const parsePriority = (val: unknown): Priority => {
  if (typeof val === "string" && val.trim() !== "") {
    return val.trim()
  }
  return "p3"
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

const parseAllChecklistItems = (body: string): readonly ChecklistItem[] => {
  // First check if there's a specific Acceptance Criteria section
  const acMatch = body.match(ACCEPTANCE_CRITERIA_SECTION_REGEX)
  const targetText = acMatch?.[1] != null ? acMatch[1] : body

  const sectionLines = targetText.split(LINE_SPLIT_REGEX)
  const items: ChecklistItem[] = []
  let itemIndex = 1

  for (const line of sectionLines) {
    const match = line.match(CHECKBOX_LINE_REGEX)
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
  const journalMatch = body.match(EXECUTION_JOURNAL_SECTION_REGEX)
  if (journalMatch == null || journalMatch[1] == null) {
    return Object.freeze([])
  }

  const lines = journalMatch[1].split(LINE_SPLIT_REGEX)
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

const deriveIdFromFilename = (filename?: string): string => {
  if (filename == null || filename.trim() === "") {
    return "task"
  }
  const clean = filename.replace(MD_EXTENSION_REGEX, "").trim()
  return clean !== "" ? clean : "task"
}

export const parseTaskDocument = (
  rawContent: string,
  filename?: string,
): Result<TaskDocument, ParseError> => {
  if (rawContent.trim() === "") {
    return err({
      kind: "EMPTY_CONTENT",
      message: "Task file is empty",
    })
  }

  const lines = rawContent.split(LINE_SPLIT_REGEX)
  const hasFrontmatter = lines.length > 0 && lines[0]?.trim() === FRONTMATTER_DELIMITER

  let parsedYaml: Record<string, unknown> | null = null
  let rawBody = rawContent

  if (hasFrontmatter) {
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
    rawBody = lines.slice(secondDelimiterIndex + 2).join("\n")

    try {
      const parsed = YAML.parse(frontmatterRaw)
      if (parsed != null && typeof parsed === "object") {
        parsedYaml = parsed as Record<string, unknown>
      }
    } catch (yamlErr) {
      return err({
        kind: "INVALID_YAML",
        message: yamlErr instanceof Error
          ? yamlErr.message
          : "YAML parsing failure",
      })
    }
  }

  const record = parsedYaml ?? {}

  // ID resolution: frontmatter ID > filename fallback > generic "task"
  const rawId = typeof record.id === "string" ? record.id.trim() : ""
  const id = rawId !== "" ? rawId : deriveIdFromFilename(filename)

  // Title extraction: frontmatter title > first `# ` heading > filename fallback
  const titleHeader = extractSection(rawBody, TITLE_HEADING_REGEX)
  const rawTitle = typeof record.title === "string" ? record.title.trim() : ""
  const title = rawTitle !== ""
    ? rawTitle
    : (titleHeader !== "" ? titleHeader : id)

  const okf_version = typeof record.okf_version === "string"
    ? record.okf_version
    : "1.0"
  const status = typeof record.status === "string"
    ? record.status.trim()
    : "backlog"
  const priority = parsePriority(record.priority)
  const owner = typeof record.owner === "string" ? record.owner : undefined
  const assigned_to = typeof record.assigned_to === "string"
    ? record.assigned_to
    : undefined
  const created_date = typeof record.created_date === "string"
    ? record.created_date
    : undefined
  const last_updated = typeof record.last_updated === "string"
    ? record.last_updated
    : undefined
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

  const objectiveScope = extractSection(rawBody, OBJECTIVE_SCOPE_SECTION_REGEX)
  const acceptanceCriteria = parseAllChecklistItems(rawBody)
  const verificationPlan = extractSection(rawBody, VERIFICATION_PLAN_SECTION_REGEX)
  const executionJournal = parseJournal(rawBody)

  return ok(Object.freeze({
    id,
    title,
    priority,
    tags,
    owner,
    assigned_to,
    created_date,
    last_updated,
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
