import * as path from "node:path"
import * as fs from "node:fs"
import * as process from "node:process"

interface SeedTask {
  readonly id: string
  readonly title: string
  readonly column: string
  readonly priority: "p0" | "p1" | "p2" | "p3"
  readonly owner: string
  readonly assigned_to: string
  readonly tags: readonly string[]
  readonly depends_on: readonly string[]
  readonly blocks: readonly string[]
  readonly scope: string
  readonly criteria: readonly { text: string; checked: boolean }[]
}

const SEED_TASKS: readonly SeedTask[] = [
  // 00-backlog
  {
    id: "task.dirban.cli.26-001",
    title: "Implement fuzzy search for task view command",
    column: "00-backlog",
    priority: "p2",
    owner: "developer",
    assigned_to: "unassigned",
    tags: ["cli", "search", "ux"],
    depends_on: [],
    blocks: [],
    scope: "Allow users to run `dirban view fuzzy-term` without typing exact task ID prefixes.",
    criteria: [
      { text: "Integrate substring and Levenshtein distance matcher", checked: false },
      { text: "Suggest closest match when no exact hit found", checked: false },
      { text: "Add unit tests verifying matching accuracy", checked: false },
    ],
  },
  {
    id: "task.dirban.core.26-002",
    title: "Add Git pre-commit hook to validate OKF schema",
    column: "00-backlog",
    priority: "p1",
    owner: "developer",
    assigned_to: "unassigned",
    tags: ["git", "validation", "okf"],
    depends_on: [],
    blocks: [],
    scope: "Prevent invalid markdown task files from entering the repo via Git commit hook.",
    criteria: [
      { text: "Create pre-commit hook script in .githooks/", checked: false },
      { text: "Verify YAML frontmatter against Google OKF schema", checked: false },
      { text: "Block commit if frontmatter status diverges from parent folder", checked: false },
    ],
  },
  {
    id: "task.dirban.tui.26-003",
    title: "Support custom color themes in interactive TUI",
    column: "00-backlog",
    priority: "p3",
    owner: "developer",
    assigned_to: "unassigned",
    tags: ["tui", "themes", "styling"],
    depends_on: [],
    blocks: [],
    scope: "Allow developers to configure dark, light, or solarized palettes in .dirban.json.",
    criteria: [
      { text: "Add theme field to .dirban.json schema", checked: false },
      { text: "Support Catppuccin, Nord, and Dracula palette presets", checked: false },
      { text: "Respect NO_COLOR standard environment variable", checked: false },
    ],
  },
  {
    id: "task.dirban.core.26-004",
    title: "Support custom column mappings in .dirban.json",
    column: "00-backlog",
    priority: "p2",
    owner: "developer",
    assigned_to: "unassigned",
    tags: ["config", "board"],
    depends_on: [],
    blocks: [],
    scope: "Allow arbitrary directory names to be ordered arbitrarily via config file.",
    criteria: [
      { text: "Map column names to custom display titles in config", checked: false },
      { text: "Verify columns not defined in config are sorted alphabetically", checked: false },
      { text: "Support WIP limits per column", checked: false },
    ],
  },
  {
    id: "task.dirban.analytics.26-005",
    title: "Implement cycle time calculator using Git log follow",
    column: "00-backlog",
    priority: "p1",
    owner: "developer",
    assigned_to: "unassigned",
    tags: ["git", "analytics", "phase-3"],
    depends_on: ["task.dirban.core.26-002"],
    blocks: [],
    scope: "Reconstruct task movement timestamps across physical folders by parsing git history.",
    criteria: [
      { text: "Run git log --follow --format on task markdown files", checked: false },
      { text: "Compute Lead Time and Cycle Time in days/hours", checked: false },
      { text: "Add CLI command `dirban stats`", checked: false },
    ],
  },
  {
    id: "task.dirban.vscode.26-006",
    title: "Design VS Code tree view extension architecture",
    column: "00-backlog",
    priority: "p3",
    owner: "developer",
    assigned_to: "unassigned",
    tags: ["vscode", "extension", "phase-2"],
    depends_on: [],
    blocks: [],
    scope: "Architect shared Deno/TypeScript core engine bindings for VS Code extension activity bar.",
    criteria: [
      { text: "Create packages/vscode-dirban skeleton", checked: false },
      { text: "Define TreeDataProvider mapping physical folders to tree nodes", checked: false },
      { text: "Benchmark file system watcher event handling", checked: false },
    ],
  },

  // 01-ready
  {
    id: "task.dirban.cli.26-007",
    title: "Add interactive tag filter selector in TUI",
    column: "01-ready",
    priority: "p1",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["tui", "filter", "ux"],
    depends_on: [],
    blocks: [],
    scope: "Enable pressing `t` in TUI to filter visible cards by chosen tag.",
    criteria: [
      { text: "Gather all unique tags across all discovered tasks", checked: true },
      { text: "Show tag selection modal in TUI on pressing 't'", checked: false },
      { text: "Filter columns in real-time based on selected tag", checked: false },
    ],
  },
  {
    id: "task.dirban.core.26-008",
    title: "Implement WIP (Work In Progress) limit warnings",
    column: "01-ready",
    priority: "p0",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["core", "kanban", "wip"],
    depends_on: [],
    blocks: [],
    scope: "Warn developer or AI agent when moving a card into a column that exceeds its configured WIP limit.",
    criteria: [
      { text: "Define wipLimits record in DirbanConfig", checked: true },
      { text: "Emit warning message when column task count > limit", checked: false },
      { text: "Highlight column header in red when WIP limit breached", checked: false },
    ],
  },
  {
    id: "task.dirban.cli.26-009",
    title: "Add shell autocomplete generation for bash and zsh",
    column: "01-ready",
    priority: "p2",
    owner: "developer",
    assigned_to: "unassigned",
    tags: ["cli", "autocomplete"],
    depends_on: [],
    blocks: [],
    scope: "Generate completion scripts for dirban subcommands, task IDs, and column names.",
    criteria: [
      { text: "Implement `dirban completions [bash|zsh|fish]`", checked: false },
      { text: "Autocomplete dynamic task IDs based on current workspace files", checked: false },
      { text: "Document installation in README", checked: false },
    ],
  },
  {
    id: "task.dirban.core.26-010",
    title: "Atomic task creation command (dirban new)",
    column: "01-ready",
    priority: "p1",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["core", "cli"],
    depends_on: [],
    blocks: [],
    scope: "Provide a CLI command to bootstrap a compliant OKF card with sequential ID generation.",
    criteria: [
      { text: "Auto-detect highest sequence number in year [YY]-[3-digit]", checked: false },
      { text: "Generate compliant OKF markdown with pre-filled frontmatter", checked: false },
      { text: "Place new task file in 00-backlog/ by default", checked: false },
    ],
  },
  {
    id: "task.dirban.docs.26-011",
    title: "Document Google OKF schema guidelines in README",
    column: "01-ready",
    priority: "p2",
    owner: "developer",
    assigned_to: "unassigned",
    tags: ["docs", "okf"],
    depends_on: [],
    blocks: [],
    scope: "Write clear documentation explaining how AI agents and human devs interact with task files.",
    criteria: [
      { text: "Explain frontmatter properties and allowed priority enums", checked: false },
      { text: "Provide copy-pasteable minimal and standard examples", checked: false },
      { text: "Document filesystem conventions and git safety guidelines", checked: false },
    ],
  },

  // 02-in-progress
  {
    id: "task.dirban.tui.26-012",
    title: "Side-by-side horizontal Kanban column layout",
    column: "02-in-progress",
    priority: "p0",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["tui", "layout", "kanban"],
    depends_on: [],
    blocks: [],
    scope: "Render columns horizontally across the terminal with dynamic console size detection.",
    criteria: [
      { text: "Query Deno.consoleSize() for terminal dimensions", checked: true },
      { text: "Calculate dynamic column widths with padding", checked: true },
      { text: "Format cards into column text buffers and zip horizontally", checked: true },
      { text: "Bottom preview panel showing untruncated card metadata", checked: true },
    ],
  },
  {
    id: "task.dirban.core.26-013",
    title: "Strict bidirectional relationship validation",
    column: "02-in-progress",
    priority: "p1",
    owner: "agent",
    assigned_to: "developer",
    tags: ["graph", "relationships", "core"],
    depends_on: [],
    blocks: ["task.dirban.cli.26-001"],
    scope: "Validate that tasks referencing depends_on or blocks link to existing tasks on the board.",
    criteria: [
      { text: "Build in-memory graph index of all task IDs", checked: true },
      { text: "Detect dangling references in depends_on and blocks", checked: false },
      { text: "Detect circular dependency loops (A -> B -> A)", checked: false },
    ],
  },
  {
    id: "task.dirban.ops.26-014",
    title: "Interactive acceptance criteria toggling in TUI",
    column: "02-in-progress",
    priority: "p1",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["tui", "checklist"],
    depends_on: ["task.dirban.tui.26-012"],
    blocks: [],
    scope: "Pressing Space toggles checklist items without leaving the terminal UI.",
    criteria: [
      { text: "Handle space keystroke in raw terminal mode", checked: true },
      { text: "Update markdown file with new checkbox state", checked: true },
      { text: "Immediately re-render card progress badge", checked: true },
    ],
  },
  {
    id: "task.dirban.cli.26-015",
    title: "Multi-dimensional card sorter with recency and priority",
    column: "02-in-progress",
    priority: "p0",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["core", "sorting"],
    depends_on: [],
    blocks: [],
    scope: "Sort cards deterministically within columns by priority (P0-P3) and last_updated.",
    criteria: [
      { text: "Order P0 > P1 > P2 > P3", checked: true },
      { text: "Break ties with last_updated ISO string descending", checked: true },
      { text: "Cover with 3+ unit test vectors in sorter.test.ts", checked: true },
    ],
  },

  // 03-done
  {
    id: "task.dirban.core.26-016",
    title: "Initialize Dirban project structure and Deno setup",
    column: "03-done",
    priority: "p0",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["setup", "deno"],
    depends_on: [],
    blocks: [],
    scope: "Initialize repository with deno.json, TypeScript rules, and test framework.",
    criteria: [
      { text: "Configure strict TypeScript and Deno linting rules", checked: true },
      { text: "Set up Deno standard libraries and neverthrow", checked: true },
      { text: "Verify deno test execution pipeline", checked: true },
    ],
  },
  {
    id: "task.dirban.okf.26-017",
    title: "Google OKF Task Schema parser and serializer",
    column: "03-done",
    priority: "p0",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["okf", "yaml", "core"],
    depends_on: [],
    blocks: [],
    scope: "Build robust markdown parser and serializer for Google Open Knowledge Format tasks.",
    criteria: [
      { text: "Parse frontmatter using @std/yaml", checked: true },
      { text: "Extract acceptance criteria and execution journal sections", checked: true },
      { text: "Deterministic serialization preserving markdown formatting", checked: true },
      { text: "Unit tests covering valid, minimal, and malformed vectors", checked: true },
    ],
  },
  {
    id: "task.dirban.ops.26-018",
    title: "Atomic card movement engine with execution journal logging",
    column: "03-done",
    priority: "p0",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["ops", "fs", "core"],
    depends_on: [],
    blocks: [],
    scope: "Atomically move physical task files across column directories with audit trails.",
    criteria: [
      { text: "Move file with Deno.writeTextFileSync and Deno.removeSync", checked: true },
      { text: "Sync frontmatter status to target column name", checked: true },
      { text: "Append entry to ## 4. Execution Journal with current date", checked: true },
    ],
  },
  {
    id: "task.dirban.cli.26-019",
    title: "CLI dispatcher for board, move, view, set, check, archive",
    column: "03-done",
    priority: "p0",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["cli", "args"],
    depends_on: [],
    blocks: [],
    scope: "Implement command-line subcommands using @std/cli parse-args.",
    criteria: [
      { text: "Support dirban board, view, move, check, set, archive", checked: true },
      { text: "Implement colored help screen and usage examples", checked: true },
      { text: "Support non-interactive --static flag for CI/pipe", checked: true },
    ],
  },
  {
    id: "task.dirban.core.26-020",
    title: "Filesystem column scanner and self-healing engine",
    column: "03-done",
    priority: "p0",
    owner: "developer",
    assigned_to: "andrew",
    tags: ["board", "discovery", "fs"],
    depends_on: [],
    blocks: [],
    scope: "Discover columns from physical directory structure and heal desynchronized frontmatter.",
    criteria: [
      { text: "Scan configured column directories recursively", checked: true },
      { text: "Self-heal frontmatter status when dragged via file explorer", checked: true },
      { text: "Append unlisted directories gracefully in alphabetical order", checked: true },
    ],
  },
]

