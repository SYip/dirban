---
trigger: model_decision
description: "UI iconography & Codicons standards for extension UI components, webview templates, VS Code TreeViews, status bar items, and notification messages."
---

# UI Iconography & Codicons Standards

## 1. No Emojis in Extension & Webview UI
- **Strict Prohibition**: Never use raw Unicode emojis (e.g. `⚡`, `🚀`, `▶`, `✓`, `📦`, `👁`, `✏`, `↻`, `⚙`) in extension host code, tree views, status bars, notifications, or webview UI templates.
- **Rationale**:
  - Raw emojis have inconsistent metrics across platforms (macOS vs Windows vs Linux).
  - Emoji glyphs break baseline alignment, introduce unpredictable font height blowouts, and ignore VS Code theme colors.

## 2. Mandatory Use of Codicons
- **VS Code Extension Host & TreeView**:
  - Use `vscode.ThemeIcon` with official Codicon IDs (e.g. `new vscode.ThemeIcon("rocket")`, `new vscode.ThemeIcon("play")`, `new vscode.ThemeIcon("check")`).
- **Status Bar Items**:
  - Use standard Codicon syntax: `$(rocket)`, `$(play)`, `$(check)`, `$(checklist)`, `$(gear)`.
- **Webview UI (Vue 3 SFCs)**:
  - Use official Codicon classes from `@vscode/codicons`:
    ```html
    <span class="codicon codicon-rocket"></span>
    <span class="codicon codicon-play"></span>
    <span class="codicon codicon-check"></span>
    <span class="codicon codicon-archive"></span>
    <span class="codicon codicon-settings-gear"></span>
    ```

## 3. Styling & Alignment
- Always apply standard Codicon sizing (`font-size: 1rem` or `1.15rem`) and flexbox center alignment:
  ```css
  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
  }
  ```
