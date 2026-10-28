<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { lectureApi } from '../../api/lectures.js';
import { authStatus, currentUser } from '../../utils/auth.js';
import { listLocalLectures, saveLocalLecture } from '../../utils/local-lectures.js';
import { notify } from '../../components/MNotice.vue';
import MModal from '../../components/MModal.vue';
import MSelect from '../../components/MSelect.vue';

const props = defineProps({ open: Boolean, knowledgeSlug: { type: String, default: '' } });
const emit = defineEmits(['close']);
const lectures = ref([]);
const lectureKey = ref('');
const chapterKey = ref('');
const sectionKey = ref('');
const selectedLecture = ref(null);
const loading = ref(false);
const loadingLecture = ref(false);
const saving = ref(false);
const loadError = ref('');
let sequence = 0;
let lectureSequence = 0;
const selectionStorageKey = 'maki_knowledge_lecture_selection';
let pendingSelection = null;

function readSelection() {
  try {
    const value = JSON.parse(localStorage.getItem(selectionStorageKey) || 'null');
    if (!value || typeof value.lectureKey !== 'string' || typeof value.chapterKey !== 'string' || typeof value.sectionKey !== 'string') return null;
    if (value.lectureKey.startsWith('online:') && (authStatus.value !== 'authenticated' || String(value.userId) !== String(currentUser.value?.id))) return null;
    return value;
  } catch { return null; }
}

function rememberSelection() {
  if (!lectureKey.value || !chapter.value || !section.value) return;
  try {
    localStorage.setItem(selectionStorageKey, JSON.stringify({ lectureKey: lectureKey.value, chapterKey: chapterKey.value, sectionKey: sectionKey.value, userId: lectureKey.value.startsWith('online:') ? currentUser.value?.id : null }));
  } catch {}
}

async function restoreSelection(selection, current) {
  if (!selection || current !== lectureSequence || !props.open) return;
  const foundChapter = chapters.value.find((item) => String(item.occurrence_id) === selection.chapterKey);
  if (!foundChapter) return;
  chapterKey.value = selection.chapterKey;
  await nextTick();
  if (current !== lectureSequence || !props.open || chapterKey.value !== selection.chapterKey) return;
  if (foundChapter.sections?.some((item) => String(item.occurrence_id) === selection.sectionKey)) sectionKey.value = selection.sectionKey;
}

const lectureOptions = computed(() => [{ value: '', label: '请选择讲义' }, ...lectures.value.map((item) => ({ value: item.key, label: `${item.source === 'local' ? '本地' : '在线草稿'} · ${item.title}` }))]);
const chapters = computed(() => selectedLecture.value?.chapters || []);
const chapter = computed(() => chapters.value.find((item) => String(item.occurrence_id) === chapterKey.value));
const section = computed(() => chapter.value?.sections?.find((item) => String(item.occurrence_id) === sectionKey.value));
const chapterOptions = computed(() => [{ value: '', label: '请选择章节' }, ...chapters.value.map((item) => ({ value: String(item.occurrence_id), label: item.title || '未命名章节' }))]);
const sectionOptions = computed(() => [{ value: '', label: '请选择小节' }, ...(chapter.value?.sections || []).map((item) => ({ value: String(item.occurrence_id), label: item.title || '未命名小节' }))]);

async function loadLectures() {
  const current = ++sequence;
  pendingSelection = readSelection();
  lectureSequence++;
  lectures.value = [];
  lectureKey.value = '';
  selectedLecture.value = null;
  loadError.value = '';
  loading.value = true;
  try {
    const local = await listLocalLectures();
    if (current !== sequence) return;
    lectures.value = local.map((item) => ({ key: `local:${item.id}`, source: 'local', id: item.id, title: item.revision?.title || '未命名讲义', record: item }));
    if (authStatus.value !== 'authenticated') return;
    const user = currentUser.value;
    const online = await lectureApi.mine();
    if (!Array.isArray(online)) throw new Error('在线讲义列表格式不正确');
    const results = await Promise.allSettled(online.filter((item) => item.publication_status !== 'archived').map(async (item) => {
      const isOwner = String(item.owner_id) === String(user?.id);
      if (!isOwner && user?.role !== 'super_admin') {
        const collaborators = await lectureApi.collaborators(item.id);
        if (!collaborators.some((entry) => String(entry.user_id) === String(user?.id) && entry.permission === 'edit')) return null;
      }
      const versions = await lectureApi.revisions(item.id);
      const draft = versions.find((entry) => entry.status === 'draft' && entry.source_draft_id == null);
      if (!draft) return null;
      return { key: `online:${item.id}`, source: 'online', id: item.id, slug: item.slug, revisionId: draft.id, title: draft.title || '未命名讲义' };
    }));
    if (current !== sequence) return;
    lectures.value.push(...results.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value));
    if (results.some((result) => result.status === 'rejected')) loadError.value = '部分在线讲义加载失败，请重试';
  } catch (error) {
    if (current === sequence) loadError.value = error.message || '讲义加载失败，请重试';
  } finally {
    if (current === sequence) {
      loading.value = false;
      if (pendingSelection && lectures.value.some((item) => item.key === pendingSelection.lectureKey)) lectureKey.value = pendingSelection.lectureKey;
      else pendingSelection = null;
    }
  }
}

