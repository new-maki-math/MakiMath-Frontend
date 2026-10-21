<script setup>
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h1 class="view-title font-mono">HOW TO USE // 使用手册</h1>
      <p class="view-desc">掌握 Typst 数学公式语法与 MakiMath 核心交互操作。</p>
    </div>

    <div class="card-grid">
      <div class="info-card">
        <div class="card-header">
          <span class="card-title font-mono">SYNTAX // Typst 公式快速速查</span>
          <MTag variant="green" size="sm">SYNTAX</MTag>
        </div>
        <div class="code-preview font-mono">
          <div class="code-line">$ sum_(k=1)^n k = (n(n+1))/2 $</div>
          <div class="code-line">$ integral_0^oo e^(-x^2) dif x = sqrt(pi)/2 $</div>
        </div>
        <p class="card-body-text">
          使用内联公式 <code>$ ... $</code> 或独立公式块编写数学定义与推导。
        </p>
      </div>

      <div class="info-card">
        <div class="card-header">
          <span class="card-title font-mono">SHORTCUTS // 键盘快捷操作</span>
          <MTag variant="cyan" size="sm">KEYBINDINGS</MTag>
        </div>
        <ul class="shortcut-list">
          <li>
            <span>全局搜索节点</span>
            <kbd>Ctrl + K</kbd>
          </li>
          <li>
            <span>下拉选择</span>
            <kbd>↑ / ↓</kbd>
          </li>
          <li>
            <span>关闭弹窗</span>
            <kbd>Esc</kbd>
          </li>
        </ul>
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
  gap: 14px;
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

.code-preview {
  background-color: var(--bg-topbar);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--font-size-smaller);
  color: var(--text-primary);
}

.code-line {
  color: var(--tag-green);
}

.card-body-text {
  font-size: var(--font-size-smaller);
  line-height: 1.6;
  color: var(--text-muted);
}

.card-body-text code {
  background-color: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  color: var(--accent-primary);
}

.shortcut-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shortcut-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  padding: 6px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.shortcut-list li:last-child {
  border-bottom: none;
}

.shortcut-list kbd {
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-smallest);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}
</style>
