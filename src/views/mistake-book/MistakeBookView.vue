<template>
  <main class="mistake-book">
    <h1>错题本</h1>
    <div class="placeholder">错题本功能正在建设中</div>
  </main>
</template>

<style scoped>
.mistake-book {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 36px;
  box-sizing: border-box;
}
h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-larger);
}
.placeholder {
  padding: 80px 20px;
  color: var(--text-muted);
  text-align: center;
  font-size: var(--font-size-smaller);
}
@media (max-width: 600px) {
  .mistake-book {
    padding: 20px 16px;
  }
}
</style>
