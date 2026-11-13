<template>
  <article
    class="task-card"
    :class="{ selected: isSelected }"
    @click="$emit('select', task)"
    @dblclick="$emit('open', task.filePath)"
  >
    <div class="card-topline">
      <span class="task-id">{{ task.document?.id || task.filename }}</span>
      <div class="card-badges">
        <span v-if="isBlocked" class="blocked-chip" title="Blocked">Blocked</span>
        <span class="priority-chip" :class="`priority-${task.document?.priority || 'p2'}`">
          {{ task.document?.priority || 'p2' }}
        </span>
      </div>
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
          :style="{ width: `${criteriaPercent}%` }"
        ></div>
      </div>
      <span class="progress-label">
        {{ checkedCriteriaCount }}/{{ task.document.acceptanceCriteria.length }}
      </span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { BoardTask } from "@dirban/core/board/types.ts"

const props = defineProps<{
  task: BoardTask
  isSelected: boolean
}>()

defineEmits<{
  (e: "select", task: BoardTask): void
  (e: "open", filePath: string): void
}>()

const isBlocked = computed(() => {
  const fm = props.task.document?.frontmatter
  return Boolean(fm?.blocked_reason) || (fm?.blocked_by?.length ?? 0) > 0
})

const checkedCriteriaCount = computed(() => {
  return props.task.document?.acceptanceCriteria?.filter((c) => c.checked).length || 0
})

const criteriaPercent = computed(() => {
  const total = props.task.document?.acceptanceCriteria?.length || 0
  if (total === 0) return 0
  return Math.round((checkedCriteriaCount.value / total) * 100)
})
</script>

<style scoped>
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

.card-badges {
  display: flex;
  align-items: center;
  gap: 4px;
}

.blocked-chip {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  background: var(--vscode-inputValidation-warningBackground, #5c4800);
  color: var(--vscode-inputValidation-warningForeground, #ffcc00);
  border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
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
</style>
