<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import WorkbenchPanel from './WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MSelect from '../../components/MSelect.vue';
import MTextarea from '../../components/MTextarea.vue';
import MButton from '../../components/MButton.vue';
import MLectureCover from '../../components/MLectureCover.vue';
import { notify } from '../../components/MNotice.vue';
import { lectureApi } from '../../api/lectures.js';

const props = defineProps({
  revision: { type: Object, required: true },
  lecture: { type: Object, required: true },
  categories: { type: Array, default: () => [] },
  dirty: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  readOnlyMessage: { type: String, default: '' }
});
const emit = defineEmits(['save', 'reset', 'cover-change']);
const selectedCategory = computed({
  get: () => props.revision.category_id == null ? '' : String(props.revision.category_id),
  set: (value) => { props.revision.category_id = value ? Number(value) : null; }
});
const coverInput = ref(null);
const coverLoading = ref(false);
const onlineCover = ref('');
const coverError = ref('');
let active = true;
let coverSequence = 0;
onUnmounted(() => { active = false; coverSequence++; });
const cover = computed(() => props.lecture.isLocal ? (typeof props.revision.metadata?.cover === 'string' ? props.revision.metadata.cover : '') : onlineCover.value);

async function loadCover() {
  const current = ++coverSequence;
  onlineCover.value = '';
  coverError.value = '';
  coverLoading.value = false;
  if (props.lecture.isLocal || !props.revision.id || !props.revision.has_cover) return;
  coverLoading.value = true;
  try {
    const result = await lectureApi.getCover(props.revision.id);
    if (current !== coverSequence) return;
    if (String(result.revision_id) !== String(props.revision.id) || typeof result.cover !== 'string') throw new Error('封面数据不完整');
    onlineCover.value = result.cover;
  } catch (error) { if (current === coverSequence) coverError.value = error.message || '封面加载失败'; }
  finally { if (current === coverSequence) coverLoading.value = false; }
}
watch(() => [props.lecture.isLocal, props.revision.id, props.revision.edit_version, props.revision.has_cover], loadCover, { immediate: true });

async function changeCover(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || !props.editable || coverLoading.value) return;
  const limit = props.lecture.isLocal ? 5 * 1024 * 1024 : 512 * 1024;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > limit) { notify(`请选择不超过 ${props.lecture.isLocal ? '5 MB' : '512 KB'} 的 JPG、PNG 或 WebP 图片`, 'warn'); return; }
  if (!props.lecture.isLocal && props.dirty) { notify('请先保存或放弃讲义修改，再更换封面', 'warn'); return; }
  const revision = props.revision;
  coverLoading.value = true;
  try {
    const url = URL.createObjectURL(file);
    try { const image = new Image(); image.src = url; await image.decode(); }
    finally { URL.revokeObjectURL(url); }
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });
    if (!active || revision !== props.revision || !props.editable) return;
    if (props.lecture.isLocal) revision.metadata = { ...(revision.metadata || {}), cover: data };
    else emit('cover-change', data);
  } catch (error) { if (active) notify(error.message || '读取封面失败', 'error'); }
  finally { if (active) coverLoading.value = false; }
}

function removeCover() {
  if (!props.editable || coverLoading.value) return;
  if (!props.lecture.isLocal) {
    if (props.dirty) { notify('请先保存或放弃讲义修改，再删除封面', 'warn'); return; }
    emit('cover-change', '');
    return;
  }
  const metadata = { ...(props.revision.metadata || {}) };
  delete metadata.cover;
  props.revision.metadata = metadata;
}
</script>

<template>
  <WorkbenchPanel kind="COURSE" :title="revision.title || lecture.slug" :dirty="dirty" :saving="saving" :editable="editable" :can-save="dirty" :read-only-message="readOnlyMessage" :submitted-at="revision.submitted_at || ''" :review-status="revision.status || ''" :reviewed-at="revision.reviewed_at || ''" @save="$emit('save')" @reset="$emit('reset')">
    <template #actions><slot name="actions" /></template>
    <div class="course-panel-content" :inert="!editable">
      <div class="course-layout">
        <div class="cover-field">
          <span class="cover-label">讲义封面</span>
          <div class="cover-editor">
            <div class="cover-preview" aria-hidden="true" inert><MLectureCover :title="revision.title || '讲义封面'" :image="cover" :show-caption="false" /></div>
            <div class="cover-controls">
              <input ref="coverInput" class="cover-input" type="file" accept="image/jpeg,image/png,image/webp" :disabled="!editable || saving || coverLoading" @change="changeCover" />
              <MButton size="sm" :disabled="!editable || saving || coverLoading" @click="coverInput?.click()">{{ cover ? '更换封面' : '选择封面' }}</MButton>
              <MButton v-if="cover" size="sm" variant="ghost" :disabled="!editable || saving || coverLoading" @click="removeCover">删除封面</MButton>
              <span class="cover-hint">{{ lecture.isLocal ? '支持 JPG、PNG、WebP，最大 5 MB，选择后请保存讲义' : '支持 JPG、PNG、WebP，最大 512 KB，修改后立即保存' }}</span>
              <span v-if="coverError" class="cover-error" role="alert">{{ coverError }} <button type="button" @click="loadCover">重试</button></span>
            </div>
          </div>
        </div>
        <div class="course-details wb-form-grid">
          <div class="wb-span-2"><MInput v-model="revision.title" label="课程名称" required /></div>
          <div class="wb-span-2"><MInput v-model="revision.subtitle" label="副标题" /></div>
          <MInput v-if="lecture.isLocal" v-model="lecture.slug" label="课程标识" hint="修改后讲义地址会改变" required />
          <MInput v-else :model-value="lecture.slug" label="课程标识" disabled />
          <MSelect v-model="selectedCategory" label="讲义分类" :options="[{ value: '', label: '未分类' }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]" />
          <div class="wb-span-2"><MTextarea v-model="revision.descr" label="简介" :rows="3" /></div>
          <MInput v-model="revision.typst_version" label="Typst 版本" required />
          <div class="wb-span-2"><MTextarea v-model="revision.change_note" label="修改说明" :rows="2" /></div>
        </div>
      </div>
    </div>
  </WorkbenchPanel>
</template>

<style scoped>
.course-panel-content { container-type: inline-size; }
.course-layout { display: grid; grid-template-columns: 180px minmax(0, 1fr); align-items: start; gap: clamp(24px, 4vw, 48px); }
.course-details { min-width: 0; align-content: start; }
.cover-field { display: flex; flex-direction: column; gap: 10px; }
.cover-label { color: var(--text-secondary); font-size: var(--font-size-smaller); }
.cover-editor { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.cover-preview { width: 100%; }
.cover-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cover-input { display: none; }
.cover-hint { flex-basis: 100%; color: var(--text-muted); font-size: var(--font-size-smaller); }
.cover-error { flex-basis: 100%; color: var(--tag-red); font-size: var(--font-size-smaller); }
.cover-error button { color: var(--accent-primary); }
@container (max-width: 620px) {
  .course-layout { grid-template-columns: 1fr; gap: 24px; }
  .cover-editor { flex-direction: row; align-items: flex-start; }
  .cover-preview { width: min(150px, 40%); flex: none; }
  .course-details { grid-template-columns: 1fr; }
}
</style>
