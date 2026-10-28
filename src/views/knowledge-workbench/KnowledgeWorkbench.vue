<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import MFilePicker from '../../components/MFilePicker.vue';
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
import TypstEditorPreview from '../../components/TypstEditorPreview.vue';
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
const importSize = ref(0);
const importError = ref('');
const importReading = ref(false);
const importUncertain = ref(false);
let importSequence = 0;
const categoryForm = ref({ name: '', slug: '', parentId: '' });
const point = ref(null);
const selectedKey = ref('');
const baseline = ref('');
const loading = ref(false);
const selecting = ref(false);
const saving = ref(false);
const createOpen = ref(false);
const createCategoryId = ref(null);
const statusTarget = ref('');
const deleteTarget = ref(null);
const deleteError = ref('');
const deleteUncertain = ref(false);
const pendingPointVerification = ref(null);
const leaveOpen = ref(false);
const createForm = ref({ slug: '', title: '', source: '' });
let loadSequence = 0;
let listSequence = 0;
let identityEpoch = 0;
let leaveResolve = null;
const contextUserId = ref(null);

const authorized = computed(() => authStatus.value === 'authenticated' && currentUser.value?.role === 'super_admin');
const ownsContext = computed(() => authorized.value && contextUserId.value === currentUser.value?.id);
const editable = computed(() => ownsContext.value && !selecting.value && !saving.value && !createOpen.value && !categoryOpen.value && !importTarget.value && !deleteTarget.value && pendingPointVerification.value === null);
const snapshot = () => JSON.stringify({ title: point.value?.title || '', source: point.value?.source || '' });
const dirty = computed(() => Boolean(point.value && baseline.value && snapshot() !== baseline.value));
watch([dirty, saving], ([changed, busy]) => { workbenchPanelState.value = { dirty: changed, saving: busy }; }, { immediate: true, flush: 'sync' });
const statusLabels = { active: '有效', archived: '已归档' };
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
    type: 'group', id: item.id, label: item.name, category: item, actionsOnHover: true,
    actions: authorized.value ? { add: true, addLabel: '新建知识点', import: item.parent_id === null, remove: true, removeLabel: '永久删除分类' } : false, children: []
  }]));
  const roots = [];
  const pointNode = (item) => ({
    type: 'section', id: item.id, item,
    actions: authorized.value ? { remove: true, removeLabel: '永久删除知识点' } : false,
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
  if (saving.value || selecting.value || leaveResolve || deleteTarget.value) return Promise.resolve(false);
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
    if (pointResult.status === 'fulfilled' && Array.isArray(pointResult.value)) {
      points.value = pointResult.value;
      if (pendingPointVerification.value !== null && contextUserId.value === currentUser.value?.id) {
        const id = pendingPointVerification.value;
        const current = points.value.find((item) => item.id === id);
        if (point.value?.id === id) {
          if (current) point.value = { ...point.value, category_ids: current.category_ids };
          else {
            point.value = null;
            baseline.value = '';
            contextUserId.value = null;
            if (selectedKey.value === `section:${id}`) selectedKey.value = '';
            notify('当前编辑的知识点已随分类删除', 'warn');
          }
        }
        pendingPointVerification.value = null;
      }
    } else { points.value = []; listError.value = '知识点管理列表加载失败，请重试。'; }
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
  importSize.value = 0;
  importError.value = '';
  importReading.value = false;
  importUncertain.value = false;
}
function openImport(node) {
  if (!authorized.value || node.category?.parent_id !== null || !categories.value.some((item) => item.id === node.id && item.parent_id === null)) return;
  closeImport();
  importTarget.value = node.category;
}
function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.schema_version !== 1) throw new Error('文件格式不正确，需要 schema_version 为 1 的导入文件。');
  if (!Array.isArray(data.categories) || !Array.isArray(data.points) || !Array.isArray(data.edges)) throw new Error('文件必须包含 categories、points 和 edges 数组。');
  if (data.categories.length > 150 || data.points.length > 1000 || data.edges.length > 6000) throw new Error('文件超过数量上限：分类 150、知识点 1000、前置关系 6000。');
  if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 2 * 1024 * 1024) throw new Error('文件数据序列化后超过 2 MiB 上限。');
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
    if (!item || !id(item.id) || !id(item.slug) || !id(item.title) || typeof item.source !== 'string' || (item.category_ids !== undefined && !Array.isArray(item.category_ids))) throw new Error('知识点记录缺少有效的 id、slug、title、source，或 category_ids 格式不正确。');
    if (pointIds.has(item.id)) throw new Error(`知识点局部 ID 重复：${item.id}`);
    pointIds.add(item.id);
    for (const categoryId of item.category_ids || []) if (!categoryIds.has(categoryId)) throw new Error(`找不到知识点引用的分类：${categoryId}`);
  }
  for (const edge of data.edges) {
    if (!edge || !pointIds.has(edge.source) || !pointIds.has(edge.target)) throw new Error('前置关系引用了不存在的知识点。');
  }
  return data;
}
async function readImportFile(event) {
  if (saving.value || importUncertain.value) return;
  const file = event.target.files?.[0];
  const sequence = ++importSequence;
  importData.value = null;
  importError.value = '';
  importName.value = file?.name || '';
  importSize.value = file?.size || 0;
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
function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function importErrorMessage(error) {
  const message = error.data?.message || error.data?.error || error.message || '导入失败';
  const details = error.data?.details;
  const entries = Array.isArray(details) ? details : details && typeof details === 'object' ? [details] : [];
  const locations = entries.slice(0, 5).map((item) => {
    if (!item || typeof item !== 'object') return '';
    const field = typeof item.field === 'string' ? item.field : '';
    const index = Number.isInteger(item.index) ? `第 ${item.index + 1} 项` : '';
    const property = typeof item.property === 'string' ? item.property : '';
    const reference = typeof item.id === 'string' ? item.id : typeof item.slug === 'string' ? item.slug : '';
    const reason = typeof item.message === 'string' ? item.message : '';
    return [field, index, property, reference, reason].filter(Boolean).join(' · ');
  }).filter(Boolean);
  return [String(message), ...locations].join('；');
}
async function submitImport() {
  if (!authorized.value || saving.value || importReading.value || importUncertain.value || !importData.value || !importTarget.value) return;
  const targetId = importTarget.value.id;
  if (!categories.value.some((item) => item.id === targetId && item.parent_id === null)) { importError.value = '目标分类不可用，请刷新列表后重试。'; return; }
  const epoch = identityEpoch;
  saving.value = true;
  importError.value = '';
  try {
    const result = await knowledgeApi.import({ category_id: targetId, data: importData.value });
    if (epoch !== identityEpoch) { notify('导入请求已返回，账号状态已变化，请核对导入结果。', 'warn'); return; }
    if (!result || result.category_id !== targetId || !result.counts || typeof result.counts !== 'object' || !Array.isArray(result.categories) || !Array.isArray(result.points)) {
      importUncertain.value = true;
      importError.value = '导入响应不完整，结果未确认。请先刷新列表并核对数据，避免重复提交。';
      return;
    }
    closeImport();
    notify('导入成功，正在刷新分类和知识点。', 'success');
    await loadList();
    if (epoch === identityEpoch) treeRef.value?.expand('group', targetId);
  } catch (error) {
    if (epoch !== identityEpoch) { notify('账号状态已变化，导入结果可能未确认，请核对后再操作。', 'warn'); return; }
    if ([400, 401, 403, 404, 409, 413, 422].includes(error.status)) importError.value = importErrorMessage(error);
    else {
      importUncertain.value = true;
      importError.value = '导入结果未确认，请先刷新列表并核对数据，避免重复提交。';
    }
  } finally { saving.value = false; }
}
async function selectNode(node) {
  if (!authorized.value || selecting.value || saving.value || createOpen.value) return;
  if (node.type === 'group') { selectedKey.value = `group:${node.id}`; return; }
  if (node.type !== 'section') return;
  if (ownsContext.value && point.value?.id === node.id) { selectedKey.value = `section:${node.id}`; return; }
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
async function openCreate(node) {
  if (!authorized.value || node.type !== 'group' || !await mayLeave()) return;
  if (!authorized.value || !categories.value.some((category) => category.id === node.id)) return;
  createCategoryId.value = node.id;
  createOpen.value = true;
}
async function createPoint() {
  if (!authorized.value || saving.value || createCategoryId.value === null) return;
  const body = { slug: createForm.value.slug.trim(), title: createForm.value.title.trim(), source: createForm.value.source };
  if (!body.slug || !body.title || !body.source.trim()) { notify('请填写标识、标题和正文', 'warn'); return; }
  const categoryId = createCategoryId.value;
  if (!categories.value.some((item) => item.id === categoryId)) { notify('目标分类不可用，请刷新列表', 'warn'); return; }
  saving.value = true;
  const epoch = identityEpoch;
  let created = false;
  try {
    const result = await knowledgeApi.create(body);
    created = true;
    if (epoch !== identityEpoch) { notify('知识点已创建，账号状态已变化，请刷新列表核对分类', 'warn'); return; }
    if (!result?.id || typeof result.source !== 'string') throw new Error('知识点已创建，但响应不完整，请刷新列表核对');
    point.value = result;
    contextUserId.value = currentUser.value?.id;
    baseline.value = snapshot();
    selectedKey.value = `section:${result.id}`;
    createOpen.value = false;
    createCategoryId.value = null;
    createForm.value = { slug: '', title: '', source: '' };
    try {
      await knowledgeApi.setCategories(result.id, [categoryId]);
      if (epoch !== identityEpoch) { notify('知识点已创建，账号状态已变化，请刷新列表核对分类', 'warn'); return; }
      notify('知识点已创建并关联分类', 'success');
      treeRef.value?.expand('group', categoryId);
    } catch {
      notify('知识点已创建，但分类关联未确认，请刷新列表核对，避免重复创建', 'warn');
    }
    if (epoch === identityEpoch) await loadList();
  } catch (err) {
    if (created) {
      createOpen.value = false;
      createCategoryId.value = null;
      createForm.value = { slug: '', title: '', source: '' };
      notify(err.message || '知识点已创建，请刷新列表核对', 'warn');
      if (epoch === identityEpoch) await loadList();
    }
    else notify('创建结果未确认，请刷新列表核对后再重试', 'error');
  } finally { saving.value = false; }
}
async function openDelete(node) {
  if (!authorized.value || saving.value || selecting.value || deleteTarget.value || !['group', 'section'].includes(node.type)) return;
  const epoch = identityEpoch;
  if (ownsContext.value && (node.type === 'group' || point.value?.id === node.id) && !await mayLeave()) return;
  if (epoch !== identityEpoch || !authorized.value) return;
  const exists = node.type === 'group' ? categories.value.some((item) => item.id === node.id) : points.value.some((item) => item.id === node.id);
  if (!exists) { notify('目标已不在列表中，请刷新后重试', 'warn'); return; }
  deleteError.value = '';
  deleteUncertain.value = false;
  deleteTarget.value = { type: node.type, id: node.id, label: node.label };
}
function closeDelete() {
  if (saving.value) return;
  deleteTarget.value = null;
  deleteError.value = '';
  deleteUncertain.value = false;
}
async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target || !authorized.value || saving.value || deleteUncertain.value) return;
  const epoch = identityEpoch;
  saving.value = true;
  deleteError.value = '';
  try {
    if (target.type === 'group') await managementApi.removeKnowledgeCategory(target.id);
    else await knowledgeApi.remove(target.id);
    if (epoch !== identityEpoch) { notify('账号状态已变化，请刷新列表核对删除结果', 'warn'); return; }
    if (target.type === 'section' && point.value?.id === target.id) {
      point.value = null;
      baseline.value = '';
      contextUserId.value = null;
    }
    if (target.type === 'group' && point.value) pendingPointVerification.value = point.value.id;
    if (selectedKey.value === `${target.type}:${target.id}`) selectedKey.value = '';
    deleteTarget.value = null;
    notify('已永久删除', 'success');
    await loadList();
  } catch (error) {
    if (epoch !== identityEpoch) { notify('账号状态已变化，请刷新列表核对删除结果', 'warn'); return; }
    if (error.status === 409) { deleteUncertain.value = true; deleteError.value = '操作发生并发冲突，请关闭后刷新列表并核对，再决定是否删除。'; }
    else if ([400, 401, 403, 404].includes(error.status)) deleteError.value = error.status === 404 ? '目标不存在，请关闭后刷新列表。' : (error.message || '删除失败，请检查权限。');
    else { deleteUncertain.value = true; deleteError.value = '删除结果未确认，请关闭后刷新列表核对，避免重复操作。'; }
  } finally { saving.value = false; }
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
  createCategoryId.value = null;
  statusTarget.value = '';
  deleteTarget.value = null;
  deleteError.value = '';
  deleteUncertain.value = false;
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
    <WorkbenchTree class="knowledge-tree" :inert="selecting || saving || createOpen || categoryOpen || Boolean(importTarget) || Boolean(deleteTarget)" ref="treeRef" title="KNOWLEDGE WORKBENCH" refresh-label="刷新分类与知识点" empty-text="暂无分类或知识点" :add-label="authorized ? '新建分类' : ''" :nodes="treeNodes" :selected-key="selectedKey" :loading="loading" @select="selectNode" @refresh="authorized && loadList()" @add-root="categoryOpen = true" @add="openCreate" @import="openImport" @remove="openDelete">
      <template #notice><p v-if="listError || categoryError || categoryLinksMissing" class="tree-notice">{{ listError || categoryError || '部分知识点的分类关联未提供或分类不可用，无法完整展示分类归属。' }}</p></template>
    </WorkbenchTree>
    <main class="workbench-main">
      <div v-if="point && !ownsContext" class="workbench-empty"><h2>当前账号无法访问此编辑内容</h2><p>请使用原账号重新登录，或离开后选择其他知识点。</p></div>
      <WorkbenchPanel v-else-if="point" kind="KNOWLEDGE" :title="point.title || '未命名知识点'" :dirty="dirty" :saving="saving || selecting || createOpen" :editable="editable" :can-save="dirty" @save="save" @reset="discard">
        <template #actions>
          <MButton v-if="authorized && point.status === 'archived'" size="sm" :disabled="saving || selecting || dirty" @click="statusTarget = 'active'">恢复</MButton>
          <MButton v-if="authorized && point.status === 'active'" size="sm" :disabled="saving || selecting || dirty" @click="statusTarget = 'archived'">归档</MButton>
        </template>
        <div v-if="pendingPointVerification !== null" class="status-notice">分类已删除，正在核对当前知识点。若列表加载失败，请刷新后再继续编辑。</div>
        <div class="status-notice">状态：{{ statusLabels[point.status] || '未提供' }}。保存后立即生效，内容以最后一次成功保存为准。</div>
        <div class="wb-block" :inert="!editable">
          <div class="wb-form-grid">
            <MInput v-model="point.title" label="知识点标题" required />
            <MInput :model-value="point.slug || ''" label="知识点标识" disabled />
          </div>
        </div>
        <div class="wb-block">
          <div class="wb-block-head"><span class="wb-block-title">知识点内容</span></div>
          <TypstEditorPreview :key="point.id" v-model="point.source" :editable="editable" @save="save" />
        </div>
      </WorkbenchPanel>
      <div v-else class="workbench-empty"><span class="empty-label font-mono">KNOWLEDGE WORKBENCH</span><h2>{{ authorized ? '选择一个知识点' : '知识点工作台' }}</h2><p>{{ authorized ? '从左侧选择分类或知识点。' : '请使用超级管理员账号登录。' }}</p></div>
    </main>
    <MModal :open="categoryOpen" title="新建分类" :busy="saving" @close="!saving && (categoryOpen = false)" @confirm="createCategory">
      <div class="create-fields"><MInput v-model="categoryForm.name" label="分类名称" required /><MInput v-model="categoryForm.slug" label="分类标识" required /><MSelect v-model="categoryForm.parentId" label="父分类" :options="categoryOptions" /></div>
    </MModal>
    <MModal :open="Boolean(importTarget)" title="导入知识点" width="480px" :hide-footer="true" :show-close="!saving" @close="!saving && closeImport()">
      <div class="import-fields">
        <p class="import-target">导入目标 <strong :title="importTarget?.name">{{ importTarget?.name }}</strong></p>
        <MFilePicker :title="importName || 'JSON 文件'" :detail="importName ? formatFileSize(importSize) : '选择符合导入格式的文件'" :action="importName ? '重新选择' : '选择文件'" accept=".json,application/json" :disabled="saving || importUncertain" @choose="$event.target.value = ''" @change="readImportFile" />
        <p v-if="importReading" class="import-hint">正在读取文件…</p>
        <p v-if="importError" class="import-error" role="alert">{{ importError }}</p>
        <template v-if="importData">
          <p class="import-hint">{{ importData.categories.length }} 个分类 · {{ importData.points.length }} 个知识点 · {{ importData.edges.length }} 条前置关系</p>
          <p class="import-hint">文件中的顶层分类将挂在目标分类下；没有直接分类的知识点将归入目标分类。</p>
        </template>
        <p class="import-hint">导入不会覆盖现有内容。</p>
        <div class="import-actions"><MButton variant="secondary" :disabled="saving" @click="closeImport">{{ importUncertain ? '关闭并核对' : '取消' }}</MButton><MButton class="import-confirm" variant="primary" :disabled="saving || importReading || importUncertain || !importData" @click="submitImport">{{ saving ? '导入中…' : '确认导入' }}</MButton></div>
      </div>
    </MModal>
    <MModal :open="createOpen" title="新建知识点" :busy="saving" @close="!saving && (createOpen = false)" @confirm="createPoint">
      <div class="create-fields"><MInput v-model="createForm.title" label="知识点标题" required /><MInput v-model="createForm.slug" label="知识点标识" hint="创建后无法修改" required /><MTextarea v-model="createForm.source" label="正文" hint="创建时必须填写正文" :rows="5" /></div>
    </MModal>
    <MModal :open="Boolean(deleteTarget)" :title="deleteTarget?.type === 'group' ? '永久删除分类' : '永久删除知识点'" :hide-footer="true" :show-close="!saving" @close="closeDelete">
      <div class="delete-fields">
        <p>确定永久删除“{{ deleteTarget?.label }}”吗？此操作不可撤销。</p>
        <p v-if="deleteTarget?.type === 'group'">将删除此分类及全部子分类，并删除仅属于这些分类的知识点。还关联范围外分类的知识点会保留，仅移除范围内的分类关联。涉及被删除知识点的前置关系也会清理，讲义中的相关引用可能显示缺失占位。本地掌握记录和批注不会自动清理。</p>
        <p v-else>删除将同时清理此知识点的分类关联和前置、后续关系，其他知识点保留。讲义源码不会修改，引用处将显示缺失占位；本地掌握记录和批注不会自动清理。</p>
        <p v-if="deleteError" class="delete-error" role="alert">{{ deleteError }}</p>
        <div class="import-actions"><MButton variant="ghost" :disabled="saving" @click="closeDelete">取消</MButton><MButton variant="danger" :disabled="saving || deleteUncertain" @click="confirmDelete">{{ saving ? '删除中…' : '永久删除' }}</MButton></div>
      </div>
    </MModal>
    <MModal :open="Boolean(statusTarget)" :title="`${statusLabels[statusTarget] || '更新'}知识点`" :desc="statusTarget === 'active' ? '恢复后知识点可再次公开访问。' : '归档后知识点不再公开，讲义中引用该知识点的位置将显示缺失提示。'" :busy="saving" confirm-text="确认" @close="!saving && (statusTarget = '')" @confirm="changeStatus" />
    <MModal :open="leaveOpen" title="放弃未保存的修改" desc="离开后当前修改将丢失" confirm-text="放弃修改" confirm-variant="danger" @close="finishLeave(false)" @confirm="finishLeave(true)" />
  </div>
</template>

<style scoped>
.knowledge-tree :deep(.tree-empty p) { font-size: var(--font-size); }
.knowledge-workbench { display: flex; height: 100%; min-height: 0; overflow: hidden; }
.workbench-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.workbench-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; text-align: center; }
.empty-label { margin-bottom: 16px; color: var(--text-muted); font-size: var(--font-size-smaller); letter-spacing: 0.08em; }
.workbench-empty h2 { margin: 0; color: var(--text-primary); font-size: var(--font-size-larger); font-weight: var(--font-weight-medium); }
.workbench-empty p { margin: 12px 0 0; color: var(--text-secondary); font-size: var(--font-size); line-height: 1.6; }
.status-notice { margin-bottom: 20px; padding: 14px 16px; border-radius: var(--radius-sm); background: var(--tag-blue-bg); color: var(--text-primary); font-size: var(--font-size-smaller); }
.delete-fields { display: flex; flex-direction: column; gap: 12px; color: var(--text-secondary); line-height: 1.5; }
.delete-fields p { margin: 0; }
.delete-error { color: var(--tag-red); white-space: pre-wrap; overflow-wrap: anywhere; }
.import-fields { display: flex; flex-direction: column; gap: 12px; }
.import-target { display: flex; align-items: baseline; gap: 10px; min-width: 0; margin: 0 0 4px; color: var(--text-secondary); font-size: var(--font-size-smaller); }
.import-target strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); font-weight: var(--font-weight-medium); }
.import-hint { margin: 0; color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.6; }
.import-confirm:disabled { opacity: .7; }
.import-error { margin: 0; color: var(--tag-red); font-size: var(--font-size-smaller); line-height: 1.6; overflow-wrap: anywhere; }
.import-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.tree-notice { margin: 4px 6px 12px; color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.5; }
.create-fields { display: flex; flex-direction: column; gap: 16px; }
</style>
