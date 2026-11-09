<template>
  <div class="dirban-app">
    <!-- Top Bar Component -->
    <BoardTopBar
      @refresh="requestRefresh"
      @newTask="promptNewTask"
    />

    <!-- Main Kanban Lanes Viewport (click-outside closes drawer) -->
    <main class="board-viewport" ref="viewportRef" @click="handleViewportClick">
      <div v-if="boardState.columns.length === 0" class="empty-board">
        <p>No columns discovered in workspace. Run <code>dirban init</code> or check tasks directory.</p>
      </div>

      <div v-else class="columns-container">
        <ColumnLane
          v-for="col in boardState.columns"
          :key="col.name"
          :name="col.name"
          :tasks="(col.tasks as any)"
          :selected-task-id="selectedTask?.filePath"
          @selectTask="selectTask"
          @openTask="openTaskFile"
          @moveTask="handleTaskMove"
        />
      </div>
    </main>

    <!-- Task Detail Drawer Component -->
    <TaskDrawer
      v-if="selectedTask"
      :task="selectedTask"
      :board-state="boardState"
      @close="selectedTask = null"
      @openFile="openTaskFile"
      @toggleCriterion="toggleCriterion"
      @triggerLifecycle="triggerLifecycleAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import type { BoardTask } from "@dirban/core/board/types.ts"
import type {
  WebviewBoardState,
  WebviewMessageToExtension,
  ExtensionMessageToWebview,
} from "./types.ts"
import BoardTopBar from "./components/BoardTopBar.vue"
import ColumnLane from "./components/ColumnLane.vue"
import TaskDrawer from "./components/TaskDrawer.vue"

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
      boardState.config = message.state.config
      // Sync selected task with latest state from extension
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

function handleViewportClick(event: MouseEvent) {
  if (!selectedTask.value) return
  // If clicking on an actual task card or its children, allow selectTask to handle it
  const target = event.target as HTMLElement | null
  if (target?.closest(".task-card")) {
    return
  }
  // Otherwise, clicked on board background, lane background, or whitespace -> close drawer
  selectedTask.value = null
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

function handleTaskMove(payload: { task: BoardTask; targetColumn: string }) {
  vscode.postMessage({
    type: "moveTask",
    taskId: payload.task.document?.id || payload.task.filename,
    targetColumn: payload.targetColumn,
  })
}

function triggerLifecycleAction(action: "ready" | "start" | "done" | "archive", task: BoardTask) {
  const taskId = task.document?.id || task.filename
  vscode.postMessage({
    type: "lifecycleAction",
    action,
    taskId,
  })
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

.empty-board {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  color: var(--vscode-descriptionForeground);
}
</style>
