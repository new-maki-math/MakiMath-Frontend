<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

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

const editorMountRef = ref(null);
const fallbackTaRef = ref(null);

const loadFailed = ref(false);
const isCompiling = ref(false);
const pages = ref([]);
const diagnostics = ref([]);

let editorInstance = null;
let isSettingValue = false;

const lineCount = computed(() => Math.max(1, String(props.modelValue || '').split('\n').length));
const charCount = computed(() => String(props.modelValue || '').length);

// 仅保留致命编译错误，剔除所有非致命警告
const errorDiagnostics = computed(() => diagnostics.value.filter((d) => d.severity === 'error'));

const effectiveHeight = computed(() => {
  if (!props.height) return '480px';
  return props.height;
});

function buildEntrySource(label) {
  const hasTitle = Boolean(label && label.trim());
  const safeTitle = hasTitle ? label.trim().replace(/[\\#$*_`@<>~\[\]=+\-\/"']/g, (c) => '\\' + c) : '';
  return `#set text(font: (
  "Noto Serif SC",
  "Noto Sans SC",
  "SimSun",
  "Songti SC",
  "Microsoft YaHei",
  "SimHei",
  "Heiti SC",
  "KaiTi",
  "Kaiti SC",
  "FangSong",
  "DengXian",
  "LiSu",
  "YouYuan",
  "STKaiti"
), size: 10.5pt, lang: "zh")
#set page(paper: "a4", margin: (x: 1.6cm, top: 1.4cm, bottom: 1.4cm))
#set par(justify: true, leading: 0.85em)

#show heading.where(level: 1): it => block(spacing: 1.2em)[
  #text(size: 15pt, weight: "bold", fill: rgb("#172033"))[#it.body]
  #v(0.3em)
  #line(length: 100%, stroke: 0.5pt + rgb("#D6DCE5"))
]
#show heading.where(level: 2): it => block(spacing: 0.9em)[
  #text(size: 12.5pt, weight: "bold", fill: rgb("#2350C6"))[#it.body]
]
#show heading.where(level: 3): it => block(spacing: 0.8em)[
  #text(size: 11pt, weight: "bold", fill: rgb("#444444"))[#it.body]
]

${hasTitle ? `#heading(level: 1)[${safeTitle}]\n#set heading(offset: 1)\n#include "/content.typ"\n` : '#include "/content.typ"\n'}
`;
}

const onKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    e.stopPropagation();
    emit('save');
  }
};

const onFallbackInput = (e) => {
  emit('update:modelValue', e.target.value);
};

onMounted(async () => {
  try {
    const loadModule = new Function("return import('/typst/typst-editor.js')");
    const mod = await loadModule();
    if (!editorMountRef.value) return;

    isCompiling.value = true;
    editorInstance = await mod.createTypstEditor(editorMountRef.value, {
      initialDoc: props.modelValue || '',
      title: props.label || '',
      onChange: (val) => {
        if (isSettingValue) return;
        emit('update:modelValue', val);
      },
      onCompile: (res) => {
        isCompiling.value = false;
        // 彻底过滤 warning，仅保留阻塞编译的 error
        diagnostics.value = (res.diagnostics || []).filter((d) => d.severity === 'error');
        pages.value = res.pages || [];
      }
    });

    if (editorInstance && editorInstance.project) {
      await editorInstance.project.setText('/main.typ', buildEntrySource(props.label));
      await editorInstance.project.compile();
    }

    if (props.readonly && editorInstance.view && editorInstance.view.contentDOM) {
      editorInstance.view.contentDOM.setAttribute('contenteditable', 'false');
    }

    editorMountRef.value.addEventListener('keydown', onKeydown, true);
  } catch (err) {
    console.error('[typst-web init error]', err);
    loadFailed.value = true;
  }
});

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
  () => props.label,
  async (newLabel) => {
    if (!editorInstance || !editorInstance.project) return;
    try {
      await editorInstance.project.setText('/main.typ', buildEntrySource(newLabel));
      await editorInstance.project.compile();
    } catch (e) {}
  }
);

watch(
  () => props.readonly,
  (isRo) => {
    if (editorInstance && editorInstance.view && editorInstance.view.contentDOM) {
      editorInstance.view.contentDOM.setAttribute('contenteditable', isRo ? 'false' : 'true');
    }
  }
);

onBeforeUnmount(() => {
  if (editorMountRef.value) {
    editorMountRef.value.removeEventListener('keydown', onKeydown, true);
  }
  if (editorInstance) {
    try {
      editorInstance.destroy();
    } catch (e) {}
    editorInstance = null;
  }
});
</script>

<template>
  <div class="m-code" @keydown="onKeydown">
    <div v-if="label || showMeta || isCompiling || errorDiagnostics.length || pages.length" class="code-head">
      <div class="code-head-left">
        <span v-if="label" class="code-label">{{ label }}</span>
        <span v-if="showMeta" class="code-meta font-mono">
          {{ lineCount }} 行 · {{ charCount }} 字符
        </span>
      </div>

      <div class="code-head-right font-mono">
        <span v-if="errorDiagnostics.length > 0" class="code-badge error">
          {{ errorDiagnostics.length }} 处错误
        </span>
        <span v-else-if="pages.length > 0" class="code-badge pages">
          共 {{ pages.length }} 页
        </span>
        <span v-else-if="isCompiling" class="code-badge compiling">
          编译中...
        </span>
      </div>
    </div>

    <div class="code-split-wrap" :style="{ height: effectiveHeight }">
      <!-- Left: Editor Pane -->
      <div class="editor-pane" :class="{ 'is-readonly': readonly }">
        <div v-show="!loadFailed" ref="editorMountRef" class="editor-mount"></div>

        <textarea
          v-if="loadFailed"
          ref="fallbackTaRef"
          class="fallback-area"
          :value="modelValue"
          :placeholder="placeholder"
          :readonly="readonly"
          spellcheck="false"
          wrap="off"
          @input="onFallbackInput"
        ></textarea>

        <div v-if="errorDiagnostics.length > 0" class="diag-container font-mono">
          <div
            v-for="(diag, idx) in errorDiagnostics"
            :key="idx"
            class="diag-item error"
          >
            <span class="diag-icon">✕</span>
            <span class="diag-msg">{{ diag.message }}</span>
          </div>
        </div>
      </div>

      <!-- Right: SVG Preview Pane -->
      <div class="preview-pane">
        <div v-if="pages.length > 0" class="preview-pages">
          <div
            v-for="(page, pIdx) in pages"
            :key="pIdx"
            class="typst-page"
            v-html="page.svg"
          ></div>
        </div>
        <div v-else-if="isCompiling" class="preview-empty font-mono">
          编译中...
        </div>
        <div v-else class="preview-empty font-mono">
          暂无预览
        </div>
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
  gap: 12px;
  margin-bottom: 6px;
  padding: 0 2px;
}

.code-head-left,
.code-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
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

.code-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  line-height: 1.3;
}

.code-badge.error {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.code-badge.pages {
  background: rgba(59, 130, 246, 0.1);
  color: var(--blue, #2563eb);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.code-badge.compiling {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-muted);
}

.code-split-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1px;
  background-color: var(--border-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
  min-height: 400px;
  transition: border-color 140ms ease;
}

.code-split-wrap:focus-within {
  border-color: var(--border-focus);
}

/* Left Editor Pane */
.editor-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background-color: var(--bg-surface);
  overflow: hidden;
  position: relative;
}

.editor-pane.is-readonly {
  pointer-events: none;
  opacity: 0.85;
}

.editor-mount {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.editor-mount :deep(.cm-editor) {
  height: 100% !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  background-color: transparent !important;
}

.editor-mount :deep(.cm-scroller) {
  flex: 1 1 0% !important;
  min-height: 0 !important;
  height: 100% !important;
  overflow: auto !important;
  font-family: var(--font-mono) !important;
  font-size: var(--font-size, 13.5px) !important;
  line-height: 1.6 !important;
}

.editor-mount :deep(.cm-gutters) {
  background-color: var(--bg-topbar) !important;
  border-right: 1px solid var(--border-subtle) !important;
  color: var(--text-muted) !important;
}

.editor-mount :deep(.cm-content) {
  min-height: 100% !important;
  padding: 10px 12px !important;
}

/* 完全屏蔽所有黄色警告装饰 */
.editor-mount :deep(.cm-lintRange-warning),
.editor-mount :deep(.cm-lint-marker-warning),
.editor-mount :deep(.cm-diagnostic-warning) {
  display: none !important;
  background: none !important;
  border: none !important;
}

/* Diagnostics Error Container */
.diag-container {
  max-height: 110px;
  overflow-y: auto;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  font-size: 12px;
  display: flex;
  flex-direction: column;
}

.diag-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 5px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  line-height: 1.4;
}

.diag-item.error {
  background-color: rgba(239, 68, 68, 0.08);
  color: #dc2626;
}

.diag-icon {
  font-weight: bold;
  flex-shrink: 0;
}

.diag-msg {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

/* Right Preview Pane */
.preview-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background-color: var(--bg-topbar);
  overflow-y: auto;
  overflow-x: hidden;
}

.preview-pages {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  align-items: center;
}

.typst-page {
  background: #ffffff;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  padding: 12px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: hidden;
}

.typst-page :deep(svg) {
  max-width: 100% !important;
  height: auto !important;
  display: block !important;
  margin: 0 auto !important;
}

.preview-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}

.fallback-area {
  flex: 1;
  width: 100%;
  height: 100%;
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
}

@media (max-width: 860px) {
  .code-split-wrap {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(260px, 1fr) minmax(260px, 1fr);
  }
}
</style>
