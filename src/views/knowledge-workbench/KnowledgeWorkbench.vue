<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { knowledgeApi } from '../../api/knowledge.js';
import { managementApi } from '../../api/management.js';
import { authStatus, currentUser, initAuth } from '../../utils/auth.js';
import { workbenchPanelState } from '../../utils/workbench-state.js';
import { notify } from '../../components/MNotice.vue';
import WorkbenchTree from '../lecture-workbench/WorkbenchTree.vue';
import WorkbenchPanel from '../lecture-workbench/WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import MSelect from '../../components/MSelect.vue';
import MCodeEditor from '../../components/MCodeEditor.vue';
import MButton from '../../components/MButton.vue';
import MModal from '../../components/MModal.vue';
import '../lecture-workbench/workbench.css';

const treeRef = ref(null);
const points = ref([]);
const categories = ref([]);
const categoryError = ref('');
const listError = ref('');
const categoryOpen = ref(false);
const importTarget = ref(null);
const importData = shallowRef(null);
const importName = ref('');
const importError = ref('');
const importReading = ref(false);
let importSequence = 0;
const categoryForm = ref({ name: '', slug: '', parentId: '' });
const point = ref(null);
const selectedKey = ref('');
const baseline = ref('');
const loading = ref(false);
const selecting = ref(false);
const saving = ref(false);
const createOpen = ref(false);
const statusTarget = ref('');
const leaveOpen = ref(false);
const createForm = ref({ slug: '', title: '', source: '' });
let loadSequence = 0;
let listSequence = 0;
let identityEpoch = 0;
let leaveResolve = null;
const contextUserId = ref(null);

const authorized = computed(() => authStatus.value === 'authenticated' && currentUser.value?.role === 'super_admin');
const ownsContext = computed(() => authorized.value && contextUserId.value === currentUser.value?.id);
const editable = computed(() => ownsContext.value && !selecting.value && !saving.value && !createOpen.value && !categoryOpen.value && !importTarget.value);
const snapshot = () => JSON.stringify({ title: point.value?.title || '', source: point.value?.source || '' });
const dirty = computed(() => Boolean(point.value && baseline.value && snapshot() !== baseline.value));
watch([dirty, saving], ([changed, busy]) => { workbenchPanelState.value = { dirty: changed, saving: busy }; }, { immediate: true, flush: 'sync' });
const statusLabels = { active: '有效', disabled: '已停用', archived: '已归档' };
const categoryLinksMissing = computed(() => {
  const ids = new Set(categories.value.map((item) => item.id));
  return points.value.some((item) => !Array.isArray(item.category_ids) || item.category_ids.some((id) => !ids.has(id)));
});
const categoryOptions = computed(() => [
  { value: '', label: '一级分类' },
  ...categories.value.map((item) => ({ value: String(item.id), label: item.name }))
]);
const treeNodes = computed(() => {
  const groups = new Map(categories.value.map((item) => [item.id, {
    type: 'group', id: item.id, label: item.name, category: item,
    actions: authorized.value && item.parent_id === null ? { import: true } : false, children: []
  }]));
  const roots = [];
  const pointNode = (item) => ({
    type: 'section', id: item.id, item,
    label: `${item.title || '未命名知识点'}${item.status && item.status !== 'active' ? ` · ${statusLabels[item.status] || item.status}` : ''}`
  });
  for (const item of categories.value) {
    const group = groups.get(item.id);
    const seen = new Set([item.id]);
    let parent = item.parent_id;
    let valid = true;
    while (parent != null && groups.has(parent)) {
      if (seen.has(parent)) { valid = false; break; }
      seen.add(parent);
      parent = groups.get(parent).category.parent_id;
    }
    if (valid && item.parent_id != null && groups.has(item.parent_id)) groups.get(item.parent_id).children.push(group);
    else roots.push(group);
  }
  for (const item of points.value) {
    const ids = Array.isArray(item.category_ids) ? item.category_ids : null;
    const destinations = ids ? [...new Set(ids)].filter((id) => groups.has(id)) : [];
    if (!destinations.length) roots.push(pointNode(item));
    else for (const id of destinations) groups.get(id).children.push(pointNode(item));
  }
  return roots;
});

