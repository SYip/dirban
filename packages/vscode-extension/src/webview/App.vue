<template>
  <div class="dirban-app">
    <!-- Top Bar -->
    <header class="topbar">
      <div class="brand">
        <span class="logo">⚡</span>
        <h1>Dirban Kanban</h1>
        <span class="badge">Monorepo Ready</span>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" @click="requestRefresh" title="Refresh Board">
          ↻ Refresh
        </button>
        <button class="btn btn-primary" @click="promptNewTask" title="Create New Task">
          + New Task
        </button>
      </div>
    </header>

    <!-- Main Kanban Lanes -->
    <main class="board-viewport">
      <div v-if="boardState.columns.length === 0" class="empty-board">
        <p>No columns discovered in workspace. Run <code>dirban init</code> or check tasks directory.</p>
      </div>

      <div v-else class="columns-container">
        <section
          v-for="col in boardState.columns"
          :key="col.name"
          class="column-lane"
          :class="getColumnClass(col.name)"
        >
          <header class="lane-header">
            <div class="lane-title-group">
              <h2 class="lane-name">{{ formatColumnTitle(col.name) }}</h2>
              <span class="lane-counter">{{ col.tasks.length }}</span>
            </div>
          </header>

          <!-- Draggable Task List -->
          <draggable
            :list="col.tasks"
            group="tasks"
            item-key="filename"
            class="task-list"
            ghost-class="ghost-card"
            drag-class="dragging-card"
            @change="(event: any) => handleDragChange(event, col.name)"
          >
            <template #item="{ element: task }">
              <article
                class="task-card"
                :class="{ selected: selectedTask?.filePath === task.filePath }"
                @click="selectTask(task)"
                @dblclick="openTaskFile(task.filePath)"
              >
                <div class="card-topline">
                  <span class="task-id">{{ task.document?.id || task.filename }}</span>
                  <span class="priority-chip" :class="`priority-${task.document?.priority || 'p2'}`">
                    {{ task.document?.priority || 'p2' }}
                  </span>
                </div>

                <h3 class="task-title">{{ task.document?.title || task.filename }}</h3>

                <!-- Acceptance Criteria Progress -->
                <div
                  v-if="task.document?.acceptanceCriteria?.length"
                  class="progress-section"
                >
                  <div class="progress-bar-bg">
                    <div
                      class="progress-bar-fill"
                      :style="{ width: `${getCriteriaPercent(task)}%` }"
                    ></div>
                  </div>
                  <span class="progress-label">
                    {{ getCheckedCriteriaCount(task) }}/{{ task.document.acceptanceCriteria.length }}
                  </span>
                </div>
              </article>
            </template>
          </draggable>
        </section>
      </div>
    </main>

    <!-- Task Detail Drawer (Slide-over) -->
    <aside v-if="selectedTask" class="task-drawer">
      <header class="drawer-header">
        <div class="drawer-title-group">
          <span class="task-id-large">{{ selectedTask.document?.id || selectedTask.filename }}</span>
          <span class="priority-chip" :class="`priority-${selectedTask.document?.priority || 'p2'}`">
            {{ selectedTask.document?.priority || 'p2' }}
          </span>
        </div>
        <div class="drawer-actions">
          <button class="btn btn-secondary" @click="openTaskFile(selectedTask.filePath)" title="Open in VS Code Editor">
            Open File ↗
          </button>
          <button class="btn-close" @click="selectedTask = null">✕</button>
        </div>
      </header>

      <div class="drawer-content">
        <h2 class="drawer-task-title">{{ selectedTask.document?.title }}</h2>

        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Column</span>
            <span class="meta-value">{{ selectedTask.column }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Owner</span>
            <span class="meta-value">{{ selectedTask.document?.frontmatter?.owner || 'developer' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Status</span>
            <span class="meta-value">{{ selectedTask.document?.frontmatter?.status || selectedTask.column }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Updated</span>
            <span class="meta-value">{{ selectedTask.document?.frontmatter?.last_updated || '-' }}</span>
          </div>
        </div>

        <!-- Interactive Acceptance Criteria -->
        <section class="drawer-section">
          <h3>Acceptance Criteria</h3>
          <ul v-if="selectedTask.document?.acceptanceCriteria?.length" class="criteria-list">
            <li
              v-for="criterion in selectedTask.document.acceptanceCriteria"
              :key="criterion.index"
              class="criterion-item"
            >
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="criterion.checked"
                  @change="toggleCriterion(selectedTask, criterion.index, !criterion.checked)"
                />
                <span :class="{ 'text-checked': criterion.checked }">{{ criterion.text }}</span>
              </label>
            </li>
          </ul>
          <p v-else class="text-muted">No acceptance criteria defined for this task.</p>
        </section>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import draggable from "vuedraggable"
import type { BoardTask } from "@dirban/core/board/types.ts"
import type {
  WebviewBoardState,
  WebviewMessageToExtension,
  ExtensionMessageToWebview,
} from "./types.ts"

declare function acquireVsCodeApi(): {
  postMessage: (message: WebviewMessageToExtension) => void
  getState: () => unknown
  setState: (state: unknown) => void
}

const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : {
  postMessage: (msg: any) => console.log("VS Code Message:", msg),
  getState: () => null,
  setState: () => {},
}

const boardState = reactive<WebviewBoardState>({
  workspaceRoot: "",
  columns: [],
})

const selectedTask = ref<BoardTask | null>(null)

onMounted(() => {
  window.addEventListener("message", (event) => {
    const message = event.data as ExtensionMessageToWebview
    if (message.type === "boardState") {
      boardState.workspaceRoot = message.state.workspaceRoot
      boardState.columns = message.state.columns as any
      // Sync selected task with latest instance
      if (selectedTask.value) {
        for (const col of boardState.columns) {
          const match = col.tasks.find((t) => t.filePath === selectedTask.value?.filePath)
          if (match) {
            selectedTask.value = match
            break
          }
        }
      }
    }
  })

  // Request initial board state
  vscode.postMessage({ type: "requestBoardState" })
})

function requestRefresh() {
  vscode.postMessage({ type: "requestBoardState" })
}

function promptNewTask() {
  const title = prompt("Enter new task title:")
  if (title && title.trim()) {
    vscode.postMessage({
      type: "createTask",
      title: title.trim(),
      column: "backlog",
    })
  }
}

function selectTask(task: BoardTask) {
  selectedTask.value = task
}

function openTaskFile(filePath: string) {
  vscode.postMessage({
    type: "openFile",
    filePath,
  })
}

function toggleCriterion(task: BoardTask, itemIndex: number, newChecked: boolean) {
  vscode.postMessage({
    type: "toggleCriterion",
    taskId: task.document?.id || task.filename,
    itemIndex,
    checked: newChecked,
  })
}

function handleDragChange(event: any, targetColumnName: string) {
  if (event.added) {
    const task = event.added.element as BoardTask
    vscode.postMessage({
      type: "moveTask",
      taskId: task.document?.id || task.filename,
      targetColumn: targetColumnName,
    })
  }
}

function formatColumnTitle(name: string): string {
  if (name === "backlog") return "Backlog"
  if (name === "archive") return "Archive"
  return name.replace(/^\d+-/, "").replace(/-/g, " ").toUpperCase()
}

function getColumnClass(name: string): string {
  if (name === "backlog") return "lane-backlog"
  if (name.includes("doing")) return "lane-doing"
  if (name.includes("done")) return "lane-done"
  if (name === "archive") return "lane-archive"
  return "lane-standard"
}

function getCheckedCriteriaCount(task: BoardTask): number {
  return task.document?.acceptanceCriteria?.filter((c) => c.checked).length || 0
}

function getCriteriaPercent(task: BoardTask): number {
  const total = task.document?.acceptanceCriteria?.length || 0
  if (total === 0) return 0
  const checked = getCheckedCriteriaCount(task)
  return Math.round((checked / total) * 100)
}
</script>

<style scoped>
.dirban-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-widget-border, #333);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand h1 {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.3px;
}

.logo {
  font-size: 1.3rem;
}

.badge {
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 12px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  font-weight: 500;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  border: none;
  border-radius: 4px;
  padding: 5px 12px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.15s ease;
}

.btn:hover {
  opacity: 0.9;
}

.btn-primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.btn-secondary {
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #ffffff);
}

.board-viewport {
  flex: 1;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 16px;
}

.columns-container {
  display: flex;
  gap: 16px;
  height: 100%;
  align-items: flex-start;
}

.column-lane {
  width: 290px;
  min-width: 290px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--vscode-sideBar-background, #1e1e1e);
  border: 1px solid var(--vscode-widget-border, #333);
  border-radius: 6px;
  overflow: hidden;
}

.lane-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--vscode-widget-border, #333);
  background: rgba(255, 255, 255, 0.02);
}

.lane-title-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lane-name {
  font-size: 0.82rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--vscode-foreground);
}

.lane-counter {
  font-size: 0.75rem;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  font-weight: 600;
}

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100px;
}

.task-card {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-widget-border, #444);
  border-radius: 5px;
  padding: 10px 12px;
  cursor: grab;
  user-select: none;
  transition: transform 0.1s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.task-card:hover {
  border-color: var(--vscode-focusBorder, #007acc);
}

.task-card.selected {
  border-color: var(--vscode-focusBorder, #007acc);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007acc);
}

.ghost-card {
  opacity: 0.4;
  border: 2px dashed var(--vscode-focusBorder, #007acc);
  background: transparent;
}

.dragging-card {
  cursor: grabbing;
}

.card-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.task-id {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vscode-descriptionForeground);
  font-family: monospace;
}

.priority-chip {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}

.priority-p0 {
  background: #e51400;
  color: #fff;
}

.priority-p1 {
  background: #fa6800;
  color: #fff;
}

.priority-p2 {
  background: #007acc;
  color: #fff;
}

.priority-p3 {
  background: #60a917;
  color: #fff;
}

.task-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  line-height: 1.3;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.progress-bar-bg {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--vscode-progressBar-background, #0e70c0);
  transition: width 0.2s ease;
}

.progress-label {
  font-size: 0.72rem;
  color: var(--vscode-descriptionForeground);
  font-family: monospace;
}

/* Task Detail Drawer */
.task-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 380px;
  background: var(--vscode-sideBar-background);
  border-left: 1px solid var(--vscode-widget-border, #333);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  z-index: 100;
  animation: slideIn 0.15s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--vscode-widget-border, #333);
}

.drawer-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-id-large {
  font-size: 1rem;
  font-weight: 700;
  font-family: monospace;
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--vscode-foreground);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.drawer-task-title {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  line-height: 1.35;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  color: var(--vscode-descriptionForeground);
  font-weight: 600;
}

.meta-value {
  font-size: 0.85rem;
  font-weight: 500;
}

.drawer-section {
  margin-top: 16px;
}

.drawer-section h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 10px 0;
  border-bottom: 1px solid var(--vscode-widget-border, #333);
  padding-bottom: 6px;
}

.criteria-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.criterion-item {
  display: flex;
  align-items: flex-start;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  font-size: 0.88rem;
  line-height: 1.4;
}

.checkbox-label input[type="checkbox"] {
  margin-top: 3px;
  cursor: pointer;
}

.text-checked {
  text-decoration: line-through;
  color: var(--vscode-disabledForeground, #777);
}

.text-muted {
  color: var(--vscode-descriptionForeground);
  font-size: 0.85rem;
  font-style: italic;
}
</style>
