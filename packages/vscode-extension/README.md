# Dirban VS Code Extension

Official Visual Studio Code extension for **Dirban** — the zero-database, agent-native Kanban engine backed by the file system and Google Open Knowledge Format (OKF).

## Features

- **Integrated Kanban Board**: Live visual representation of directory-as-state task workflows.
- **Progressive Enhancement**: Direct integration with your workspace's `docs/tasks` directory and `.vscode/settings.json`.
- **Zero Database**: State is driven entirely by plain Markdown files with YAML frontmatter.

## Development & Build Pipeline

The extension uses a dual bundler architecture:
- **Extension Host**: Built with `esbuild` targeting Node.js CommonJS format.
- **Webview UI**: Built with `Vite` + `Vue 3` outputting single-page webview assets to `dist/webview/`.

### Commands

From `packages/vscode-extension`:

```bash
# Install dependencies
bun install

# Run full build (extension host + webview)
bun run build

# Run build in watch mode
bun run watch

# Typecheck extension and webview code
bun run typecheck

# Package VSIX extension package
bun run package
```

### Debugging with F5

1. Open the repository root in VS Code.
2. Select the debug target **Run Dirban Extension** from the Run & Debug view (`Ctrl+Shift+D` / `Cmd+Shift+D`).
3. Press `F5`. A new Extension Development Host window will launch with the extension activated.
