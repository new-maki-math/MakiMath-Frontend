<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MLoadingMask from './MLoadingMask.vue';
import MButton from './MButton.vue';
import MTag from './MTag.vue';
import { findKnowledgeInsertion } from '../utils/knowledge-reference-editor.js';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  language: {
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
  theme: {
    type: String,
    default: 'vs-dark'
  },
  tagVariant: {
    type: String,
    default: 'muted'
  },
  showMeta: {
    type: Boolean,
    default: true
  },
  showLanguage: {
    type: Boolean,
    default: true
  },
  knowledgeReferences: { type: Boolean, default: false },
  showPreview: {
    type: Boolean,
    default: false // 按照要求暂时屏蔽实时预览
  }
});

const emit = defineEmits(['update:modelValue', 'save', 'scroll', 'knowledge-trigger']);

const editorMountRef = ref(null);
let editorInstance = null;
let monaco = null;
let disposed = false;
let initializing = false;
const editorLoading = ref(true);
const editorError = ref('');
let isSettingValue = false;

const lineCount = computed(() => Math.max(1, String(props.modelValue || '').split('\n').length));
const charCount = computed(() => String(props.modelValue || '').length);

const effectiveHeight = computed(() => {
  if (!props.height) return '360px';
  return props.height;
});

// 智能推断代码语言
const resolvedLanguage = computed(() => {
  if (props.language) return props.language;
  const text = String(props.modelValue || '').trim();
  const lbl = String(props.label || '').toLowerCase();

  if (lbl.includes('json') || text.startsWith('[') || text.startsWith('{')) {
    return 'json';
  }
  if (lbl.includes('scenes') || lbl.includes('js') || text.includes('function') || text.includes('const ') || text.includes('=>')) {
    return 'javascript';
  }
  return 'markdown';
});

async function initializeEditor() {
  if (disposed || initializing || editorInstance || !editorMountRef.value) return;
  initializing = true;
  editorLoading.value = true;
  editorError.value = '';
  try {
    const module = await import('../utils/monaco.js');
    if (disposed || !editorMountRef.value) return;
    monaco = module.monaco;
    editorInstance = monaco.editor.create(editorMountRef.value, {
      value: props.modelValue || '',
      language: resolvedLanguage.value,
      theme: props.theme || 'vs-dark',
      readOnly: props.readonly,
      tabSize: props.tabSize || 2,
      automaticLayout: true,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      lineHeight: 21,
      fontSize: 13,
      fontFamily: 'var(--font-mono, "Cascadia Code", Consolas, Menlo, Monaco, "Courier New", monospace)',
      renderLineHighlight: 'all',
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8
      },
      bracketPairColorization: { enabled: true },
      guides: {
        indentation: true,
        bracketPairs: false
      },
      fixedOverflowWidgets: true,
      wordWrap: 'off'
    });

    // 双向绑定输入监听
    editorInstance.onDidChangeModelContent(() => {
      if (isSettingValue) return;
      if (props.readonly) {
        isSettingValue = true;
        editorInstance.setValue(props.modelValue || '');
        isSettingValue = false;
        return;
      }
      const val = editorInstance.getValue();
      emit('update:modelValue', val);
    });

    editorInstance.onDidScrollChange((event) => {
      if (!event.scrollTopChanged) return;
      const position = getScrollPosition();
      if (position) emit('scroll', position);
    });

    editorInstance.onDidType((text) => {
      if (!props.knowledgeReferences || props.readonly || !['e', '('].includes(text)) return;
      const model = editorInstance.getModel();
      const range = findKnowledgeInsertion(model, editorInstance.getSelection(), true);
      if (range) emit('knowledge-trigger', { range, version: model.getVersionId(), model });
    });

    // 绑定 Ctrl / Cmd + S 保存快捷键
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      emit('save');
    });
    editorLoading.value = false;
  } catch (error) {
    editorInstance?.dispose();
    editorInstance = null;
    if (!disposed) {
      editorError.value = '编辑器加载失败，请重试';
      console.error('[编辑器] 加载失败', error);
      editorLoading.value = false;
    }
  } finally {
    initializing = false;
  }
}
onMounted(initializeEditor);

