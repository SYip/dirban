import YAML from "yaml"
import type { TaskDocument, TaskFrontmatter } from "./types.ts"

export const serializeFrontmatter = (fm: TaskFrontmatter): string => {
  const yamlObj: Record<string, unknown> = {
    okf_version: fm.okf_version,
    id: fm.id,
    title: fm.title,
    type: "task",
    status: fm.status,
    priority: fm.priority,
    owner: fm.owner,
    assigned_to: fm.assigned_to,
    created_date: fm.created_date,
    last_updated: fm.last_updated,
    tags: [...fm.tags],
    relationships: {
      depends_on: [...fm.relationships.depends_on],
      blocks: [...fm.relationships.blocks],
      related_to: [...fm.relationships.related_to],
    },
  }

  const yamlStr = YAML.stringify(yamlObj).trim()
  return `---\n${yamlStr}\n---`
}

export const serializeTaskDocument = (doc: TaskDocument): string => {
  const frontmatterStr = serializeFrontmatter(doc.frontmatter)

  const body = doc.rawBody.trim()
  if (body !== "") {
    return `${frontmatterStr}\n\n${body}\n`
  }

  const lines: string[] = []
  lines.push(`# Task: ${doc.frontmatter.title}`)
  lines.push("")
  lines.push("## 1. Objective & Scope")
  lines.push(doc.objectiveScope !== "" ? doc.objectiveScope : "")
  lines.push("")
  lines.push("## 2. Acceptance Criteria")
  if (doc.acceptanceCriteria.length > 0) {
    for (const ac of doc.acceptanceCriteria) {
      lines.push(`- [${ac.checked ? "x" : " "}] ${ac.text}`)
    }
  } else {
    lines.push("- [ ] Initial task definition")
  }
  lines.push("")
  lines.push("## 3. Verification Plan")
  if (doc.verificationPlan !== "") {
    lines.push(doc.verificationPlan)
  } else {
    lines.push("```bash\nbun test\n```")
  }
  lines.push("")
  lines.push("## 4. Execution Journal")
  if (doc.executionJournal.length > 0) {
    for (const entry of doc.executionJournal) {
      lines.push(entry)
    }
  } else {
    lines.push(`- **${doc.frontmatter.created_date}**: Task initialized.`)
  }

  return `${frontmatterStr}\n\n${lines.join("\n")}\n`
}
