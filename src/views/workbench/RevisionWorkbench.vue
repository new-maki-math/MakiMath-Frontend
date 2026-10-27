<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { authStatus, currentUser, isLoggedIn, isSuperAdmin, initAuth } from '../../utils/auth.js';
import { workbenchPanelState } from '../../utils/workbench-state.js';
import { knowledgeApi } from '../../api/knowledge.js';
import { lectureApi, lectureSaveBody } from '../../api/lectures.js';
import { managementApi } from '../../api/management.js';
import { notify } from '../../components/MNotice.vue';
import WorkbenchAuth from './WorkbenchAuth.vue';
import LectureAccessPanel from './LectureAccessPanel.vue';
import MButton from '../../components/MButton.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import MSelect from '../../components/MSelect.vue';
import MModal from '../../components/MModal.vue';

const items = ref([]);
const selectedId = ref('');
const selectedLecture = ref(null);
const revisions = ref([]);
const selectedRevisionId = ref('');
const revision = ref(null);
const chapters = ref([]);
const collaborators = ref([]);
const points = ref([]);
const categories = ref([]);
const newPointId = ref('');
const baseline = ref('');
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const createOpen = ref(false);
const createForm = ref({ slug: '', title: '' });
const leaveOpen = ref(false);
const conflict = ref(null);
const conflictLoading = ref(false);
let resolveLeave = null;
let loadId = 0;

const snapshot = () => JSON.stringify({ revision: revision.value, chapters: chapters.value });
const dirty = computed(() => Boolean(revision.value && baseline.value && snapshot() !== baseline.value));
const canEdit = computed(() => {
  if (!revision.value || revision.value.status !== 'draft') return false;
  return hasEditPermission.value;
});
const hasEditPermission = computed(() => {
  if (!revision.value) return false;
  return isSuperAdmin.value || selectedLecture.value?.owner_id === currentUser.value?.id || collaborators.value.some((item) => item.user_id === currentUser.value?.id && item.permission === 'edit');
});
const canManageLecture = computed(() => isSuperAdmin.value || selectedLecture.value?.owner_id === currentUser.value?.id);
const selectedCategory = computed({
  get: () => revision.value?.category_id == null ? '' : String(revision.value.category_id),
  set: (value) => { revision.value.category_id = value ? Number(value) : null; }
});

watch([dirty, saving], ([changed, busy]) => {
  workbenchPanelState.value = { dirty: changed, saving: busy };
}, { immediate: true, flush: 'sync' });

const finishLeave = (confirmed) => {
  leaveOpen.value = false;
  const resolve = resolveLeave;
  resolveLeave = null;
  resolve?.(confirmed);
};

const confirmLeave = () => {
  if (saving.value) return Promise.resolve(false);
  if (!dirty.value) return Promise.resolve(true);
  if (resolveLeave) return Promise.resolve(false);
  leaveOpen.value = true;
  return new Promise((resolve) => { resolveLeave = resolve; });
};

onBeforeRouteLeave(() => confirmLeave());
const beforeUnload = (event) => {
  if (!dirty.value && !saving.value) return;
  event.preventDefault();
  event.returnValue = '';
};
onMounted(() => {
  initAuth();
  window.addEventListener('beforeunload', beforeUnload);
});
onUnmounted(() => {
  loadId++;
  finishLeave(false);
  window.removeEventListener('beforeunload', beforeUnload);
  workbenchPanelState.value = { dirty: false, saving: false };
});

const loadItems = async () => {
  const id = ++loadId;
  loading.value = true;
  error.value = '';
  try {
    const result = await lectureApi.mine();
    if (id === loadId) items.value = result;
  } catch (err) {
    if (id === loadId) error.value = err.message || '加载列表失败';
  } finally {
    if (id === loadId) loading.value = false;
  }
};

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) loadItems();
}, { immediate: true });

const loadRevision = async (id) => {
  const current = ++loadId;
  loading.value = true;
  error.value = '';
  try {
    const data = await lectureApi.getRevision(id);
    if (current !== loadId) return;
    revision.value = data.revision;
    chapters.value = data.chapters;
    selectedRevisionId.value = String(id);
    baseline.value = snapshot();
  } catch (err) {
    if (current === loadId) error.value = err.message || '加载版本失败';
  } finally {
    if (current === loadId) loading.value = false;
  }
};

