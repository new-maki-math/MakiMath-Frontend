<script setup>
import WorkbenchPanel from './WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import MCodeEditor from '../../components/MCodeEditor.vue';

defineProps({
  section: { type: Object, required: true },
  dirty: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  readOnlyMessage: { type: String, default: '' },
  submittedAt: { type: String, default: '' },
  reviewStatus: { type: String, default: '' },
  reviewedAt: { type: String, default: '' }
});
const emit = defineEmits(['save', 'reset']);

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
  <WorkbenchPanel kind="SECTION" :title="section.title || section.slug || '未命名小节'" :dirty="dirty" :saving="saving" :editable="editable" :can-save="dirty" :read-only-message="readOnlyMessage" :submitted-at="submittedAt" :review-status="reviewStatus" :reviewed-at="reviewedAt" @save="emit('save')" @reset="emit('reset')">
    <template #actions><slot name="actions" /></template>
    <div class="wb-block" :inert="!editable">
      <div class="wb-form-grid">
        <MInput v-model="section.title" label="小节标题" required />
        <MInput v-model="section.slug" label="slug" hint="章节内唯一" required />
        <MInput v-model="section.tag" label="标签" />
        <div class="wb-span-2"><MTextarea v-model="section.summary" label="摘要" :rows="2" /></div>
      </div>
    </div>
    <div class="wb-block">
      <div class="wb-block-head"><span class="wb-block-title">小节内容</span></div>
      <div class="content-layout">
        <div class="content-editor" @pointerdown.capture="keepPanelPosition">
          <MCodeEditor :key="editable" v-model="section.source" label="Typst 源码" height="max(600px, calc(100vh - 300px))" :show-language="false" :readonly="!editable" @save="editable && emit('save')" />
        </div>
        <div class="preview-column">
          <div class="preview-heading">预览</div>
          <div class="content-preview font-mono">COOMING SOON</div>
        </div>
      </div>
    </div>
  </WorkbenchPanel>
</template>

<style scoped>
.content-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
.content-editor { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.preview-column { display: flex; flex-direction: column; min-width: 0; }
.preview-heading { margin-bottom: 4px; padding: 0 1px; font-size: var(--font-size-smaller); font-weight: 500; color: var(--text-secondary); }
.content-preview { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 600px; padding: 16px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--text-muted); text-align: center; }
@media (max-width: 900px) {
  .content-layout { grid-template-columns: minmax(0, 1fr); }
  .content-preview { min-height: 240px; }
}
</style>
