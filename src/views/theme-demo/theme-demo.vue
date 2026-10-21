<script setup>
defineProps({
  currentView: {
    type: String,
    default: 'start'
  }
});
</script>

<template>
  <div class="viewport-canvas">
    <!-- 阶梯色阶与层级展示块 -->
    <section class="spec-section">
      <div class="section-heading">
        <span class="heading-title">层级底色阶梯 (Grayscale Elevation Stairs)</span>
        <span class="heading-desc font-mono">NO PURE BLACK // BORDERLESS BY ELEVATION</span>
      </div>

      <div class="elevation-grid">
        <div class="elevation-card level-topbar">
          <div class="card-meta font-mono">--bg-topbar (#090909)</div>
          <div class="card-label">外层顶栏 (最深)</div>
        </div>
        <div class="elevation-card level-sidebar">
          <div class="card-meta font-mono">--bg-sidebar (#0f0f0f)</div>
          <div class="card-label">侧栏框架 (次深)</div>
        </div>
        <div class="elevation-card level-app">
          <div class="card-meta font-mono">--bg-app (#181818)</div>
          <div class="card-label">主工作区画布</div>
        </div>
        <div class="elevation-card level-surface">
          <div class="card-meta font-mono">--bg-surface (#202020)</div>
          <div class="card-label">内容面板卡片 (凸显)</div>
        </div>
      </div>
    </section>

    <!-- 强调色与点缀色展示块 -->
    <section class="spec-section">
      <div class="section-heading">
        <span class="heading-title">纯色填充与微点缀规范 (Solid Accent & Micro Tags)</span>
        <span class="heading-desc font-mono">VS CODE CHARCOAL THEME // SOLID ACCENTS</span>
      </div>

      <div class="tokens-demo-row">
        <div class="demo-group">
          <div class="group-title font-mono">MButton 组件 (纯色微圆角 4px)</div>
          <div class="button-row">
            <MButton variant="primary" :mono="true">PRIMARY BUTTON</MButton>
            <MButton variant="secondary" :mono="true">SECONDARY ACTION</MButton>
            <MButton variant="ghost" :mono="true">GHOST OUTLINE</MButton>
          </div>
        </div>

        <div class="demo-group">
          <div class="group-title font-mono">MTag 组件 (清透微点缀 2px)</div>
          <div class="tag-row">
            <MTag variant="purple">PURPLE // #b180ff</MTag>
            <MTag variant="green">TYPE // #4ec9b0</MTag>
            <MTag variant="amber">WARN // #ce9178</MTag>
            <MTag variant="cyan">CYAN // #4fc1ff</MTag>
          </div>
        </div>
      </div>
    </section>

    <!-- 结构化双栏框架展示 -->
    <section class="spec-section">
      <div class="section-heading">
        <span class="heading-title">工作区结构化框架 (Structured Workspace Surface)</span>
        <span class="heading-desc font-mono">PADDING & SPACING OVER PHYSICAL BORDERS</span>
      </div>

      <div class="surface-frame-grid">
        <div class="surface-panel">
          <div class="panel-header">
            <span class="panel-title font-mono">PANEL_LEFT // CONTEXT</span>
            <MTag variant="cyan" size="sm">READONLY</MTag>
          </div>
          <div class="panel-body">
            <div class="skeleton-block line-lg"></div>
            <div class="skeleton-block line-md"></div>
            <div class="skeleton-block line-sm"></div>
          </div>
        </div>

        <div class="surface-panel">
          <div class="panel-header">
            <span class="panel-title font-mono">PANEL_RIGHT // INSPECTOR</span>
            <MTag variant="purple" size="sm">ACTIVE_VIEW: {{ currentView.toUpperCase() }}</MTag>
          </div>
          <div class="panel-body">
            <div class="skeleton-row">
              <div class="skeleton-block fill-half"></div>
              <div class="skeleton-block fill-half"></div>
            </div>
            <div class="skeleton-block line-md"></div>
            <div class="skeleton-block line-lg"></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 画布与设计规范展示区 */
.viewport-canvas {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1280px;
}

.spec-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.heading-title {
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.heading-desc {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

/* 灰度阶梯网格 */
.elevation-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.elevation-card {
  padding: 18px;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 94px;
}

.elevation-card.level-topbar {
  background-color: var(--bg-topbar);
  border: 1px dashed var(--border-subtle);
}

.elevation-card.level-sidebar {
  background-color: var(--bg-sidebar);
}

.elevation-card.level-app {
  background-color: var(--bg-app);
}

.elevation-card.level-surface {
  background-color: var(--bg-surface);
}

.card-meta {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.card-label {
  font-size: var(--font-size);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

/* 强调色与点缀色展示 */
.tokens-demo-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.demo-group {
  background-color: var(--bg-surface);
  padding: 20px;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.group-title {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.button-row,
.tag-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* 结构化双栏框架面板 */
.surface-frame-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.surface-panel {
  background-color: var(--bg-surface);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.panel-header {
  height: 40px;
  padding: 0 16px;
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.panel-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 骨架条块示意 */
.skeleton-block {
  height: 14px;
  background-color: var(--bg-elevated);
  border-radius: var(--radius-xs);
}

.line-lg { width: 92%; }
.line-md { width: 68%; }
.line-sm { width: 44%; }
.fill-half { flex: 1; height: 42px; }

.skeleton-row {
  display: flex;
  gap: 12px;
  width: 100%;
}
</style>
