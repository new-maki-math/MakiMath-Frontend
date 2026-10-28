<script setup>
import { computed } from 'vue';
import WorkbenchPanel from './WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MSelect from '../../components/MSelect.vue';
import MTextarea from '../../components/MTextarea.vue';

const props = defineProps({
  revision: { type: Object, required: true },
  lecture: { type: Object, required: true },
  categories: { type: Array, default: () => [] },
  dirty: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  readOnlyMessage: { type: String, default: '' }
});
defineEmits(['save', 'reset']);
const selectedCategory = computed({
  get: () => props.revision.category_id == null ? '' : String(props.revision.category_id),
  set: (value) => { props.revision.category_id = value ? Number(value) : null; }
});
</script>

<template>
  <WorkbenchPanel kind="COURSE" :title="revision.title || lecture.slug" :dirty="dirty" :saving="saving" :editable="editable" :can-save="dirty" :read-only-message="readOnlyMessage" :submitted-at="revision.submitted_at || ''" :review-status="revision.status || ''" :reviewed-at="revision.reviewed_at || ''" @save="$emit('save')" @reset="$emit('reset')">
    <template #actions><slot name="actions" /></template>
    <div class="wb-block" :inert="!editable">
      <div class="wb-form-grid">
        <MInput v-model="revision.title" label="课程名称" required />
        <MInput v-if="lecture.isLocal" v-model="lecture.slug" label="课程标识" hint="修改后讲义地址会改变" required />
        <MInput v-else :model-value="lecture.slug" label="课程标识" disabled />
        <MInput v-model="revision.subtitle" label="副标题" />
        <MSelect v-model="selectedCategory" label="讲义分类" :options="[{ value: '', label: '未分类' }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]" />
        <MInput v-model="revision.typst_version" label="Typst 版本" required />
        <div class="wb-span-2"><MTextarea v-model="revision.descr" label="简介" :rows="3" /></div>
        <div class="wb-span-2"><MTextarea v-model="revision.change_note" label="修改说明" :rows="2" /></div>
      </div>
    </div>
  </WorkbenchPanel>
</template>
