<script setup>
import { ref } from 'vue';

const inputRef = ref(null);
defineExpose({
  focus: () => inputRef.value?.focus()
});

defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  ariaLabel: {
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
  type: {
    type: String,
    default: 'text'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  required: {
    type: Boolean,
    default: false
  }
});

defineEmits(['update:modelValue', 'enter']);
</script>

<template>
  <label class="m-field">
    <span
      v-if="label"
      class="field-label"
      ><span
        v-if="required"
        class="required-mark"
        aria-hidden="true"
        >*</span
      >{{ label }}</span
    >
    <input
      ref="inputRef"
      class="m-input"
      :aria-label="ariaLabel || undefined"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      spellcheck="false"
      autocomplete="off"
      @input="$emit('update:modelValue', $event.target.value)"
      @keydown.enter="$emit('enter', $event)"
    />
    <span
      v-if="hint"
      class="field-hint"
      >{{ hint }}</span
    >
  </label>
</template>

<style scoped src="./field.css"></style>

<style scoped>
.required-mark {
  margin-right: 4px;
  color: var(--tag-red);
}

.m-input {
  width: 100%;
  height: 36px;
  padding: 0 11px;
  /* 输入框基础样式 */
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size);
  user-select: text;
  transition:
    border-color 140ms ease,
    background-color 140ms ease;
}

.m-input:hover:not(:disabled) {
  border-color: var(--border-hover);
}

.m-input:focus {
  border-color: var(--border-focus);
  background-color: var(--bg-elevated);
}

.m-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.m-input::placeholder {
  color: var(--text-muted);
}
</style>
