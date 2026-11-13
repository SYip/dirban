# Extension Development Guide

Instructions for contributors developing and debugging the `dirban-vscode` extension.

---

## Architecture & Build Pipeline

The extension uses a dual bundler architecture:

- **Extension Host**: Built with `esbuild` (`build.extension.ts`) targeting Node.js CommonJS format.
- **Webview UI**: Built with `Vite` + `Vue 3` outputting single-page webview assets to `dist/webview/`.

Dependencies between packages are shared natively across the Bun monorepo workspace.

---

## Local Development Commands

All commands run from `packages/vscode-extension`:

```bash
# Install dependencies across monorepo
bun install

# Run full production build (extension host + webview)
bun run build

# Watch mode with live rebuilds (extension host + webview)
bun run watch

# Run TypeScript compiler typechecks
bun run typecheck

# Run unit and integration test suite
bun test

# Package into a standalone .vsix extension file
bun run package
```

---

## Debugging with F5 in VS Code

1. Open the repository root in VS Code.
2. Ensure dependencies are installed and the extension is built:

   ```bash
   cd packages/vscode-extension && bun run build
   ```
3. Open the **Run & Debug** view (`Cmd+Shift+D` / `Ctrl+Shift+D`).
4. Select the debug launch profile: **Run Dirban Extension**.
5. Press `F5`. A new **Extension Development Host** window will open with the extension active and linked to the live debugger.
