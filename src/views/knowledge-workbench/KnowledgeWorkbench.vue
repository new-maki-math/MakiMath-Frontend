<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { knowledgeApi } from '../../api/knowledge.js';
import { authStatus, currentUser, initAuth } from '../../utils/auth.js';
import { workbenchPanelState } from '../../utils/workbench-state.js';
import { notify } from '../../components/MNotice.vue';
import WorkbenchTree from '../lecture-workbench/WorkbenchTree.vue';
import WorkbenchPanel from '../lecture-workbench/WorkbenchPanel.vue';
import MInput from '../../components/MInput.vue';
import MTextarea from '../../components/MTextarea.vue';
import MCodeEditor from '../../components/MCodeEditor.vue';
import MButton from '../../components/MButton.vue';
import MModal from '../../components/MModal.vue';
import '../lecture-workbench/workbench.css';

const treeRef = ref(null);
const points = ref([]);
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
let leaveResolve = null;

const authorized = computed(() => authStatus.value === 'authenticated' && currentUser.value?.role === 'super_admin');
const snapshot = () => JSON.stringify({ title: point.value?.title || '', source: point.value?.source || '' });
const dirty = computed(() => Boolean(point.value && baseline.value && snapshot() !== baseline.value));
watch([dirty, saving], ([changed, busy]) => { workbenchPanelState.value = { dirty: changed, saving: busy }; }, { immediate: true, flush: 'sync' });
const statusLabels = { active: '有效', disabled: '已停用', archived: '已归档' };
const treeNodes = computed(() => [{
  type: 'group', id: 'points', label: '知识点', actions: authorized.value ? { add: true } : false,
  children: points.value.map((item) => ({
    type: 'section', id: item.id, item,
    label: `${item.title || '未命名知识点'}${item.status && item.status !== 'active' ? ` · ${statusLabels[item.status] || item.status}` : ''}`
  }))
}]);

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
  try {
    const result = await knowledgeApi.manage();
    if (sequence !== listSequence) return;
    if (!Array.isArray(result)) throw new Error('知识点列表数据不完整');
    points.value = result;
  } catch (err) {
    if (sequence === listSequence) notify(err.message || '知识点列表加载失败', 'error');
  } finally {
    if (sequence === listSequence) loading.value = false;
  }
}
async function selectNode(node) {
  if (selecting.value || node.type !== 'section' || selectedKey.value === `section:${node.id}`) return;
  if (!await mayLeave()) return;
  const sequence = ++loadSequence;
  selecting.value = true;
  try {
    const result = await knowledgeApi.getManaged(node.id);
    if (sequence !== loadSequence) return;
    if (!result?.id || typeof result.source !== 'string') throw new Error('知识点数据不完整');
    point.value = result;
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
  if (!authorized.value || !point.value || !dirty.value || saving.value || selecting.value) return;
  const body = { title: point.value.title.trim(), source: point.value.source };
  if (!body.title || !body.source?.trim()) { notify('请填写标题和正文', 'warn'); return; }
  saving.value = true;
  try {
    const result = await knowledgeApi.update(point.value.id, body);
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
  try {
    const result = await knowledgeApi.create(body);
    if (!result?.id || typeof result.source !== 'string') throw new Error('创建响应不完整，请刷新列表');
    point.value = result;
    baseline.value = snapshot();
    selectedKey.value = `section:${result.id}`;
    treeRef.value?.expand('group', 'points');
    createOpen.value = false;
    createForm.value = { slug: '', title: '', source: '' };
    notify('知识点已创建', 'success');
    await loadList();
  } catch (err) { notify(err.message || '创建失败', 'error'); }
  finally { saving.value = false; }
}
async function changeStatus() {
  if (!authorized.value || !point.value || !statusTarget.value || saving.value || dirty.value) return;
  saving.value = true;
  try {
    const result = await knowledgeApi.setStatus(point.value.id, statusTarget.value);
    if (!result?.id || !result.status) throw new Error('状态响应不完整，请重新读取知识点');
    point.value = { ...point.value, ...result };
    statusTarget.value = '';
    notify('知识点状态已更新', 'success');
    await loadList();
  } catch (err) { notify(err.message || '更新状态失败', 'error'); }
  finally { saving.value = false; }
}
watch(authorized, (allowed) => { if (allowed) loadList(); }, { immediate: true });
onMounted(async () => { window.addEventListener('beforeunload', beforeUnload); await initAuth(); });
onUnmounted(() => {
  loadSequence++;
  listSequence++;
  finishLeave(false);
  workbenchPanelState.value = { dirty: false, saving: false };
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <div class="knowledge-workbench">
    <WorkbenchTree ref="treeRef" title="KNOWLEDGE WORKBENCH" refresh-label="刷新知识点" :nodes="treeNodes" :selected-key="selectedKey" :loading="loading" @select="selectNode" @refresh="authorized && loadList()" @add="openCreate" />
    <main class="workbench-main">
      <WorkbenchPanel v-if="point" kind="KNOWLEDGE" :title="point.title || '未命名知识点'" :dirty="dirty" :saving="saving || selecting" :editable="authorized" :can-save="dirty" @save="save" @reset="discard">
        <template #actions>
          <MButton v-if="authorized && point.status !== 'active'" size="sm" :disabled="saving || selecting || dirty" @click="statusTarget = 'active'">恢复</MButton>
          <MButton v-if="authorized && point.status === 'active'" size="sm" :disabled="saving || selecting || dirty" @click="statusTarget = 'disabled'">停用</MButton>
          <MButton v-if="authorized && point.status !== 'archived'" size="sm" :disabled="saving || selecting || dirty" @click="statusTarget = 'archived'">归档</MButton>
        </template>
        <div class="status-notice">状态：{{ statusLabels[point.status] || '未提供' }}。保存后立即生效，内容以最后一次成功保存为准。</div>
        <div class="wb-block" :inert="!authorized">
          <div class="wb-form-grid">
            <MInput v-model="point.title" label="知识点标题" required />
            <MInput :model-value="point.slug || ''" label="知识点标识" disabled />
          </div>
        </div>
        <div class="wb-block">
          <div class="wb-block-head"><span class="wb-block-title">知识点内容</span></div>
          <div class="content-layout">
            <MCodeEditor :key="authorized" v-model="point.source" label="Typst 源码" height="max(600px, calc(100vh - 300px))" :show-language="false" :readonly="!authorized" @save="authorized && save()" />
            <div class="preview-column"><div class="preview-heading">预览</div><div class="content-preview font-mono">COOMING SOON</div></div>
          </div>
        </div>
      </WorkbenchPanel>
      <div v-else class="workbench-empty"><span class="empty-label font-mono">KNOWLEDGE WORKBENCH</span><h2>{{ authorized ? '选择一个知识点' : '知识点工作台' }}</h2><p>{{ authorized ? '从左侧选择或新建知识点。' : '请使用超级管理员账号登录。' }}</p></div>
    </main>
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
.create-fields { display: flex; flex-direction: column; gap: 16px; }
@media (max-width: 900px) { .content-layout { grid-template-columns: minmax(0, 1fr); } .content-preview { min-height: 240px; } }
</style>