watch(() => props.open, (open) => {
  if (open) loadLectures();
  else { sequence++; lectureSequence++; }
});
watch([authStatus, () => currentUser.value?.id], () => { if (props.open && !saving.value) loadLectures(); });
watch(lectureKey, async (key) => {
  const current = ++lectureSequence;
  chapterKey.value = '';
  sectionKey.value = '';
  selectedLecture.value = null;
  loadingLecture.value = false;
  const item = lectures.value.find((entry) => entry.key === key);
  if (!key) return;
  const selection = pendingSelection?.lectureKey === key ? pendingSelection : null;
  pendingSelection = null;
  if (!item) { loadingLecture.value = false; return; }
  if (item.source === 'local') { selectedLecture.value = item.record; await restoreSelection(selection, current); return; }
  loadingLecture.value = true;
  try {
    const data = await lectureApi.outline(item.slug, item.revisionId);
    if (current !== lectureSequence) return;
    if (String(data.revision?.id) !== String(item.revisionId) || data.revision?.status !== 'draft' || !Number.isInteger(data.revision?.edit_version) || !Array.isArray(data.chapters)) throw new Error('讲义草稿目录不完整');
    selectedLecture.value = data;
    await restoreSelection(selection, current);
  } catch (error) {
    if (current === lectureSequence) notify(error.message || '加载讲义目录失败', 'error');
  } finally {
    if (current === lectureSequence) loadingLecture.value = false;
  }
});
watch(chapterKey, () => { sectionKey.value = ''; });
watch(sectionKey, rememberSelection);

async function addReference() {
  if (saving.value) return;
  if (!section.value || !chapter.value || !selectedLecture.value) { notify('请选择讲义、章节和小节', 'warn'); return; }
  const item = lectures.value.find((entry) => entry.key === lectureKey.value);
  const slug = props.knowledgeSlug;
  if (!item || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { notify('知识点标识无效，无法添加引用', 'error'); return; }
  const currentChapter = chapter.value;
  const currentSection = section.value;
  const snapshot = selectedLecture.value;
  const current = sequence;
  const userId = currentUser.value?.id;
  const reference = `#mm-knowledge(slug: "${slug}")`;
  const append = (source) => `${source}${source && !source.endsWith('\n') ? '\n' : ''}${reference}\n`;
  saving.value = true;
  try {
    if (item.source === 'local') {
      if (typeof currentSection.source !== 'string') throw new Error('小节源码不可用');
      const record = JSON.parse(JSON.stringify(snapshot));
      const target = record.chapters.find((entry) => entry.occurrence_id === currentChapter.occurrence_id)?.sections.find((entry) => entry.occurrence_id === currentSection.occurrence_id);
      if (!target) throw new Error('小节不存在，请重新选择');
      target.source = append(target.source);
      if (target.source.length > 200000) throw new Error('小节内容超过长度限制');
      await saveLocalLecture(record, snapshot.editVersion);
    } else {
      const revision = snapshot.revision;
      const data = await lectureApi.section(item.slug, revision.id, currentChapter.slug, currentSection.slug, revision.edit_version);
      if (current !== sequence || !props.open) return;
      if (String(data.revision_id) !== String(revision.id) || data.edit_version !== revision.edit_version || String(data.occurrence_id) !== String(currentSection.occurrence_id) || typeof data.source !== 'string') throw new Error('小节内容与所选版本不一致，请重新选择');
      if (authStatus.value !== 'authenticated' || String(currentUser.value?.id) !== String(userId)) throw new Error('登录状态已变化，请重新选择讲义');
      const source = append(data.source);
      if (source.length > 200000) throw new Error('小节内容超过长度限制');
      await lectureApi.saveSection(revision.id, currentSection.occurrence_id, { edit_version: revision.edit_version, slug: currentSection.slug, tag: currentSection.tag || '', title: currentSection.title || '', summary: currentSection.summary || '', source });
    }
    notify('知识点引用已添加到小节末尾', 'success');
    emit('close');
  } catch (error) {
    if (error.status === 409) { lectureKey.value = ''; selectedLecture.value = null; }
    notify(error.status === 409 ? '讲义已发生变化，请重新选择后再添加' : error.message || '添加失败，请重试', 'error');
  } finally { saving.value = false; }
}
</script>

<template>
  <MModal :open="open" title="添加到我的讲义" confirm-text="添加" :busy="saving" @close="!saving && $emit('close')" @confirm="addReference">
    <div class="lecture-picker">
      <p v-if="loading" class="picker-note">正在加载讲义…</p>
      <p v-if="loadError" class="picker-error" role="alert">{{ loadError }} <button type="button" @click="loadLectures">重试</button></p>
      <MSelect v-model="lectureKey" label="讲义" :options="lectureOptions" :disabled="loading || saving" />
      <MSelect v-model="chapterKey" label="章节" :options="chapterOptions" :disabled="!selectedLecture || loadingLecture || saving" />
      <MSelect v-model="sectionKey" label="小节" :options="sectionOptions" :disabled="!chapter || saving" />
      <p v-if="loadingLecture" class="picker-note">正在加载章节…</p>
      <p v-else-if="!loading && !lectures.length" class="picker-note">暂无可编辑的讲义，请先创建本地讲义或在线草稿。</p>
    </div>
  </MModal>
</template>

<style scoped>
.lecture-picker { display: flex; flex-direction: column; gap: 16px; }
.picker-note { margin: 0; color: var(--text-secondary); font-size: var(--font-size-smaller); }
.picker-error { margin: 0; color: var(--tag-red); font-size: var(--font-size-smaller); }
.picker-error button { color: var(--accent-primary); cursor: pointer; }
</style>