const selectItem = async (item) => {
  if (!await confirmLeave()) return;
  selectedId.value = String(item.id);
  revision.value = null;
  chapters.value = [];
  baseline.value = '';
  const current = ++loadId;
  loading.value = true;
  error.value = '';
  try {
    const [versions, editors, knowledge, categoryList] = await Promise.all([
      lectureApi.revisions(item.id),
      lectureApi.collaborators(item.id),
      knowledgeApi.list(),
      managementApi.categories('lecture')
    ]);
    if (current !== loadId) return;
    selectedLecture.value = item;
    revisions.value = versions;
    collaborators.value = editors;
    points.value = knowledge;
    categories.value = categoryList;
    if (versions.length) await loadRevision(versions[0].id);
  } catch (err) {
    if (current === loadId) error.value = err.message || '加载讲义失败';
  } finally {
    if (current === loadId) loading.value = false;
  }
};

const changeRevision = async (event) => {
  const id = event.target.value;
  if (!await confirmLeave()) {
    event.target.value = selectedRevisionId.value;
    return;
  }
  await loadRevision(id);
};

const create = async () => {
  if (saving.value || !createForm.value.slug.trim() || !createForm.value.title.trim()) return;
  saving.value = true;
  try {
    const body = { slug: createForm.value.slug.trim(), title: createForm.value.title.trim() };
    const result = await lectureApi.create(body);
    createOpen.value = false;
    await loadItems();
    const item = items.value.find((entry) => entry.id === result.lecture.id);
    saving.value = false;
    if (item) await selectItem(item);
    notify('草稿已创建', 'success');
  } catch (err) {
    notify(err.message || '创建失败', 'error');
  } finally {
    saving.value = false;
  }
};

const save = async () => {
  if (!canEdit.value || saving.value) return;
  saving.value = true;
  const submitted = snapshot();
  try {
    const result = await lectureApi.saveRevision(revision.value.id, lectureSaveBody(revision.value, chapters.value));
    const savedRevision = result.revision;
    const savedChapters = result.chapters;
    if (snapshot() === submitted) {
      revision.value = savedRevision;
      chapters.value = savedChapters;
      baseline.value = snapshot();
    } else {
      const saved = JSON.parse(submitted);
      saved.revision.edit_version = savedRevision.edit_version;
      revision.value.edit_version = savedRevision.edit_version;
      baseline.value = JSON.stringify(saved);
    }
    notify('草稿已保存', 'success');
  } catch (err) {
    if (err.status === 409) {
      notify(`${err.message || '保存发生冲突'}，当前修改已保留`, 'warn');
      await inspectConflict();
    } else {
      notify(err.message || '保存失败', 'error');
    }
  } finally {
    saving.value = false;
  }
};

const describeContent = (value, tree) => {
  return [value.title, value.subtitle, value.descr, ...tree.flatMap((chapter) => [
    chapter.title,
    ...chapter.sections.flatMap((section) => [section.title, ...section.blocks.map((block) =>
      block.block_type === 'author' ? block.source : `公共知识点 ${block.knowledge_title || block.knowledge_point_id} 版本 ${block.knowledge_revision_id}`
    )])
  ])].filter(Boolean).join('\n\n');
};

const inspectConflict = async () => {
  if (!revision.value || conflictLoading.value) return;
  conflictLoading.value = true;
  try {
    const latest = await lectureApi.getRevision(revision.value.id);
    const latestRevision = latest.revision;
    const latestChapters = latest.chapters;
    conflict.value = {
      revision: latestRevision,
      chapters: latestChapters,
      local: describeContent(revision.value, chapters.value),
      remote: describeContent(latestRevision, latestChapters)
    };
  } catch (err) {
    notify(err.message || '读取最新版本失败，当前修改已保留', 'error');
  } finally {
    conflictLoading.value = false;
  }
};

const useLatest = () => {
  if (!conflict.value) return;
  revision.value = conflict.value.revision;
  chapters.value = conflict.value.chapters;
  baseline.value = snapshot();
  conflict.value = null;
};

const submit = async () => {
  if (!canEdit.value || saving.value || dirty.value) return;
  saving.value = true;
  try {
    revision.value = await lectureApi.submitRevision(revision.value.id, revision.value.edit_version);
    baseline.value = snapshot();
    notify('已提交审核', 'success');
  } catch (err) {
    notify(err.status === 409 ? '版本状态已变化，请重新读取并核对' : err.message || '提交失败', 'error');
  } finally {
    saving.value = false;
  }
};

