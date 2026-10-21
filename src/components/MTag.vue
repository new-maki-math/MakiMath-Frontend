<script setup>
defineProps({
  variant: {
    type: String,
    default: 'cyan',
    validator: (v) => ['purple', 'green', 'amber', 'cyan', 'blue', 'muted', 'teal', 'lime'].includes(v)
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
      `variant-${variant}`,
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
  gap: 5px;
  border-radius: var(--radius-xs);
  font-weight: var(--font-weight-medium);
  user-select: none;
  line-height: 1;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.m-tag.is-mono {
  font-family: var(--font-ui);
}

/* 尺寸变体 */
.size-sm {
  height: 20px;
  padding: 0 6px;
  font-size: var(--font-size-smallest);
}

.size-md {
  height: 24px;
  padding: 0 8px;
  font-size: var(--font-size-smaller);
}

.tag-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: currentColor;
  flex-shrink: 0;
}

/* 色彩变体 - 清透微点缀 (Secondary Colors) 遵循 Design.md */
.variant-purple {
  color: var(--tag-purple);
  background-color: var(--tag-purple-bg);
}

.variant-green {
  color: var(--tag-green);
  background-color: var(--tag-green-bg);
}

.variant-amber {
  color: var(--tag-amber);
  background-color: var(--tag-amber-bg);
}

.variant-cyan {
  color: var(--tag-cyan);
  background-color: var(--tag-cyan-bg);
}

.variant-blue {
  color: #60a5fa;
  background-color: rgba(96, 165, 250, 0.14);
}

.variant-muted {
  color: var(--text-muted);
  background-color: var(--bg-elevated);
}

.variant-teal {
  color: var(--tag-teal, #2dd4bf);
  background-color: var(--tag-teal-bg, rgba(45, 212, 191, 0.16));
}

.variant-lime {
  color: var(--tag-lime, #a3e635);
  background-color: var(--tag-lime-bg, rgba(163, 230, 53, 0.14));
}
</style>
