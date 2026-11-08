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
  },
  readonly: {
    type: Boolean,
    default: false
  }
});

defineEmits(['update:modelValue']);
</script>

<template>
  <label class="m-field">
    <span
      v-if="label"
      class="field-label"
      >{{ label }}</span
    >
    <textarea
      class="m-textarea"
      :rows="rows"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      spellcheck="false"
      @input="$emit('update:modelValue', $event.target.value)"
    ></textarea>
    <span
      v-if="hint"
      class="field-hint"
      >{{ hint }}</span
    >
  </label>
</template>

<style scoped src="./field.css"></style>

<style scoped>
.m-textarea {
  display: block;
  width: 100%;
  padding: 9px 11px;
  /* 多行文本框基础样式 */
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size);
  line-height: 1.7;
  resize: vertical;
  user-select: text;
  transition:
    border-color 140ms ease,
    background-color 140ms ease;
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
