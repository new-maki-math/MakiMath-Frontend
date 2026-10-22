<script setup>
defineProps({
  variant: {
    type: String,
    default: 'secondary',
    validator: (v) => ['primary', 'secondary', 'ghost', 'danger'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  },
  mono: {
    type: Boolean,
    default: false
  },
  block: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'button'
  }
});

defineEmits(['click']);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="m-button"
    :class="[
      `variant-${variant}`,
      `size-${size}`,
      { 'is-mono': mono, 'is-block': block, 'is-disabled': disabled }
    ]"
    @click="$emit('click', $event)"
  >
    <span v-if="$slots.icon" class="btn-icon">
      <slot name="icon" />
    </span>
    <span class="btn-content">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.m-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  line-height: 1;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* 快速而克制的纯色过渡，严禁弹跳与拖拉 */
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
}

.m-button.is-block {
  width: 100%;
}

.m-button.is-mono {
  font-family: var(--font-ui);
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 尺寸变体 (Sizes) */
.size-sm {
  height: 28px;
  padding: 0 12px;
  font-size: var(--font-size-smaller);
}

.size-md {
  height: 34px;
  padding: 0 16px;
  font-size: var(--font-size);
}

.size-lg {
  height: 40px;
  padding: 0 20px;
  font-size: var(--font-size-larger);
}

/* 风格变体 (Variants) - 纯色填充，去装饰化，严禁渐变与厚阴影 */
.variant-primary {
  background-color: var(--accent-primary);
  color: #ffffff;
}
.variant-primary:hover:not(:disabled) {
  background-color: var(--accent-hover);
}
.variant-primary:active:not(:disabled) {
  background-color: var(--accent-active);
}

.variant-secondary {
  background-color: var(--btn-secondary-bg, var(--bg-elevated));
  color: var(--btn-secondary-color, var(--text-primary));
  border: 1px solid var(--btn-secondary-border, var(--border-subtle));
}
.variant-secondary:hover:not(:disabled) {
  background-color: var(--btn-secondary-hover-bg, var(--bg-hover));
  color: var(--btn-secondary-hover-color, var(--text-primary));
  border-color: var(--btn-secondary-hover-border, var(--border-hover));
}

.variant-ghost {
  background-color: transparent;
  color: var(--btn-ghost-color, var(--text-secondary));
  border: 1px solid var(--btn-ghost-border, transparent);
}
.variant-ghost:hover:not(:disabled) {
  background-color: var(--btn-ghost-hover-bg, var(--bg-hover));
  color: var(--btn-ghost-hover-color, var(--text-primary));
  border-color: var(--btn-ghost-hover-border, var(--border-subtle));
}

.variant-danger {
  background-color: #8b1d1d;
  color: #ffffff;
}
.variant-danger:hover:not(:disabled) {
  background-color: #a82828;
}

/* 禁用态 */
.m-button:disabled,
.m-button.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}
</style>
