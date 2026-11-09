# Workspace Axioms & Operational Rules

## 1. Runtime Version Management
- **Mise as Source of Truth**: All runtime versions (`bun`, `node`) MUST be managed through `mise` and declared in `mise.toml`.
- Execute commands via `mise exec -- <command>` (or within an active mise environment).

## 2. Package Management & Security
- **No Unpinned Execution**: Never use `npx` or `bunx`. They pull and execute latest unpinned, unaudited packages from the registry.
- **Explicit Pinned Dependencies**: All tools, linters, compilers, and bundlers must be explicitly declared and pinned in `package.json` (`dependencies` or `devDependencies`) with a committed lockfile (`bun.lock`).
- **Approved Execution**: Use `bun run <script>`, `bun run <bin>`, or `./node_modules/.bin/<bin>`.

## 3. Git & Branching Axiom
- **Trunk-Based Development**: The single source of truth is `main`. All work uses short-lived task branches (`task/<id>-<slug>`) originating from `main` and integrating directly back into `main`. Long-lived staging/release branches are forbidden. See [docs/concepts/git-workflow.md](file:///docs/concepts/git-workflow.md).

## 4. Standards & Architecture References
- **UI Iconography Standards**: [.agents/rules/ui-icons.md](file:///.agents/rules/ui-icons.md)
- **Package Management Rule**: [.agents/rules/package-management.md](file:///.agents/rules/package-management.md)
- **TypeScript Standards**: [.agents/rules/typescript.md](file:///.agents/rules/typescript.md)
- **Testing Standards**: [.agents/rules/tests.md](file:///.agents/rules/tests.md)
- **Documentation Standards**: [.agents/rules/document.md](file:///.agents/rules/document.md)
- **File & Directory Naming**: [.agents/rules/file-naming.md](file:///.agents/rules/file-naming.md)
- **Agent Instructions Guide**: [.agents/rules/agent-instructions.md](file:///.agents/rules/agent-instructions.md)
