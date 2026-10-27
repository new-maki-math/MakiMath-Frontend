<script setup>
defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  ariaLabel: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  hint: {
    type: String,
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

defineEmits(['update:modelValue']);
</script>

<template>
  <label class="m-field">
    <span v-if="label" class="field-label">{{ label }}</span>
    <div class="select-shell">
      <select
        class="m-select"
        :aria-label="ariaLabel || undefined"
        :value="modelValue"
        :disabled="disabled"
        @change="$emit('update:modelValue', $event.target.value)"
      >
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
          :disabled="opt.disabled"
        >
          {{ opt.label }}
        </option>
      </select>
      <span class="select-caret" aria-hidden="true"></span>
    </div>
    <span v-if="hint" class="field-hint">{{ hint }}</span>
  </label>
</template>

<style scoped>
.m-field {
  display: block;
  min-width: 0;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.field-hint {
  display: block;
  margin-top: 5px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.select-shell {
  position: relative;
}

.m-select {
  width: 100%;
  height: 36px;
  padding: 0 26px 0 11px;
  /* 下拉框基础样式 */
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size);
  appearance: none;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.m-select:hover:not(:disabled) {
  border-color: var(--border-hover);
}

.m-select:focus {
  border-color: var(--border-focus);
  background-color: var(--bg-elevated);
}

.m-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.m-select option {
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

/* 下拉箭头图标 */
.select-caret {
  position: absolute;
  right: 11px;
  top: 50%;
  width: 6px;
  height: 6px;
  margin-top: -4px;
  border-right: 1px solid var(--text-muted);
  border-bottom: 1px solid var(--text-muted);
  transform: rotate(45deg);
  pointer-events: none;
}
</style>