watch(
  () => props.modelValue,
  (newVal) => {
    if (!editorInstance) return;
    const current = editorInstance.getValue();
    const incoming = newVal ?? '';
    if (current !== incoming) {
      isSettingValue = true;
      editorInstance.setValue(incoming);
      isSettingValue = false;
    }
  }
);

watch(
  resolvedLanguage,
  (lang) => {
    if (!editorInstance) return;
    const model = editorInstance.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, lang);
    }
  }
);

watch(
  () => props.theme,
  (newTheme) => {
    if (newTheme && monaco) {
      monaco.editor.setTheme(newTheme);
    }
  }
);

watch(
  () => props.readonly,
  (isRo) => {
    editorInstance?.updateOptions({ readOnly: isRo });
  }
);

function getScrollPosition() {
  const model = editorInstance?.getModel();
  const range = editorInstance?.getVisibleRanges()[0];
  if (!model || !range) return null;
  const line = range.startLineNumber;
  const scrollTop = editorInstance.getScrollTop();
  const lineHeight = editorInstance.getOption(monaco.editor.EditorOption.lineHeight);
  const fraction = Math.max(0, Math.min(1, (scrollTop - editorInstance.getTopForLineNumber(line)) / lineHeight));
  const start = model.getOffsetAt({ lineNumber: line, column: 1 });
  const end = model.getOffsetAt({ lineNumber: line, column: model.getLineMaxColumn(line) });
  return { offset: start + (end - start) * fraction, scrollTop };
}

defineExpose({
  getScrollPosition,
  insertKnowledge(target, slug) {
    const editor = editorInstance;
    const model = editor?.getModel();
    if (props.readonly || !props.knowledgeReferences || !model || model !== target?.model || model.getVersionId() !== target.version || typeof slug !== 'string' || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
    const start = model.getPositionAt(target.range.start);
    const end = model.getPositionAt(target.range.end);
    editor.pushUndoStop();
    editor.executeEdits('knowledge-reference', [{ range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: `#mm-knowledge(slug: "${slug}")`, forceMoveMarkers: true }]);
    editor.pushUndoStop();
    editor.focus();
    return true;
  },
  focus() { editorInstance?.focus(); },
  scrollToOffset(offset) {
    const model = editorInstance?.getModel();
    if (!model) return null;
    const position = model.getPositionAt(Math.max(0, Math.min(model.getValueLength(), Math.floor(offset))));
    const target = editorInstance.getTopForLineNumber(position.lineNumber);
    editorInstance.setScrollTop(target, monaco.editor.ScrollType.Immediate);
    return editorInstance.getScrollTop();
  }
});

onBeforeUnmount(() => {
  disposed = true;
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }
});
</script>

<template>
  <div class="m-code">
    <div v-if="label || showMeta" class="code-head">
      <div class="code-head-left">
        <span v-if="label" class="code-label">{{ label }}</span>
        <span v-if="showMeta" class="code-meta font-mono">
          {{ lineCount }} 行 · {{ charCount }} 字符
        </span>
      </div>

      <div v-if="showLanguage" class="code-head-right">
        <MTag size="md" :variant="tagVariant">{{ resolvedLanguage }}</MTag>
      </div>
    </div>

    <div
      class="code-monaco-wrap"
      :style="{ height: effectiveHeight }"
    >
      <div ref="editorMountRef" class="monaco-mount"></div>
      <MLoadingMask :visible="editorLoading" text="正在加载编辑器…" />
      <span v-if="editorLoading" class="editor-status" role="status">正在加载编辑器…</span>
      <div v-if="editorError" class="editor-error" role="alert">
        <span>{{ editorError }}</span>
        <MButton size="sm" @click="initializeEditor">重试</MButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.m-code {
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
}

.code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  padding: 0 1px;
}

.code-head-left,
.code-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.code-label {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  font-weight: 500;
}

.code-meta {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}


.code-monaco-wrap {
  position: relative;
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm, 3px);
  overflow: hidden;
  background-color: var(--bg-surface, #202020);
  transition: border-color 140ms ease;
  min-height: 0;
}

.code-monaco-wrap:focus-within {
  border-color: var(--border-focus);
}

.editor-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.editor-error { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; background: var(--bg-surface); color: var(--text-secondary); text-align: center; }

.monaco-mount {
  width: 100%;
  height: 100%;
}
</style>
