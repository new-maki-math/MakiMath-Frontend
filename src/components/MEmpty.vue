<script setup>
defineProps({
  description: {
    type: String,
    default: '空空如也'
  }
});
</script>

<template>
  <div class="m-empty">
    <span class="m-empty-face"
aria-hidden="true">( ·_· )</span>
    <p>{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.m-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-muted);
  text-align: center;
}

.m-empty-face {
  font-family: var(--font-mono);
  font-size: 24px;
  line-height: 1;
}

p {
  margin: 0;
  font-size: var(--font-size-smaller);
}
</style>
