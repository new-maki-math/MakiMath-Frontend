<script setup>
import { computed, nextTick, ref } from 'vue';

const props = defineProps({
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
  readonly: {
    type: Boolean,
    default: false
  },
  height: {
    type: String,
    default: '360px'
  },
  tabSize: {
    type: Number,
    default: 2
  },
  showMeta: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:modelValue', 'save']);

const taRef = ref(null);
const gutterRef = ref(null);

const lineCount = computed(() => Math.max(1, String(props.modelValue).split('\n').length));

// 行号列跟随文本域纵向滚动
const syncScroll = () => {
  if (gutterRef.value && taRef.value) {
    gutterRef.value.scrollTop = taRef.value.scrollTop;
  }
};

const insertAtCursor = (text) => {
  const ta = taRef.value;
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  emit('update:modelValue', String(props.modelValue).slice(0, start) + text + String(props.modelValue).slice(end));
  nextTick(() => {
    ta.selectionStart = start + text.length;
    ta.selectionEnd = start + text.length;
  });
};

const onKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    emit('save');
    return;
  }
  if (e.key === 'Tab' && !props.readonly) {
    e.preventDefault();
    insertAtCursor(' '.repeat(props.tabSize));
  }
};
</script>

<template>
  <div class="m-code">
    <div v-if="label || showMeta" class="code-head">
      <span v-if="label" class="code-label">{{ label }}</span>
      <span v-if="showMeta" class="code-meta font-mono">
        {{ lineCount }} 行 / {{ String(modelValue).length }} 字符
      </span>
    </div>

    <div class="code-wrap" :style="{ height }">
      <div ref="gutterRef" class="code-gutter" aria-hidden="true">
        <div v-for="n in lineCount" :key="n" class="gutter-line">{{ n }}</div>
      </div>
      <textarea
        ref="taRef"
        class="code-area"
        :value="modelValue"
        :placeholder="placeholder"
        :readonly="readonly"
        spellcheck="false"
        wrap="off"
        @input="$emit('update:modelValue', $event.target.value)"
        @scroll="syncScroll"
        @keydown="onKeydown"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.m-code {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.code-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.code-label {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.code-meta {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  flex-shrink: 0;
}

.code-wrap {
  display: flex;
  min-height: 0;
  /* 编辑器容器 */
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
  transition: border-color 140ms ease;
}

.code-wrap:focus-within {
  border-color: var(--border-focus);
}

/* 行号侧栏 */
.code-gutter {
  flex-shrink: 0;
  min-width: 52px;
  padding: 10px 10px 10px 0;
  overflow: hidden;
  text-align: right;
  background-color: var(--bg-topbar);
  border-right: 1px solid var(--border-subtle);
  user-select: none;
}

.gutter-line {
  height: 22px;
  line-height: 22px;
  font-family: var(--font-mono);
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  opacity: 0.7;
}

.code-area {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  background-color: transparent;
  border: none;
  outline: none;
  resize: none;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size);
  line-height: 22px;
  white-space: pre;
  overflow: auto;
  tab-size: 2;
  user-select: text;
}

.code-area::placeholder {
  color: var(--text-muted);
}
</style>