const copyRevision = async () => {
  if (!revision.value || !hasEditPermission.value || revision.value.status === 'draft' || saving.value) return;
  saving.value = true;
  try {
    const result = await lectureApi.createRevision(selectedLecture.value.id, revision.value.id);
    const newId = result.revision.id;
    await loadItems();
    revisions.value = await lectureApi.revisions(selectedLecture.value.id);
    await loadRevision(newId);
    notify('已创建新草稿', 'success');
  } catch (err) {
    notify(err.message || '创建新草稿失败', 'error');
  } finally {
    saving.value = false;
  }
};

const addChapter = () => chapters.value.push({ occurrence_id: crypto.randomUUID(), slug: '', tag: '', title: '', summary: '', sections: [] });
const addSection = (chapter) => chapter.sections.push({ occurrence_id: crypto.randomUUID(), slug: '', tag: '', title: '', summary: '', blocks: [] });
const addAuthor = (section) => section.blocks.push({ occurrence_id: crypto.randomUUID(), block_type: 'author', source: '', animation: null });
const addReference = (section) => {
  const point = points.value.find((item) => String(item.id) === String(newPointId.value));
  if (!point) return;
  section.blocks.push({ occurrence_id: crypto.randomUUID(), block_type: 'knowledge_reference', knowledge_point_id: point.id, knowledge_revision_id: point.revision_id, knowledge_title: point.title });
};

const discard = () => {
  if (!baseline.value) return;
  const saved = JSON.parse(baseline.value);
  revision.value = saved.revision;
  chapters.value = saved.chapters;
};

const move = (list, index, offset) => {
  const target = index + offset;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
};
</script>

