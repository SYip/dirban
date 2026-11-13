<template>
  <section class="column-lane" :class="columnClass">
    <header class="lane-header">
      <div class="lane-title-group">
        <h2 class="lane-name">{{ columnTitle }}</h2>
        <span class="lane-counter">{{ tasks.length }}</span>
      </div>
    </header>

    <draggable
      :list="tasks"
      group="tasks"
      item-key="filename"
      class="task-list"
      ghost-class="ghost-card"
      drag-class="dragging-card"
      @change="handleDragChange"
    >
      <template #item="{ element: task }">
        <TaskCard
          :task="task"
          :is-selected="selectedTaskId === task.filePath"
          @select="$emit('selectTask', $event)"
          @open="$emit('openTask', $event)"
        />
      </template>
    </draggable>
  </section>
</template>

<script setup lang="ts">
import type { BoardTask } from "@dirban/core/board/types.ts"
import { computed } from "vue"
import draggable from "vuedraggable"
import TaskCard from "./TaskCard.vue"

const props = defineProps<{
  name: string
  tasks: BoardTask[]
  selectedTaskId?: string
}>()

const emit = defineEmits<{
  (e: "selectTask", task: BoardTask): void
  (e: "openTask", filePath: string): void
  (e: "moveTask", payload: { task: BoardTask; targetColumn: string }): void
}>()

const columnTitle = computed(() => {
  if (props.name === "backlog") return "Backlog"
  if (props.name === "archive") return "Archive"
  return props.name.replace(/^\d+-/, "").replace(/-/g, " ").toUpperCase()
})

const columnClass = computed(() => {
  const n = props.name.toLowerCase()
  if (n === "backlog") return "lane-backlog"
  if (n.includes("doing")) return "lane-doing"
  if (n.includes("done")) return "lane-done"
  if (n === "archive") return "lane-archive"
  return "lane-standard"
})

function handleDragChange(event: { added?: { element: BoardTask } }) {
  if (event.added) {
    const task = event.added.element as BoardTask
    emit("moveTask", { task, targetColumn: props.name })
  }
}
</script>

<style scoped>
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
  flex-shrink: 0;
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

.ghost-card {
  opacity: 0.4;
  border: 2px dashed var(--vscode-focusBorder, #007acc);
  background: transparent;
}

.dragging-card {
  cursor: grabbing;
}
</style>
