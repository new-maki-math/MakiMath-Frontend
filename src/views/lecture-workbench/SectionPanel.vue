<script setup>
import WorkbenchPanel from './WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import TypstEditorPreview from '../../components/TypstEditorPreview.vue';

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
</script>

<template>
  <WorkbenchPanel kind="SECTION" :title="section.title || section.slug || '未命名小节'" :dirty="dirty" :saving="saving" :editable="editable" :can-save="dirty" :read-only-message="readOnlyMessage" :submitted-at="submittedAt" :review-status="reviewStatus" :reviewed-at="reviewedAt" @save="emit('save')" @reset="emit('reset')">
    <template #actions><slot name="actions" /></template>
    <div class="wb-block" :inert="!editable">
      <div class="wb-form-grid">
        <MInput v-model="section.title" label="小节标题" required />
        <MInput v-model="section.slug" label="小节标识" hint="章节内唯一" required />
        <MInput v-model="section.tag" label="标签" />
        <div class="wb-span-2"><MTextarea v-model="section.summary" label="摘要" :rows="2" /></div>
      </div>
    </div>
    <div class="wb-block">
      <div class="wb-block-head"><span class="wb-block-title">小节内容</span></div>
      <TypstEditorPreview :key="section.occurrence_id" v-model="section.source" :editable="editable" knowledge-references @save="emit('save')" />
    </div>
  </WorkbenchPanel>
</template>
