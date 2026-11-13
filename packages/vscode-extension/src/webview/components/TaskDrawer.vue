<template>
  <aside class="task-drawer">
    <header class="drawer-header">
      <div class="drawer-title-group">
        <span class="task-id-large">{{ task.document?.id || task.filename }}</span>
        <span class="priority-chip" :class="`priority-${task.document?.priority || 'p2'}`">
          {{ task.document?.priority || 'p2' }}
        </span>
      </div>
      <div class="drawer-actions">
        <button class="btn btn-secondary" @click="$emit('openFile', task.filePath)" title="Open in VS Code Editor">
          Open File ↗
        </button>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>
    </header>

    <div class="drawer-content">
      <h2 class="drawer-task-title">{{ task.document?.title }}</h2>

      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Column</span>
          <span class="meta-value">{{ task.column }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Owner</span>
          <span class="meta-value">{{ task.document?.frontmatter?.owner || 'developer' }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Status</span>
          <span class="meta-value">{{ task.document?.frontmatter?.status || task.column }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Updated</span>
          <span class="meta-value">{{ task.document?.frontmatter?.last_updated || '-' }}</span>
        </div>
      </div>

      <!-- Interactive Acceptance Criteria -->
      <section class="drawer-section">
        <h3>Acceptance Criteria</h3>
        <ul v-if="task.document?.acceptanceCriteria?.length" class="criteria-list">
          <li
            v-for="criterion in task.document.acceptanceCriteria"
            :key="criterion.index"
            class="criterion-item"
          >
            <label class="checkbox-label">
              <input
                type="checkbox"
                :checked="criterion.checked"
                @change="$emit('toggleCriterion', task, criterion.index, !criterion.checked)"
              />
              <span :class="{ 'text-checked': criterion.checked }">{{ criterion.text }}</span>
            </label>
          </li>
        </ul>
        <p v-else class="text-muted">No acceptance criteria defined for this task.</p>
      </section>
    </div>

    <!-- Pinned Bottom Action Footer -->
    <footer class="drawer-footer" v-if="lifecycleAction">
      <div class="footer-strategy-info">
        <span class="strategy-badge">
          <span class="codicon codicon-settings-gear strategy-icon"></span>
          Strategy: <strong>{{ strategyLabel }}</strong>
        </span>
        <span class="strategy-desc">{{ lifecycleAction.description }}</span>
      </div>

      <button
        class="btn btn-lifecycle-action"
        :class="[lifecycleAction.buttonClass, { 'btn-disabled': lifecycleAction.disabled }]"
        :disabled="lifecycleAction.disabled"
        :title="lifecycleAction.disabledReason || lifecycleAction.btnText"
        @click="!lifecycleAction.disabled && $emit('triggerLifecycle', lifecycleAction.action, task)"
      >
        <span class="btn-icon codicon" :class="lifecycleAction.iconClass"></span>
        <span>{{ lifecycleAction.btnText }}</span>
      </button>
      <button
        v-if="canBlockTask"
        class="btn btn-lifecycle-action btn-block"
        title="Block task and move to backlog"
        @click="$emit('triggerLifecycle', 'block', task)"
      >
        <span class="btn-icon codicon codicon-circle-slash"></span>
        <span>Block Task...</span>
      </button>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import type { BoardTask } from "@dirban/core/board/types.ts"
import { computed } from "vue"
import type { WebviewBoardState } from "../types.ts"

const props = defineProps<{
  task: BoardTask
  boardState: WebviewBoardState
}>()

defineEmits<{
  (e: "close"): void
  (e: "openFile", filePath: string): void
  (e: "toggleCriterion", task: BoardTask, itemIndex: number, checked: boolean): void
  (
    e: "triggerLifecycle",
    action: "ready" | "start" | "done" | "archive" | "block" | "resume",
    task: BoardTask,
  ): void
}>()

const canBlockTask = computed(() => {
  const col = props.task.column.toLowerCase()
  const focusCol = props.boardState.config?.focusColumn?.toLowerCase()
  const preFocusCol = props.boardState.config?.preFocusColumn?.toLowerCase()
  return col === focusCol || col === preFocusCol
})

const strategyLabel = computed(() => {
  const strategy = props.boardState.config?.branchStrategy ?? "checkout"
  if (strategy === "worktree") return "Git Worktree"
  if (strategy === "none") return "Directory Only (No Git)"
  return "Git Branch (Checkout)"
})

interface LifecycleActionInfo {
  readonly action: "ready" | "start" | "done" | "archive" | "block" | "resume"
  readonly iconClass: string
  readonly label: string
  readonly description: string
  readonly btnText: string
  readonly buttonClass: string
  readonly disabled?: boolean
  readonly disabledReason?: string
}

const lifecycleAction = computed<LifecycleActionInfo | null>(() => {
  const col = props.task.column.toLowerCase()
  const focusCol = props.boardState.config?.focusColumn?.toLowerCase()
  const preFocusCol = props.boardState.config?.preFocusColumn?.toLowerCase()
  const postFocusCol = props.boardState.config?.postFocusColumn?.toLowerCase()
  const strategy = props.boardState.config?.branchStrategy ?? "checkout"

  const taskId = props.task.document?.id ?? props.task.filename
  const currentTaskId = props.boardState.currentTaskId
  const isCurrentTask = Boolean(currentTaskId && currentTaskId === taskId)
  const hasTaskInDoing = (props.boardState.activeTasksInDoingCount ?? 0) > 0

  if (col === "backlog") {
    const fm = props.task.document?.frontmatter
    const isBlocked = Boolean(fm?.blocked_reason) || (fm?.blocked_by?.length ?? 0) > 0
    if (isBlocked) {
      return {
        action: "resume",
        iconClass: "codicon-play-circle",
        label: "Resume Task",
        description: "Unblocks task and resumes it into the active doing column.",
        btnText: "Resume Task",
        buttonClass: "btn-start",
      }
    }
    return {
      action: "ready",
      iconClass: "codicon-rocket",
      label: "Ready Task",
      description: "Evaluates dependencies and unblocks card into todo queue.",
      btnText: "Ready Task (Move to Queue)",
      buttonClass: "btn-ready",
    }
  }

  if (preFocusCol && col === preFocusCol) {
    let disabled = false
    let disabledReason: string | undefined

    // Git branch: cannot start if there is already an active task in progress in focus/doing
    if (strategy === "checkout" && hasTaskInDoing) {
      disabled = true
      disabledReason = `Cannot start: another task (${currentTaskId ?? "active task"}) is currently in progress. Complete or pause it first.`
    }

    const startDesc = disabled
      ? (disabledReason ?? "")
      : strategy === "worktree"
        ? "Creates dedicated git worktree and checks out branch."
        : strategy === "none"
          ? "Transitions task into doing (pure directory move, no Git)."
          : "Creates and checks out local task branch in git."

    const startBtn =
      strategy === "worktree"
        ? "Start Task (Git Worktree)"
        : strategy === "none"
          ? "Start Task (Directory Only)"
          : "Start Task (Checkout Branch)"

    return {
      action: "start",
      iconClass: "codicon-play",
      label: "Start Task",
      description: startDesc,
      btnText: startBtn,
      buttonClass: "btn-start",
      disabled,
      disabledReason,
    }
  }

  if (focusCol && col === focusCol) {
    let disabled = false
    let disabledReason: string | undefined

    // Git branch & Git worktree: done can only complete the currently active/checked-out task
    if ((strategy === "checkout" || strategy === "worktree") && !isCurrentTask) {
      disabled = true
      disabledReason = `Cannot mark done: this is not the active/checked-out task (current active: ${currentTaskId ?? "none"}).`
    }

    const doneDesc = disabled
      ? (disabledReason ?? "")
      : strategy === "worktree"
        ? "Squash/merges branch, deletes worktree, and marks done."
        : strategy === "none"
          ? "Marks done without modifying Git branches."
          : "Squash/merges task branch into base branch."

    const doneBtn = strategy === "none" ? "Complete Task (Mark Done)" : "Complete & Merge Task"

    return {
      action: "done",
      iconClass: "codicon-check",
      label: "Complete Task",
      description: doneDesc,
      btnText: doneBtn,
      buttonClass: "btn-done",
      disabled,
      disabledReason,
    }
  }

  if ((postFocusCol && col === postFocusCol) || col.includes("done")) {
    return {
      action: "archive",
      iconClass: "codicon-archive",
      label: "Archive Task",
      description: "Permanently moves completed card into flat archive storage.",
      btnText: "Archive Task",
      buttonClass: "btn-archive",
    }
  }

  return null
})
</script>

<style scoped>
.task-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  max-height: 100%;
  width: 420px;
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
  flex-shrink: 0;
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
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
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

/* Pinned Bottom Action Footer */
.drawer-footer {
  flex-shrink: 0;
  margin-top: auto;
  border-top: 1px solid var(--vscode-widget-border, #333);
  background: rgba(0, 0, 0, 0.25);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-strategy-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.strategy-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--vscode-foreground);
}

.strategy-icon {
  font-size: 1rem;
  color: var(--vscode-textLink-foreground, #3794ff);
}

.strategy-desc {
  font-size: 0.76rem;
  color: var(--vscode-descriptionForeground);
  line-height: 1.3;
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

.btn.btn-lifecycle-action {
  width: 100%;
  justify-content: center;
  padding: 14px 20px;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  letter-spacing: 0.2px;
  gap: 8px;
}

.btn-secondary {
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #ffffff);
}

.btn-ready {
  background: #0288d1;
  color: #fff;
}

.btn-ready:hover {
  background: #0277bd;
}

.btn-start {
  background: #2e7d32;
  color: #fff;
}

.btn-start:hover {
  background: #256b29;
}

.btn-done {
  background: #388e3c;
  color: #fff;
}

.btn-done:hover {
  background: #2e7d32;
}

.btn-archive {
  background: #5c6bc0;
  color: #fff;
}

.btn-archive:hover {
  background: #4e5ba6;
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

.btn-lifecycle-action.btn-disabled,
.btn-lifecycle-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: grayscale(0.6);
  box-shadow: none;
}
</style>