const renderTaskMarkdown = (task: SeedTask): string => {
  const lines: string[] = []
  lines.push("---")
  lines.push('okf_version: "1.0"')
  lines.push(`id: "${task.id}"`)
  lines.push(`title: "${task.title}"`)
  lines.push('type: "task"')
  lines.push(`status: "${task.column}"`)
  lines.push(`priority: "${task.priority}"`)
  lines.push(`owner: "${task.owner}"`)
  lines.push(`assigned_to: "${task.assigned_to}"`)
  lines.push('created_date: "2026-10-10"')
  lines.push('last_updated: "2026-10-11"')
  lines.push("tags:")
  for (const tag of task.tags) {
    lines.push(`  - ${tag}`)
  }
  lines.push("relationships:")
  lines.push("  depends_on:")
  if (task.depends_on.length > 0) {
    for (const d of task.depends_on) {
      lines.push(`    - "${d}"`)
    }
  } else {
    lines.push("    []")
  }
  lines.push("  blocks:")
  if (task.blocks.length > 0) {
    for (const b of task.blocks) {
      lines.push(`    - "${b}"`)
    }
  } else {
    lines.push("    []")
  }
  lines.push("  related_to: []")
  lines.push("---")
  lines.push("")
  lines.push(`# Task: ${task.title}`)
  lines.push("")
  lines.push("## 1. Objective & Scope")
  lines.push(task.scope)
  lines.push("")
  lines.push("## 2. Acceptance Criteria")
  for (const c of task.criteria) {
    lines.push(`- [${c.checked ? "x" : " "}] ${c.text}`)
  }
  lines.push("")
  lines.push("## 3. Verification Plan")
  lines.push("```bash")
  lines.push("bun test")
  lines.push("```")
  lines.push("")
  lines.push("## 4. Execution Journal")
  lines.push(`- **2026-10-10**: Task initialized for column \`${task.column}\`.`)
  if (task.column === "03-done") {
    lines.push(`- **2026-10-11**: Verified and completed.`)
  }

  return lines.join("\n") + "\n"
}

const baseTasksDir = path.join(process.cwd(), "docs/tasks")

for (const task of SEED_TASKS) {
  const colDir = path.join(baseTasksDir, task.column)
  fs.mkdirSync(colDir, { recursive: true })

  // Clean filename: e.g. 26-001-implement-fuzzy-search.md
  const shortId = task.id.replace(/^task\.[^.]+\.[^.]+\./, "")
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40)

  const filename = `${shortId}-${slug}.md`
  const filePath = path.join(colDir, filename)
  fs.writeFileSync(filePath, renderTaskMarkdown(task), "utf-8")
}

console.log(`Successfully generated ${SEED_TASKS.length} OKF test tasks across columns!`)
