<script setup>
import { Upload } from '@iconoir/vue';

defineProps({
  title: {
    type: String,
    required: true
  },
  detail: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    default: '选择文件'
  },
  accept: {
    type: String,
    default: ''
  },
  multiple: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
});
defineEmits(['choose', 'change']);
</script>

<template>
  <label
    class="file-picker"
    :class="{
      'is-disabled': disabled
    }"
  >
    <Upload
      class="file-icon"
      width="20"
      height="20"
      aria-hidden="true"
    />
    <span class="file-info">
      <span
        class="file-title"
        :title="title"
        >{{ title }}</span
      >
      <span
        v-if="detail"
        class="file-detail"
        >{{ detail }}</span
      >
    </span>
    <span class="file-action">{{ action }}</span>
    <input
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @click="$emit('choose', $event)"
      @change="$emit('change', $event)"
    />
  </label>
</template>

<style scoped>
.file-picker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  cursor: pointer;
}
.file-picker:not(.is-disabled):hover {
  background: var(--bg-hover);
}
.file-picker:not(.is-disabled):active {
  background: var(--bg-elevated);
}
.file-picker:has(input:focus-visible) {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
.file-picker.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.file-picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.file-icon {
  flex: none;
  color: var(--text-secondary);
}
.file-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.file-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
}
.file-detail {
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
}
.file-action {
  flex: none;
  color: var(--accent-primary);
  font-size: var(--font-size-smaller);
}
</style>
