<script setup>
import WorkbenchPanel from './WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';

defineProps({
  chapter: { type: Object, required: true },
  dirty: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  readOnlyMessage: { type: String, default: '' },
  submittedAt: { type: String, default: '' },
  reviewStatus: { type: String, default: '' },
  reviewedAt: { type: String, default: '' }
});
defineEmits(['save', 'reset']);
</script>

<template>
  <WorkbenchPanel kind="CHAPTER" :title="chapter.title || chapter.slug || '未命名章节'" :dirty="dirty" :saving="saving" :editable="editable" :can-save="dirty" :read-only-message="readOnlyMessage" :submitted-at="submittedAt" :review-status="reviewStatus" :reviewed-at="reviewedAt" @save="$emit('save')" @reset="$emit('reset')">
    <template #actions><slot name="actions" /></template>
    <div class="wb-block" :inert="!editable">
      <div class="wb-form-grid">
        <MInput v-model="chapter.title" label="章节名称" required />
        <MInput v-model="chapter.slug" label="slug" hint="课程内唯一" required />
        <MInput v-model="chapter.tag" label="标签" />
        <div class="wb-span-2"><MTextarea v-model="chapter.summary" label="摘要" :rows="2" /></div>
      </div>
    </div>
  </WorkbenchPanel>
</template>
