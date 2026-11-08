<script setup>
defineProps({
  size: {
    type: Number,
    default: 20
  }
});
</script>

<template>
  <span
    class="m-spinner"
    :style="{
      '--spinner-size': `${size}px`
    }"
    aria-hidden="true"
  >
    <span class="m-spinner-ring"></span>
    <span
      v-if="$slots.default"
      class="m-spinner-content"
    >
      <slot />
    </span>
  </span>
</template>

<style scoped>
.m-spinner {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--spinner-size);
  height: var(--spinner-size);
  vertical-align: middle;
}
.m-spinner-ring {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border: 2px solid var(--border-hover);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: m-spinner-spin 750ms linear infinite;
}
.m-spinner-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
@keyframes m-spinner-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .m-spinner-ring {
    animation: none;
  }
}
</style>