function finishLeave(confirmed) {
  leaveOpen.value = false;
  const resolve = leaveResolve;
  leaveResolve = null;
  resolve?.(confirmed);
}
function mayLeave() {
  if (saving.value || selecting.value || leaveResolve) return Promise.resolve(false);
  if (!dirty.value) return Promise.resolve(true);
  leaveOpen.value = true;
  return new Promise((resolve) => { leaveResolve = resolve; });
}
onBeforeRouteLeave(() => mayLeave());
function beforeUnload(event) {
  if (!dirty.value && !saving.value) return;
  event.preventDefault();
  event.returnValue = '';
}
async function loadList() {
  const sequence = ++listSequence;
  loading.value = true;
  listError.value = '';
  categoryError.value = '';
  try {
    const [pointResult, categoryResult] = await Promise.allSettled([knowledgeApi.manage(), managementApi.categories('knowledge')]);
    if (sequence !== listSequence) return;
    if (pointResult.status === 'fulfilled' && Array.isArray(pointResult.value)) points.value = pointResult.value;
    else { points.value = []; listError.value = '知识点管理列表加载失败，请重试。'; }
    if (categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value)) categories.value = categoryResult.value;
    else { categories.value = []; categoryError.value = '分类加载失败，当前无法按分类展示知识点。'; }
  } finally {
    if (sequence === listSequence) loading.value = false;
  }
}
async function createCategory() {
  if (!authorized.value || saving.value) return;
  const name = categoryForm.value.name.trim();
  const slug = categoryForm.value.slug.trim();
  const parentId = categoryForm.value.parentId;
  if (!name || !slug) { notify('请填写分类名称和标识', 'warn'); return; }
  if (parentId && !categories.value.some((item) => String(item.id) === parentId)) { notify('父分类不存在，请刷新列表', 'warn'); return; }
  const body = { name, slug, parent_id: parentId ? Number(parentId) : null };
  saving.value = true;
  const epoch = identityEpoch;
  try {
    await managementApi.createCategory('knowledge', body);
    if (epoch !== identityEpoch) { notify('账号状态已变化，请重新核对分类创建结果', 'warn'); return; }
    categoryOpen.value = false;
    categoryForm.value = { name: '', slug: '', parentId: '' };
    notify('分类已创建', 'success');
    await loadList();
  } catch (err) { notify(err.message || '创建分类失败', 'error'); }
  finally { saving.value = false; }
}
function closeImport() {
  importSequence++;
  importTarget.value = null;
  importData.value = null;
  importName.value = '';
  importError.value = '';
  importReading.value = false;
}
function openImport(node) {
  if (!authorized.value || node.category?.parent_id !== null || !categories.value.some((item) => item.id === node.id && item.parent_id === null)) return;
  closeImport();
  importTarget.value = node.category;
}
function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.schema_version !== 1) throw new Error('文件格式不正确，需要 schema_version 为 1 的导入文件。');
  if (!Array.isArray(data.categories) || !Array.isArray(data.points) || !Array.isArray(data.edges)) throw new Error('文件必须包含 categories、points 和 edges 数组。');
  const id = (value) => typeof value === 'string' && Boolean(value.trim());
  const categoryIds = new Set();
  const pointIds = new Set();
  for (const item of data.categories) {
    if (!item || !id(item.id) || !id(item.slug) || !id(item.name) || !(item.parent_id === null || id(item.parent_id)) || !Number.isInteger(item.pos) || item.pos < 0) throw new Error('分类记录缺少有效的 id、parent_id、slug、name 或 pos。');
    if (categoryIds.has(item.id)) throw new Error(`分类局部 ID 重复：${item.id}`);
    categoryIds.add(item.id);
  }
  const parents = new Map(data.categories.map((item) => [item.id, item.parent_id]));
  const checked = new Set();
  for (const item of data.categories) {
    const path = new Set();
    let current = item.id;
    while (current !== null && !checked.has(current)) {
      if (!parents.has(current)) throw new Error(`找不到分类引用：${current}`);
      if (path.has(current)) throw new Error(`分类层级存在循环：${current}`);
      path.add(current);
      current = parents.get(current);
    }
    for (const entry of path) checked.add(entry);
  }
  for (const item of data.points) {
    if (!item || !id(item.id) || !id(item.slug) || !id(item.title) || typeof item.source !== 'string' || !Array.isArray(item.category_ids)) throw new Error('知识点记录缺少有效的 id、slug、title、source 或 category_ids。');
    if (pointIds.has(item.id)) throw new Error(`知识点局部 ID 重复：${item.id}`);
    pointIds.add(item.id);
    for (const categoryId of item.category_ids) if (!categoryIds.has(categoryId)) throw new Error(`找不到知识点引用的分类：${categoryId}`);
  }
  for (const edge of data.edges) {
    if (!edge || !pointIds.has(edge.source) || !pointIds.has(edge.target)) throw new Error('前置关系引用了不存在的知识点。');
  }
  return data;
}
async function readImportFile(event) {
  const file = event.target.files?.[0];
  const sequence = ++importSequence;
  importData.value = null;
  importError.value = '';
  importName.value = file?.name || '';
  if (!file) { importReading.value = false; return; }
  importReading.value = true;
  try {
    const contents = await file.text();
    if (sequence !== importSequence) return;
    let data;
    try { data = JSON.parse(contents); }
    catch { throw new Error('文件不是有效的 JSON。'); }
    importData.value = validateImport(data);
  } catch (error) {
    if (sequence === importSequence) importError.value = error.message || '文件读取失败。';
  } finally {
    if (sequence === importSequence) importReading.value = false;
  }
}
async function selectNode(node) {
  if (!authorized.value || selecting.value || saving.value || createOpen.value || node.type !== 'section' || (ownsContext.value && selectedKey.value === `section:${node.id}`)) return;
  if (!await mayLeave()) return;
  const sequence = ++loadSequence;
  selecting.value = true;
  try {
    const result = await knowledgeApi.getManaged(node.id);
    if (sequence !== loadSequence) return;
    if (!result?.id || typeof result.source !== 'string') throw new Error('知识点数据不完整');
    point.value = result;
    contextUserId.value = currentUser.value?.id;
    baseline.value = snapshot();
    selectedKey.value = `section:${node.id}`;
  } catch (err) {
    if (sequence === loadSequence) notify(err.message || '知识点加载失败', 'error');
  } finally {
    if (sequence === loadSequence) selecting.value = false;
  }
}
function discard() {
  if (baseline.value && point.value) Object.assign(point.value, JSON.parse(baseline.value));
}
async function save() {
  if (!editable.value || !point.value || !dirty.value) return;
  const body = { title: point.value.title.trim(), source: point.value.source };
  if (!body.title || !body.source?.trim()) { notify('请填写标题和正文', 'warn'); return; }
  saving.value = true;
  const epoch = identityEpoch;
  try {
    const result = await knowledgeApi.update(point.value.id, body);
    if (epoch !== identityEpoch) { notify('账号状态已变化，请重新核对知识点保存结果', 'warn'); return; }
    if (!result?.id || typeof result.source !== 'string') throw new Error('保存响应不完整，请重新读取知识点');
    point.value = { ...point.value, ...result };
    baseline.value = snapshot();
    notify('知识点已保存并立即生效', 'success');
    await loadList();
  } catch (err) { notify(err.message || '保存失败，当前修改已保留', 'error'); }
  finally { saving.value = false; }
}
async function openCreate() {
  if (!authorized.value || !await mayLeave()) return;
  createOpen.value = true;
}
async function createPoint() {
  if (!authorized.value || saving.value) return;
  const body = { slug: createForm.value.slug.trim(), title: createForm.value.title.trim(), source: createForm.value.source };
  if (!body.slug || !body.title || !body.source.trim()) { notify('请填写标识、标题和正文', 'warn'); return; }
  saving.value = true;
  const epoch = identityEpoch;
  try {
    const result = await knowledgeApi.create(body);
    if (epoch !== identityEpoch) { notify('知识点已创建，账号状态已变化，请刷新列表', 'warn'); return; }
    if (!result?.id || typeof result.source !== 'string') throw new Error('创建响应不完整，请刷新列表');
    point.value = result;
    contextUserId.value = currentUser.value?.id;
    baseline.value = snapshot();
    selectedKey.value = `section:${result.id}`;
    createOpen.value = false;
    createForm.value = { slug: '', title: '', source: '' };
    notify('知识点已创建', 'success');
    await loadList();
  } catch (err) { notify(err.message || '创建失败', 'error'); }
  finally { saving.value = false; }
}
async function changeStatus() {
  if (!ownsContext.value || !point.value || !statusTarget.value || saving.value || dirty.value) return;
  saving.value = true;
  const epoch = identityEpoch;
  try {
    const result = await knowledgeApi.setStatus(point.value.id, statusTarget.value);
    if (epoch !== identityEpoch) { notify('账号状态已变化，请重新核对知识点状态', 'warn'); return; }
    if (!result?.id || !result.status) throw new Error('状态响应不完整，请重新读取知识点');
    point.value = { ...point.value, ...result };
    statusTarget.value = '';
    notify('知识点状态已更新', 'success');
    await loadList();
  } catch (err) { notify(err.message || '更新状态失败', 'error'); }
  finally { saving.value = false; }
}
watch([authStatus, () => currentUser.value?.id, () => currentUser.value?.role], () => {
  identityEpoch++;
  loadSequence++;
  listSequence++;
  selecting.value = false;
  loading.value = false;
  points.value = [];
  categories.value = [];
  categoryError.value = '';
  listError.value = '';
  categoryOpen.value = false;
  categoryForm.value = { name: '', slug: '', parentId: '' };
  closeImport();
  createOpen.value = false;
  statusTarget.value = '';
  if (authorized.value) loadList();
}, { immediate: true, flush: 'sync' });
onMounted(async () => { window.addEventListener('beforeunload', beforeUnload); await initAuth(); });
onUnmounted(() => {
  loadSequence++;
  listSequence++;
  finishLeave(false);
  closeImport();
  workbenchPanelState.value = { dirty: false, saving: false };
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <div class="knowledge-workbench">
    <WorkbenchTree :inert="selecting || saving || createOpen || categoryOpen || Boolean(importTarget)" ref="treeRef" title="KNOWLEDGE WORKBENCH" refresh-label="刷新分类与知识点" empty-text="暂无分类或知识点" :nodes="treeNodes" :selected-key="selectedKey" :loading="loading" @select="selectNode" @refresh="authorized && loadList()" @import="openImport">
      <template #toolbar><MButton v-if="authorized" size="sm" @click="categoryOpen = true">新建分类</MButton><MButton v-if="authorized" size="sm" @click="openCreate">新建知识点</MButton></template>
      <template #notice><p v-if="listError || categoryError || categoryLinksMissing" class="tree-notice">{{ listError || categoryError || '部分知识点的分类关联未提供或分类不可用，无法完整展示分类归属。' }}</p></template>
    </WorkbenchTree>
    <main class="workbench-main">
      <div v-if="point && !ownsContext" class="workbench-empty"><h2>当前账号无法访问此编辑内容</h2><p>请使用原账号重新登录，或离开后选择其他知识点。</p></div>
      <WorkbenchPanel v-else-if="point" kind="KNOWLEDGE" :title="point.title || '未命名知识点'" :dirty="dirty" :saving="saving || selecting || createOpen" :editable="editable" :can-save="dirty" @save="save" @reset="discard">
        <template #actions>
          <MButton v-if="authorized && point.status !== 'active'" size="sm" :disabled="saving || selecting || dirty" @click="statusTarget = 'active'">恢复</MButton>
          <MButton v-if="authorized && point.status === 'active'" size="sm" :disabled="saving || selecting || dirty" @click="statusTarget = 'disabled'">停用</MButton>
          <MButton v-if="authorized && point.status !== 'archived'" size="sm" :disabled="saving || selecting || dirty" @click="statusTarget = 'archived'">归档</MButton>
        </template>
        <div class="status-notice">状态：{{ statusLabels[point.status] || '未提供' }}。保存后立即生效，内容以最后一次成功保存为准。</div>
        <div class="wb-block" :inert="!editable">
          <div class="wb-form-grid">
            <MInput v-model="point.title" label="知识点标题" required />
            <MInput :model-value="point.slug || ''" label="知识点标识" disabled />
          </div>
        </div>
        <div class="wb-block">
          <div class="wb-block-head"><span class="wb-block-title">知识点内容</span></div>
          <div class="content-layout">
            <MCodeEditor :key="editable" v-model="point.source" label="Typst 源码" height="max(600px, calc(100vh - 300px))" :show-language="false" :readonly="!editable" @save="editable && save()" />
            <div class="preview-column"><div class="preview-heading">预览</div><div class="content-preview font-mono">COOMING SOON</div></div>
          </div>
        </div>
      </WorkbenchPanel>
      <div v-else class="workbench-empty"><span class="empty-label font-mono">KNOWLEDGE WORKBENCH</span><h2>{{ authorized ? '选择一个知识点' : '知识点工作台' }}</h2><p>{{ authorized ? '从左侧选择或新建知识点。' : '请使用超级管理员账号登录。' }}</p></div>
    </main>
    <MModal :open="categoryOpen" title="新建分类" :busy="saving" @close="!saving && (categoryOpen = false)" @confirm="createCategory">
      <div class="create-fields"><MInput v-model="categoryForm.name" label="分类名称" required /><MInput v-model="categoryForm.slug" label="分类标识" required /><MSelect v-model="categoryForm.parentId" label="父分类" :options="categoryOptions" /></div>
    </MModal>
    <MModal :open="Boolean(importTarget)" title="导入 JSON" :desc="`导入目标：${importTarget?.name || ''}`" :hide-footer="true" :show-close="true" @close="closeImport">
      <div class="import-fields">
        <label class="import-file">选择导入文件<input type="file" accept=".json,application/json" @change="readImportFile" /></label>
        <p v-if="importReading" class="tree-notice">正在读取文件…</p>
        <p v-if="importError" class="import-error" role="alert">{{ importError }}</p>
        <template v-if="importData"><p class="tree-notice">{{ importName }}：{{ importData.categories.length }} 个分类、{{ importData.points.length }} 个知识点、{{ importData.edges.length }} 条前置关系。</p><p class="tree-notice">文件中的顶层分类将挂在目标分类下；没有直接分类的知识点将归入目标分类。</p></template>
        <p class="tree-notice">导入接口尚未就绪，暂不可提交。正式校验和写入由服务端完成。</p>
        <div class="import-actions"><MButton variant="ghost" @click="closeImport">取消</MButton><MButton variant="primary" :disabled="true">接口待接入</MButton></div>
      </div>
    </MModal>
    <MModal :open="createOpen" title="新建知识点" :busy="saving" @close="!saving && (createOpen = false)" @confirm="createPoint">
      <div class="create-fields"><MInput v-model="createForm.title" label="知识点标题" required /><MInput v-model="createForm.slug" label="知识点标识" hint="创建后无法修改" required /><MTextarea v-model="createForm.source" label="正文" hint="创建时必须填写正文" :rows="5" /></div>
    </MModal>
    <MModal :open="Boolean(statusTarget)" :title="`${statusLabels[statusTarget] || '更新'}知识点`" :desc="statusTarget === 'active' ? '恢复后知识点可再次公开访问。' : '停用或归档后，讲义中引用该知识点的位置将显示缺失提示。'" :busy="saving" confirm-text="确认" @close="!saving && (statusTarget = '')" @confirm="changeStatus" />
    <MModal :open="leaveOpen" title="放弃未保存的修改" desc="离开后当前修改将丢失" confirm-text="放弃修改" confirm-variant="danger" @close="finishLeave(false)" @confirm="finishLeave(true)" />
  </div>
</template>

<style scoped>
.knowledge-workbench { display: flex; height: 100%; min-height: 0; overflow: hidden; }
.workbench-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.workbench-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; text-align: center; }
.empty-label { margin-bottom: 16px; color: var(--text-muted); font-size: var(--font-size-smaller); letter-spacing: 0.08em; }
.workbench-empty h2 { margin: 0; color: var(--text-primary); font-size: var(--font-size-larger); font-weight: var(--font-weight-medium); }
.workbench-empty p { margin: 12px 0 0; color: var(--text-secondary); font-size: var(--font-size); line-height: 1.6; }
.status-notice { margin-bottom: 20px; padding: 14px 16px; border-radius: var(--radius-sm); background: var(--tag-blue-bg); color: var(--text-primary); font-size: var(--font-size-smaller); }
.content-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
.preview-column { display: flex; flex-direction: column; min-width: 0; }
.preview-heading { margin-bottom: 4px; padding: 0 1px; font-size: var(--font-size-smaller); font-weight: 500; color: var(--text-secondary); }
.content-preview { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 600px; padding: 16px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--text-muted); text-align: center; }
.import-fields { display: flex; flex-direction: column; gap: 12px; }
.import-file { display: flex; flex-direction: column; gap: 8px; color: var(--text-secondary); font-size: var(--font-size-smaller); }
.import-file input { max-width: 100%; color: var(--text-primary); font: inherit; }
.import-error { margin: 0; color: var(--tag-red); font-size: var(--font-size-smaller); }
.import-actions { display: flex; justify-content: flex-end; gap: 8px; }
.tree-notice { margin: 4px 6px 12px; color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.5; }
.create-fields { display: flex; flex-direction: column; gap: 16px; }
@media (max-width: 900px) { .content-layout { grid-template-columns: minmax(0, 1fr); } .content-preview { min-height: 240px; } }
</style>
