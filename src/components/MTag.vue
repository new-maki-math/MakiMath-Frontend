<script setup>
defineProps({
  variant: {
    type: String,
    default: 'cyan',
    validator: (v) => !v || ['purple', 'green', 'amber', 'cyan', 'blue', 'muted', 'teal', 'lime', 'red', 'orange', 'gray'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md'].includes(v)
  },
  mono: {
    type: Boolean,
    default: true
  },
  dot: {
    type: Boolean,
    default: false
  }
});

</script>

<template>
  <span
    class="m-tag"
    :class="[
      variant ? `variant-${variant}` : '',
      `size-${size}`,
      { 'is-mono': mono }
    ]"
  >
    <span v-if="dot" class="tag-dot" />
    <slot />
  </span>
</template>

<style scoped>
.m-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  gap: 5px;
  border-radius: var(--radius-xs, 2px);
  font-weight: var(--font-weight-medium, 500);
  user-select: none;
  line-height: 1;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.m-tag.is-mono {
  font-family: var(--font-ui, sans-serif);
}

/* 尺寸变体 */
.size-sm {
  height: 20px;
  padding: 0 6px;
  font-size: var(--font-size-smallest, 12px);
}

.size-md {
  height: 24px;
  padding: 0 8px;
  font-size: var(--font-size-smaller, 13px);
}

.tag-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: currentColor;
  flex-shrink: 0;
}

/* 色彩变体 */
.variant-purple { color: var(--tag-purple); background-color: var(--tag-purple-bg); }
.variant-green  { color: var(--tag-green); background-color: var(--tag-green-bg); }
.variant-amber  { color: var(--tag-amber); background-color: var(--tag-amber-bg); }
.variant-cyan   { color: var(--tag-cyan); background-color: var(--tag-cyan-bg); }
.variant-blue   { color: var(--tag-blue); background-color: var(--tag-blue-bg); }
.variant-muted  { color: var(--text-muted); background-color: var(--bg-elevated); }
.variant-gray   { color: var(--tag-gray); background-color: var(--tag-gray-bg); }
.variant-red    { color: var(--tag-red); background-color: var(--tag-red-bg); }
.variant-orange { color: var(--tag-orange); background-color: var(--tag-orange-bg); }
.variant-teal   { color: var(--tag-teal, #2dd4bf); background-color: var(--tag-teal-bg, rgba(45, 212, 191, 0.16)); }
.variant-lime   { color: var(--tag-lime, #a3e635); background-color: var(--tag-lime-bg, rgba(163, 230, 53, 0.14)); }
</style>
