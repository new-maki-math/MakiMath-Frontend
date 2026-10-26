<script setup>
</script>

<template>
  <div class="how-to-use-view">
    <div class="coming-soon-box font-mono">
      <span class="coming-soon-tag">DOCS // 手册</span>
      <h1 class="coming-soon-title">COMING SOON</h1>
      <p class="coming-soon-desc">使用手册正在编撰完善中，敬请期待</p>
    </div>
  </div>
</template>

<style scoped>
.how-to-use-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 140px);
  width: 100%;
  padding: 24px 16px;
  box-sizing: border-box;
}

.coming-soon-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
  user-select: none;
}

.coming-soon-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-xs, 2px);
  background-color: var(--accent-muted, rgba(56, 189, 248, 0.12));
  color: var(--accent-primary, #38bdf8);
  font-size: var(--font-size-smallest, 12px);
  letter-spacing: 1.5px;
}

.coming-soon-title {
  font-size: clamp(28px, 6vw, 44px);
  font-weight: var(--font-weight-bold, 700);
  color: var(--text-primary, #ffffff);
  letter-spacing: 4px;
  line-height: 1.2;
}

.coming-soon-desc {
  font-size: var(--font-size, 14px);
  color: var(--text-muted, #808080);
  letter-spacing: 0.5px;
}
</style>
