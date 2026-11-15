---
id: "26-029"
title: "Experiment with Native Sidebar Webview Task Detail View for Active Task"
type: "task"
status: "backlog"
priority: "p3"
owner: "developer"
assigned_to: "unassigned"
created_date: "2026-11-10"
last_updated: "2026-11-10"
tags:
  - vscode
  - extension
  - ui
  - webview
  - experiment
relationships:
  depends_on:
    - "26-009"
  blocks: []
  related_to:
    - "26-008"
---

# Experiment with Native Sidebar Webview Task Detail View for Active Task

Explore replacing or augmenting the compact TreeView in `dirban.focusView` with a rich, embedded `WebviewView` (`WebviewViewProvider`) that renders the full task markdown document with styled typography directly in the sidebar pane.

## Objective & Scope

Assess the user experience and ergonomic tradeoffs of reading and interacting with active tasks entirely inside the sidebar versus the side-by-side Markdown preview tab.

### Key Considerations to Evaluate

1. **Readability in Narrow Panes**:
   - Test responsive layout and typography when the sidebar width is adjusted between 250px and 450px.
   - Evaluate whether headings, tables, blockquotes, and long paragraphs feel readable or cramped.

2. **In-place Checklist & Criteria Interaction**:
   - Render interactive checkboxes inside the rendered document view that write back to disk using `checkTaskItem`.
   - Provide visual feedback for completion percentages directly in the webview.

3. **Performance & Memory Footprint**:
   - Compare the memory and responsiveness of maintaining an active webview instance in the sidebar against a lightweight native TreeView.

4. **User Preference / Toggle Option**:
   - Consider a user setting (e.g. `dirban.focusViewMode: "list" | "detail"`) allowing developers to choose between the compact control-center list view and the full document webview.

## Acceptance Criteria

- [ ] Prototype a `DirbanFocusWebviewViewProvider` implementing `vscode.WebviewViewProvider` registered for `dirban.focusView`.
- [ ] Render the active task's OKF markdown content with theme-aware styling matching VS Code's native design tokens.
- [ ] Support interactive acceptance criteria toggling directly within the rendered webview with disk sync.
- [ ] Measure sidebar ergonomics and layout performance across different sidebar widths.
- [ ] Provide configuration toggle (`dirban.focusViewMode`) to switch between compact TreeView and rich WebviewView.
