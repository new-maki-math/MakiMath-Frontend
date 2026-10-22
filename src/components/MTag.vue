<script setup>
import { computed } from 'vue';

const props = defineProps({
  variant: {
    type: String,
    default: 'cyan',
    validator: (v) => !v || ['purple', 'green', 'amber', 'cyan', 'blue', 'muted', 'teal', 'lime', 'red', 'orange', 'gray'].includes(v)
  },
  color: {
    type: String,
    default: ''
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

// 支持自定义颜色值
const customStyle = computed(() => {
  if (!props.color) return null;
  const c = props.color.trim();
  if (c.startsWith('#') || c.startsWith('rgb') || c.startsWith('hsl') || c.startsWith('var(')) {
    return {
      color: c,
      backgroundColor: `color-mix(in srgb, ${c} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${c} 24%, transparent)`
    };
  }
  return null;
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
    :style="customStyle"
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
.variant-green  { color: #34d399; background-color: rgba(52, 211, 153, 0.14); }
.variant-amber  { color: var(--tag-amber); background-color: var(--tag-amber-bg); }
.variant-cyan   { color: var(--tag-cyan); background-color: var(--tag-cyan-bg); }
.variant-blue   { color: #38bdf8; background-color: rgba(56, 189, 248, 0.14); }
.variant-muted  { color: var(--text-muted); background-color: var(--bg-elevated); }
.variant-gray   { color: #94a3b8; background-color: rgba(148, 163, 184, 0.14); }
.variant-red    { color: #fb7185; background-color: rgba(251, 113, 133, 0.14); }
.variant-orange { color: #fb923c; background-color: rgba(251, 146, 60, 0.14); }
.variant-teal   { color: var(--tag-teal, #2dd4bf); background-color: var(--tag-teal-bg, rgba(45, 212, 191, 0.16)); }
.variant-lime   { color: var(--tag-lime, #a3e635); background-color: var(--tag-lime-bg, rgba(163, 230, 53, 0.14)); }
</style>
