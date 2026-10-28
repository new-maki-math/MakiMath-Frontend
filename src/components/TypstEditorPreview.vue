<script setup>
import { onBeforeUnmount, ref, shallowRef } from 'vue';
import MCodeEditor from './MCodeEditor.vue';
import MButton from './MButton.vue';
import TypstDoc from './Renderer/TypstDoc.vue';
import KnowledgeReferencePicker from './KnowledgeReferencePicker.vue';
import { notify } from './MNotice.vue';

defineProps({
  modelValue: { type: String, default: '' },
  editable: { type: Boolean, default: false },
  knowledgeReferences: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'save']);
const editorRef = ref(null);
const previewRef = ref(null);
const referenceTarget = shallowRef(null);
function openReference(target) {
  if (target) referenceTarget.value = target;
  else notify('请将光标移到要插入的位置', 'warn');
}
function closeReference() {
  referenceTarget.value = null;
  editorRef.value?.focus();
}
function insertReference(slug) {
  if (!editorRef.value?.insertKnowledge(referenceTarget.value, slug)) notify('编辑器内容已变化，请重新选择插入位置', 'warn');
  closeReference();
}
const scrollSyncEnabled = ref(false);
let previewScrollTarget = null;
let editorScrollTarget = null;
let updatingEditor = false;
let scrollFrame = 0;

function previewAnchors() {
  const preview = previewRef.value;
  if (!preview) return [];
  const containerTop = preview.getBoundingClientRect().top;
  return Array.from(preview.querySelectorAll('.typst-source-anchor')).map((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    return { start: Number(element.dataset.sourceStart), end: Number(element.dataset.sourceEnd), top: rect.top - containerTop + preview.scrollTop, height: rect.height };
  }).filter((anchor) => Number.isFinite(anchor.start) && Number.isFinite(anchor.end) && anchor.height > 0);
}

function syncPreview({ offset, scrollTop }) {
  if (!scrollSyncEnabled.value || updatingEditor) return;
  if (editorScrollTarget !== null && Math.abs(scrollTop - editorScrollTarget) < 2) {
    editorScrollTarget = null;
    return;
  }
  editorScrollTarget = null;
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const preview = previewRef.value;
    if (!preview) return;
    const anchors = previewAnchors();
    const anchor = anchors.find((item) => offset >= item.start && offset < item.end) || anchors.find((item) => item.start >= offset) || anchors.at(-1);
    if (!anchor) return;
    const fraction = Math.max(0, Math.min(1, (offset - anchor.start) / Math.max(1, anchor.end - anchor.start)));
    const target = Math.max(0, Math.min(preview.scrollHeight - preview.clientHeight, anchor.top + anchor.height * fraction));
    if (Math.abs(preview.scrollTop - target) < 1) return;
    previewScrollTarget = target;
    preview.scrollTop = target;
  });
}

function syncEditor() {
  if (!scrollSyncEnabled.value) return;
  const preview = previewRef.value;
  if (!preview) return;
  if (previewScrollTarget !== null && Math.abs(preview.scrollTop - previewScrollTarget) < 2) {
    previewScrollTarget = null;
    return;
  }
  previewScrollTarget = null;
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const anchors = previewAnchors();
    const position = preview.scrollTop;
    const anchor = anchors.find((item) => position >= item.top && position < item.top + item.height) || anchors.find((item) => item.top >= position) || anchors.at(-1);
    if (!anchor) return;
    const fraction = Math.max(0, Math.min(1, (position - anchor.top) / anchor.height));
    updatingEditor = true;
    try {
      editorScrollTarget = editorRef.value?.scrollToOffset(anchor.start + (anchor.end - anchor.start) * fraction) ?? null;
    } finally {
      updatingEditor = false;
    }
  });
}

function toggleScrollSync() {
  scrollSyncEnabled.value = !scrollSyncEnabled.value;
  cancelAnimationFrame(scrollFrame);
  previewScrollTarget = null;
  editorScrollTarget = null;
  if (scrollSyncEnabled.value) {
    const position = editorRef.value?.getScrollPosition();
    if (position) syncPreview(position);
  }
}

onBeforeUnmount(() => cancelAnimationFrame(scrollFrame));

function keepPanelPosition(event) {
  if (!event.target.closest('.monaco-mount')) return;
  const panel = event.currentTarget.closest('.panel-body');
  if (!panel) return;
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
    <div class="content-editor" @pointerdown.capture="keepPanelPosition">
      <MCodeEditor ref="editorRef" :key="editable" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" label="Typst 源码" height="max(600px, calc(100vh - 300px))" :show-language="false" :readonly="!editable" :knowledge-references="knowledgeReferences" @knowledge-trigger="openReference" @save="editable && emit('save')" @scroll="syncPreview" />
    </div>
    <div class="preview-column">
      <div class="preview-heading"><span>预览</span><MButton variant="secondary" size="sm" :aria-pressed="scrollSyncEnabled" @click="toggleScrollSync">同步滚动：{{ scrollSyncEnabled ? '开' : '关' }}</MButton></div>
      <div ref="previewRef" class="content-preview" @scroll="syncEditor">
        <TypstDoc v-if="modelValue" :source="modelValue" />
        <p v-else class="preview-empty">输入源码后显示预览</p>
      </div>
    </div>
  </div>
  <KnowledgeReferencePicker :open="Boolean(referenceTarget)" @close="closeReference" @select="insertReference" />
</template>

<style scoped>
.content-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
.content-editor { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.content-editor :deep(.code-head) { min-height: 28px; }
.preview-column { display: flex; flex-direction: column; min-width: 0; }
.preview-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; padding: 0 1px; font-size: var(--font-size-smaller); font-weight: 500; color: var(--text-secondary); }
.content-preview { flex: 1; min-height: 600px; max-height: max(600px, calc(100vh - 300px)); overflow: auto; padding: 16px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); }
.preview-empty { margin: 0; color: var(--text-muted); }
@media (max-width: 900px) {
  .content-layout { grid-template-columns: minmax(0, 1fr); }
  .content-preview { min-height: 240px; max-height: 600px; }
}
</style>
