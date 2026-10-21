<script setup>
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h1 class="view-title font-mono">START // 快速开始</h1>
      <p class="view-desc">MakiMath 数学讲义系统工作台，专注于结构化公式编排与知识图谱浏览。</p>
    </div>

    <div class="card-grid">
      <div class="info-card">
        <div class="card-header">
          <span class="card-title font-mono">01 // 环境与引擎</span>
          <MTag variant="purple" size="sm">TYPST</MTag>
        </div>
        <p class="card-body-text">
          基于 Typst 现代化排版引擎驱动，提供毫秒级公式渲染与高质量 PDF/SVG 讲义输出。
        </p>
      </div>

      <div class="info-card">
        <div class="card-header">
          <span class="card-title font-mono">02 // 极简暗色体验</span>
          <MTag variant="cyan" size="sm">THEME</MTag>
        </div>
        <p class="card-body-text">
          遵循中性深炭灰阶梯规范，无眩光纯色微圆角，提供沉浸专注的公式编排视界。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1200px;
}

.view-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-title {
  font-size: var(--font-size-largest);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.view-desc {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.card-body-text {
  font-size: var(--font-size-smaller);
  line-height: 1.6;
  color: var(--text-muted);
}
</style>
