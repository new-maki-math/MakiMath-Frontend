<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  hint: {
    type: String,
    default: ''
  },
  rows: {
    type: Number,
    default: 4
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
    <textarea
      class="m-textarea"
      :rows="rows"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      spellcheck="false"
      @input="$emit('update:modelValue', $event.target.value)"
    ></textarea>
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

.m-textarea {
  display: block;
  width: 100%;
  padding: 9px 11px;
  /* 框体比页面背景（bg-app）浅一级 */
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size);
  line-height: 1.7;
  resize: vertical;
  user-select: text;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.m-textarea:hover:not(:disabled) {
  border-color: var(--border-hover);
}

.m-textarea:focus {
  border-color: var(--border-focus);
  background-color: var(--bg-elevated);
}

.m-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
