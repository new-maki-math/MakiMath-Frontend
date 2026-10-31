<script setup>
import { ref, shallowRef } from 'vue';

import KnowledgeReferencePicker from '../knowledge/KnowledgeReferencePicker.vue';
import MButton from '../MButton.vue';
import { notify } from '../MNotice.vue';
import TypstDoc from '../typst-renderer/TypstDoc.vue';
import { findKnowledgeInsertion } from './knowledge-reference-editor.js';
import TypstMonacoEditor from './TypstMonacoEditor.vue';
import { usePreviewScrollSync } from './usePreviewScrollSync.js';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  editable: {
    type: Boolean,
    default: false
  },
  knowledgeReferences: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['update:modelValue', 'save']);
const editorRef = ref(null);
const previewRef = ref(null);
const referenceTarget = shallowRef(null);
function handleType({ text, model, selection }) {
  if (!props.knowledgeReferences || !['e', '('].includes(text)) {
    return;
  }
  const range = findKnowledgeInsertion(model, selection, true);
  if (range) {
    openReference({
      range,
      version: model.getVersionId(),
      model
    });
  }
}
function openReference(target) {
  if (target) {
    referenceTarget.value = target;
  } else {
    notify('请将光标移到要插入的位置', 'warn');
  }
}
function closeReference() {
  referenceTarget.value = null;
  editorRef.value?.focus();
}
function insertReference(slug) {
  if (typeof slug !== 'string' || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return;
  }
  if (!editorRef.value?.replaceRange(referenceTarget.value, `#mm-knowledge(slug: "${slug}")`)) {
    notify('编辑器内容已变化，请重新选择插入位置', 'warn');
  }
  closeReference();
}
const { scrollSyncEnabled, syncPreview, syncEditor, toggleScrollSync } = usePreviewScrollSync(
  editorRef,
  previewRef
);

function keepPanelPosition(event) {
  if (!event.target.closest('.monaco-mount')) {
    return;
  }
  const panel = event.currentTarget.closest('.panel-body');
  if (!panel) {
    return;
  }
  const top = panel.scrollTop;
  const left = panel.scrollLeft;
  requestAnimationFrame(() => {
    panel.scrollTop = top;
    panel.scrollLeft = left;
  });
}
</script>

<template>
  <div class="content-layout">
    <div
      class="content-editor"
      @pointerdown.capture="keepPanelPosition"
    >
      <TypstMonacoEditor
        ref="editorRef"
        :key="editable"
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        label="Typst 源码"
        height="max(600px, calc(100vh - 300px))"
        :readonly="!editable"
        @type="handleType"
        @save="editable && emit('save')"
        @scroll="syncPreview"
      />
    </div>
    <div class="preview-column">
      <div class="preview-heading">
        <span>预览</span
        ><MButton
          variant="secondary"
          size="sm"
          :aria-pressed="scrollSyncEnabled"
          @click="toggleScrollSync"
          >同步滚动：{{ scrollSyncEnabled ? '开' : '关' }}</MButton
        >
      </div>
      <div
        ref="previewRef"
        class="content-preview"
        @scroll="syncEditor"
      >
        <TypstDoc
          v-if="modelValue"
          :source="modelValue"
        />
        <p
          v-else
          class="preview-empty"
        >
          输入源码后显示预览
        </p>
      </div>
    </div>
  </div>
  <KnowledgeReferencePicker
    :open="Boolean(referenceTarget)"
    @close="closeReference"
    @select="insertReference"
  />
</template>

<style scoped>
.content-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}
.content-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.content-editor :deep(.code-head) {
  min-height: 28px;
}
.preview-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  padding: 0 1px;
  font-size: var(--font-size-smaller);
  font-weight: 500;
  color: var(--text-secondary);
}
.content-preview {
  flex: 1;
  min-height: 600px;
  max-height: max(600px, calc(100vh - 300px));
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
}
.preview-empty {
  margin: 0;
  color: var(--text-muted);
}
@media (max-width: 900px) {
  .content-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .content-preview {
    min-height: 240px;
    max-height: 600px;
  }
}
</style>
