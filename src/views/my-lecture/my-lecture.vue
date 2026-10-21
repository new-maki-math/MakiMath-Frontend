<script setup>
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h1 class="view-title font-mono">MY LECTURES // 我的讲义</h1>
      <p class="view-desc">已收藏与本地保存的数学推导笔记与讲义片段。</p>
    </div>

    <div class="notes-list">
      <div class="note-item">
        <div class="note-main">
          <div class="note-badge-wrap">
            <MTag variant="purple" size="sm">CALCULUS</MTag>
            <span class="note-time font-mono">UPDATED 10m AGO</span>
          </div>
          <h3 class="note-title">多元微积分中的链式法则与 Hessian 矩阵定号判别</h3>
          <p class="note-summary">
            整理 Taylor 二阶展式、对称矩阵特征值与临界点极值充分条件的推导过程。
          </p>
        </div>
        <div class="note-actions">
          <MButton variant="ghost" size="sm" :mono="true">EDIT</MButton>
          <MButton variant="primary" size="sm" :mono="true">EXPORT PDF</MButton>
        </div>
      </div>

      <div class="note-item">
        <div class="note-main">
          <div class="note-badge-wrap">
            <MTag variant="green" size="sm">TOPOLOGY</MTag>
            <span class="note-time font-mono">UPDATED 2h AGO</span>
          </div>
          <h3 class="note-title">紧致度量空间与 Lebesgue 数引理</h3>
          <p class="note-summary">
            开覆盖有限子覆盖公理在欧几里得子集上的有界闭等价性证明备忘。
          </p>
        </div>
        <div class="note-actions">
          <MButton variant="ghost" size="sm" :mono="true">EDIT</MButton>
          <MButton variant="primary" size="sm" :mono="true">EXPORT PDF</MButton>
        </div>
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

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note-item {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.note-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.note-badge-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.note-time {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
}

.note-title {
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.note-summary {
  font-size: var(--font-size-smaller);
  line-height: 1.5;
  color: var(--text-muted);
  margin: 0;
}

.note-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
