<template>
  <header class="topbar">
    <div class="brand">
      <span class="logo">⚡</span>
      <h1>Dirban Kanban</h1>
      <span class="badge">Directory-Only Drag & Drop</span>
    </div>

    <div class="topbar-center-notice">
      <span class="notice-icon">ℹ</span>
      <span>Drag & drop moves files on disk. Use task drawer buttons for Git branch & lifecycle workflows.</span>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" @click="$emit('refresh')" title="Refresh Board">
        ↻ Refresh
      </button>
      <button class="btn btn-primary" @click="$emit('newTask')" title="Create New Task">
        + New Task
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
defineEmits<{
  (e: "refresh"): void
  (e: "newTask"): void
}>()
</script>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-widget-border, #333);
  gap: 16px;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
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

.topbar-center-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--vscode-descriptionForeground);
  background: rgba(255, 255, 255, 0.04);
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px dashed var(--vscode-widget-border, #444);
}

.notice-icon {
  font-weight: bold;
  color: var(--vscode-textLink-foreground, #3794ff);
}

.actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
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
</style>