<template>
  <div v-if="authStatus === 'initializing'">正在验证登录状态</div>
  <div v-else-if="authStatus === 'error'">登录状态验证失败 <MButton @click="initAuth">重试</MButton></div>
  <WorkbenchAuth v-else-if="!isLoggedIn" />
  <div v-else class="revision-workbench">
    <aside class="revision-sidebar">
      <MButton variant="primary" size="sm" @click="createForm = { slug: '', title: '' }; createOpen = true">新建</MButton>
      <p v-if="loading">加载中</p>
      <p v-if="error">{{ error }}</p>
      <button v-for="item in items" :key="item.id" class="revision-item" :class="{ active: selectedId === String(item.id) }" @click="selectItem(item)">
        {{ item.title || item.slug }} <span>{{ item.status || item.publication_status }}</span>
      </button>
    </aside>
    <main class="revision-main">
      <template v-if="revision">
        <header class="revision-header">
          <div><h2>{{ revision.title }}</h2><p>版本 {{ revision.revision_no }} · {{ revision.status }}</p></div>
          <div class="revision-actions">
            <MButton v-if="revision.status !== 'draft' && hasEditPermission" :disabled="saving" @click="copyRevision">创建新草稿</MButton>
            <MButton v-if="canEdit && dirty" :disabled="saving" @click="discard">放弃修改</MButton>
            <MButton v-if="canEdit" :disabled="saving || !dirty" @click="save">保存</MButton>
            <MButton v-if="canEdit" variant="primary" :disabled="saving || dirty" @click="submit">提交审核</MButton>
          </div>
        </header>
        <label>版本 <select :value="selectedRevisionId" :disabled="saving" @change="changeRevision"><option v-for="item in revisions" :key="item.id" :value="String(item.id)">{{ item.revision_no }} · {{ item.status }}</option></select></label>
        <div class="revision-body" :inert="saving || !canEdit">
          <MInput v-model="revision.title" label="标题" />
          <MInput v-model="revision.subtitle" label="副标题" />
          <MTextarea v-model="revision.descr" label="简介" :rows="2" />
          <MSelect v-model="selectedCategory" label="讲义分类" :options="[{ value: '', label: '未分类' }, ...categories.map((category) => ({ value: String(category.id), label: category.name }))]" />
          <MInput v-model="revision.typst_version" label="排版版本" />
          <div v-for="chapter in chapters" :key="chapter.occurrence_id" class="revision-block">
            <MInput v-model="chapter.title" label="章节标题" />
            <MInput v-model="chapter.slug" label="章节标识" />
            <MInput v-model="chapter.tag" label="章节标签" />
            <MTextarea v-model="chapter.summary" label="章节摘要" :rows="2" />
            <div v-for="section in chapter.sections" :key="section.occurrence_id" class="revision-block">
              <MInput v-model="section.title" label="小节标题" />
              <MInput v-model="section.slug" label="小节标识" />
              <MInput v-model="section.tag" label="小节标签" />
              <MTextarea v-model="section.summary" label="小节摘要" :rows="2" />
              <div v-for="block in section.blocks" :key="block.occurrence_id" class="revision-block">
                <MTextarea v-if="block.block_type === 'author'" v-model="block.source" label="作者正文" :rows="8" />
                <p v-else>公共知识点引用：{{ block.knowledge_title || block.knowledge_point_id }} · 版本 {{ block.knowledge_revision_id }}</p>
                <div class="revision-actions"><MButton size="sm" @click="move(section.blocks, section.blocks.indexOf(block), -1)">上移</MButton><MButton size="sm" @click="move(section.blocks, section.blocks.indexOf(block), 1)">下移</MButton></div>
                <MButton size="sm" variant="danger" @click="section.blocks.splice(section.blocks.indexOf(block), 1)">移除内容块</MButton>
              </div>
              <MButton size="sm" @click="addAuthor(section)">添加作者内容</MButton>
              <MSelect v-model="newPointId" label="公共知识点" :options="[{ value: '', label: '请选择知识点' }, ...points.map((point) => ({ value: String(point.id), label: point.title }))]" />
              <MButton size="sm" :disabled="!newPointId" @click="addReference(section)">添加引用</MButton>
              <MButton size="sm" variant="danger" @click="chapter.sections.splice(chapter.sections.indexOf(section), 1)">移除小节</MButton>
              <div class="revision-actions"><MButton size="sm" @click="move(chapter.sections, chapter.sections.indexOf(section), -1)">小节上移</MButton><MButton size="sm" @click="move(chapter.sections, chapter.sections.indexOf(section), 1)">小节下移</MButton></div>
            </div>
            <MButton size="sm" @click="addSection(chapter)">添加小节</MButton>
            <MButton size="sm" variant="danger" @click="chapters.splice(chapters.indexOf(chapter), 1)">移除章节</MButton>
            <div class="revision-actions"><MButton size="sm" @click="move(chapters, chapters.indexOf(chapter), -1)">章节上移</MButton><MButton size="sm" @click="move(chapters, chapters.indexOf(chapter), 1)">章节下移</MButton></div>
          </div>
          <MButton size="sm" @click="addChapter">添加章节</MButton>
          <MTextarea v-model="revision.change_note" label="修改说明" :rows="2" />
        </div>
        <LectureAccessPanel
          v-if="canManageLecture"
          :lecture="selectedLecture"
          :collaborators="collaborators"
          :is-admin="isSuperAdmin"
          @updated="({ lecture, collaborators: updated }) => { if (lecture) selectedLecture = lecture; if (updated) collaborators = updated; }"
        />
      </template>
      <p v-else>选择一个版本开始编辑</p>
    </main>
    <MModal :open="createOpen" title="新建草稿" :busy="saving" @close="createOpen = false" @confirm="create">
      <MInput v-model="createForm.title" label="标题" />
      <MInput v-model="createForm.slug" label="标识" />
    </MModal>
    <MModal :open="leaveOpen" title="放弃未保存的修改" confirm-text="放弃修改" confirm-variant="danger" @close="finishLeave(false)" @confirm="finishLeave(true)" />
    <MModal :open="Boolean(conflict)" title="保存冲突" desc="当前修改仍保留。载入最新版本会丢弃当前修改，请先复制需要保留的内容。" confirm-text="载入最新版本" confirm-variant="danger" @close="conflict = null" @confirm="useLatest">
      <MTextarea :model-value="conflict?.local || ''" label="当前修改" :rows="8" readonly />
      <MTextarea :model-value="conflict?.remote || ''" label="最新版本" :rows="8" readonly />
    </MModal>
  </div>
</template>

<style scoped>
.revision-workbench {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.revision-sidebar {
  width: 260px;
  flex-shrink: 0;
  overflow: auto;
  padding: 16px;
  background: var(--bg-sidebar);
}

.revision-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 24px;
}

.revision-item {
  display: flex;
  width: 100%;
  justify-content: space-between;
  padding: 10px;
  color: var(--text-secondary);
}

.revision-item:hover,
.revision-item.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.revision-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.revision-header p {
  color: var(--text-muted);
}

.revision-actions {
  display: flex;
  gap: 8px;
}

.revision-body,
.revision-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.revision-block {
  padding: 16px;
  background: var(--bg-surface);
}
</style>
