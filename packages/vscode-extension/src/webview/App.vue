<template>
  <main class="dirban-container">
    <header class="header">
      <h2>Dirban Board</h2>
      <p class="subtitle">Zero-Database, Agent-Native Kanban</p>
    </header>

    <section class="placeholder-card">
      <div class="card-status">Ready</div>
      <h3>VS Code Extension Pipeline Active</h3>
      <p>Vue 3 + Vite webview assets loaded and running in the extension host.</p>
    </section>
  </main>
</template>

<script setup lang="ts">
// Placeholder Webview component for Dirban Board
</script>

<style scoped>
.dirban-container {
  padding: 16px;
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
}

.header {
  margin-bottom: 20px;
  border-bottom: 1px solid var(--vscode-widget-border, #333);
  padding-bottom: 8px;
}

.header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.subtitle {
  margin: 4px 0 0 0;
  font-size: 0.85rem;
  color: var(--vscode-descriptionForeground);
}

.placeholder-card {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-widget-border, #444);
  border-radius: 4px;
  padding: 12px 16px;
  margin-top: 12px;
}

.card-status {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  margin-bottom: 8px;
}

.placeholder-card h3 {
  margin: 0 0 6px 0;
  font-size: 1rem;
}

.placeholder-card p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--vscode-descriptionForeground);
}
</style>
