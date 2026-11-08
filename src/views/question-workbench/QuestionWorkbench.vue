<script setup>
import '../../components/workbench/workbench.css';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { questionApi } from '../../api/questions.js';
import KnowledgeReferencePicker from '../../components/knowledge/KnowledgeReferencePicker.vue';
import MButton from '../../components/form/MButton.vue';
import MEmpty from '../../components/feedback/MEmpty.vue';
import MFilePicker from '../../components/form/MFilePicker.vue';
import MInput from '../../components/form/MInput.vue';
import MModal from '../../components/overlay/MModal.vue';
import { notify } from '../../components/feedback/MNotice.vue';
import MSelect from '../../components/form/MSelect.vue';
import TypstEditorPreview from '../../components/typst/TypstEditorPreview.vue';
import WorkbenchPanel from '../../components/workbench/WorkbenchPanel.vue';
import WorkbenchTree from '../../components/workbench/WorkbenchTree.vue';
import { useWorkbenchGuard } from '../../composables/useWorkbenchGuard.js';
import { authStatus, currentUser, initAuth } from '../../utils/auth.js';
import QuestionCategoryPicker from './QuestionCategoryPicker.vue';
import QuestionPicker from './QuestionPicker.vue';

const authorized = computed(
  () => authStatus.value === 'authenticated' && currentUser.value?.role === 'super_admin'
);
const categories = ref([]);
const pages = ref({});
const loading = ref(false);
const selecting = ref(false);
const saving = ref(false);
const saveUncertain = ref(false);
const selected = ref(null);
const form = ref(null);
const baseline = ref('');
const treeRef = ref(null);
const modal = ref('');
const modalForm = ref({});
const addTarget = ref(null);
const impact = ref(null);
const clearImpact = ref(null);
const clearStage = ref(0);
const knowledgeOpen = ref(false);
const activeSource = ref('stem_source');
const importFile = ref(null);
let epoch = 0;
let selectionSequence = 0;
let editingUserId = null;
const pageRequests = new Map();
const fields = [
  {
    key: 'stem_source',
    label: '题干'
  },
  {
    key: 'focus_source',
    label: '考点'
  },
  {
    key: 'solution_source',
    label: '解答'
  },
  {
    key: 'conclusion_source',
    label: '结论'
  },
  {
    key: 'pitfalls_source',
    label: '易错点'
  }
];
const dirty = computed(() =>
  Boolean(form.value && baseline.value && JSON.stringify(form.value) !== baseline.value)
);
const { leaveOpen, confirmLeave, finishLeave } = useWorkbenchGuard({
  dirty,
  saving,
  blocked: () => selecting.value
});
const categoryOptions = computed(() =>
  categories.value.map((category) => ({
    value: String(category.id),
    label: category.name
  }))
);
const treeNodes = computed(() => {
  const nodes = new Map(
    categories.value.map((category) => [
      category.id,
      {
        type: 'group',
        id: category.id,
        label: category.name,
        category,
        actionsOnHover: true,
        actions: {
          add: true,
          addLabel: '新建',
          import: true,
          remove: true,
          removeLabel: '删除分类'
        },
        children: []
      }
    ])
  );
  const roots = [];
  const orderedCategories = [...categories.value].sort((a, b) => a.pos - b.pos || a.id - b.id);
  for (const category of orderedCategories) {
    const node = nodes.get(category.id);
    const siblings = orderedCategories.filter((item) => item.parent_id === category.parent_id);
    const index = siblings.findIndex((item) => item.id === category.id);
    node.actions.move = true;
    node.actions.moveUpDisabled = saving.value || index <= 0;
    node.actions.moveDownDisabled = saving.value || index >= siblings.length - 1;
    const parent = nodes.get(category.parent_id);
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const category of categories.value) {
    const page = pages.value[category.id];
    if (!page) {
      continue;
    }
    const node = nodes.get(category.id);
    node.children.push(
      ...page.items.map((entry, index) => ({
        type: 'section',
        id: entry.id,
        label: entry.source_number || entry.slug,
        entry,
        actionsOnHover: true,
        actions: {
          move: true,
          moveUpDisabled: saving.value || index === 0,
          moveDownDisabled: saving.value || index >= page.total - 1,
          remove: true,
          removeLabel: '删除来源'
        }
      }))
    );
    if (page.items.length < page.total) {
      node.children.push({
        type: 'more',
        id: category.id,
        label: '加载更多',
        categoryId: category.id
      });
    }
  }
  const orphanPage = pages.value.orphaned;
  roots.push({
    type: 'group',
    id: 'orphaned',
    label: '无来源题目',
    actionsOnHover: true,
    actions: {
      remove: true,
      removeLabel: '清空无来源题目',
      removeDisabled: saving.value
    },
    children: [
      ...(orphanPage?.items || []).map((item) => ({
        type: 'orphan',
        id: item.id,
        label: item.slug,
        questionId: item.id
      })),
      ...(orphanPage && orphanPage.items.length < orphanPage.total
        ? [
            {
              type: 'more',
              id: 'orphaned',
              label: '加载更多'
            }
          ]
        : [])
    ]
  });
  return roots;
});
const selectedKey = computed(() => selected.value?.key || '');
function remember() {
  baseline.value = JSON.stringify(form.value);
}
function fail(error, fallback) {
  notify(
    error?.status === 409
      ? '数据冲突，请检查是否已存在或已被修改，当前编辑内容已保留'
      : error?.message || fallback,
    'error'
  );
}
async function loadCategories() {
  if (!authorized.value) {
    return;
  }
  const current = epoch;
  loading.value = true;
  try {
    const result = await questionApi.categories();
    if (current !== epoch) {
      return;
    }
    if (!Array.isArray(result)) {
      throw new Error('题库分类数据格式错误');
    }
    categories.value = result;
  } catch (error) {
    if (current === epoch) {
      fail(error, '题库分类加载失败');
    }
  } finally {
    if (current === epoch) {
      loading.value = false;
    }
  }
}
async function loadPage(id, append = false) {
  if (!authorized.value) {
    return;
  }
  const current = epoch;
  const key = id;
  if (append && pageRequests.has(key)) {
    return;
  }
  const token = {};
  pageRequests.set(key, token);
  const previous = pages.value[key];
  const offset = append ? previous?.items.length || 0 : 0;
  try {
    const result =
      id === 'orphaned'
        ? await questionApi.orphaned({
            limit: 50,
            offset
          })
        : await questionApi.entries({
            category_id: id,
            limit: 50,
            offset
          });
    if (current !== epoch || pageRequests.get(key) !== token) {
      return;
    }
    if (!Array.isArray(result?.items) || !Number.isSafeInteger(result?.pagination?.total)) {
      throw new Error('题目列表格式错误');
    }
    pages.value = {
      ...pages.value,
      [key]: {
        items: [...(append ? previous?.items || [] : []), ...result.items],
        total: result.pagination.total
      }
    };
  } catch (error) {
    if (current === epoch && pageRequests.get(key) === token) {
      fail(error, '题目列表加载失败');
    }
  } finally {
    if (pageRequests.get(key) === token) {
      pageRequests.delete(key);
    }
  }
}
async function refresh() {
  if (!authorized.value || saving.value) {
    return;
  }
  await loadCategories();
  await refreshPages();
}
async function refreshPages() {
  const valid = new Set(categories.value.map((item) => String(item.id)));
  const ids = Object.keys(pages.value).filter((id) => id === 'orphaned' || valid.has(id));
  await Promise.all(ids.map((id) => loadPage(id === 'orphaned' ? id : Number(id))));
}
async function moveNode({ node, delta }) {
  if (!authorized.value || saving.value) {
    return;
  }
  const context = epoch;
  const isCategory = node.type === 'group';
  const item = isCategory ? node.category : node.entry;
  if (!item) {
    return;
  }
  let neighbor;
  const categoryId = item.category_id;
  saving.value = true;
  try {
    if (isCategory) {
      const siblings = categories.value
        .filter((category) => category.parent_id === item.parent_id)
        .sort((a, b) => a.pos - b.pos || a.id - b.id);
      neighbor = siblings[siblings.findIndex((category) => category.id === item.id) + delta];
    } else {
      const page = pages.value[categoryId];
      const index = page?.items.findIndex((entry) => entry.id === item.id) ?? -1;
      if (index < 0) {
        throw new Error('题目列表已变化，请刷新后重试');
      }
      const neighborIndex = index + delta;
      neighbor = page.items[neighborIndex];
      if (!neighbor && neighborIndex >= 0 && neighborIndex < page.total) {
        const result = await questionApi.entries({
          category_id: categoryId,
          limit: 1,
          offset: neighborIndex
        });
        neighbor = result?.items?.[0];
      }
    }
    if (context !== epoch) {
      return;
    }
    if (!neighbor || !item.updated_at || !neighbor.updated_at) {
      throw new Error('排序信息已变化，请刷新后重试');
    }
    const body = {
      direction: delta < 0 ? 'up' : 'down',
      updated_at: item.updated_at,
      neighbor_id: neighbor.id,
      neighbor_updated_at: neighbor.updated_at
    };
    if (isCategory) {
      await questionApi.reorderCategory(item.id, body);
    } else {
      await questionApi.reorderEntry(item.id, body);
    }
    if (context !== epoch) {
      return;
    }
    if (isCategory) {
      await loadCategories();
    } else {
      const previousCount = pages.value[categoryId]?.items.length || 50;
      await loadPage(categoryId);
      while (
        context === epoch &&
        pages.value[categoryId]?.items.length <
          Math.min(previousCount, pages.value[categoryId]?.total)
      ) {
        const previousLength = pages.value[categoryId].items.length;
        await loadPage(categoryId, true);
        if (pages.value[categoryId]?.items.length <= previousLength) {
          break;
        }
      }
      if (selected.value?.entry?.category_id === categoryId) {
        const updated = pages.value[categoryId]?.items.find(
          (entry) => entry.id === selected.value.entry.id
        );
        if (updated) {
          selected.value.entry = updated;
        }
      }
    }
  } catch (error) {
    if (context === epoch) {
      fail(error, '排序失败');
      if (isCategory) {
        await loadCategories();
      } else {
        await loadPage(categoryId);
      }
    }
  } finally {
    saving.value = false;
  }
}
function expand(node) {
  if (node.type === 'group' && !pages.value[node.id]) {
    loadPage(node.id);
  }
}
async function select(node) {
  if (node.type === 'group') {
    treeRef.value?.toggle(node);
    return;
  }
  if (node.type === 'more') {
    await loadPage(node.id, true);
    return;
  }
  if (selectedKey.value === `${node.type}:${node.id}`) {
    return;
  }
  if (!(await confirmLeave())) {
    return;
  }
  const current = ++selectionSequence;
  const context = epoch;
  selecting.value = true;
  try {
    const result = await questionApi.detail(node.entry?.question_id ?? node.questionId);
    if (current !== selectionSequence || context !== epoch) {
      return;
    }
    if (
      !result?.question ||
      typeof result.question.focus_source !== 'string' ||
      !Array.isArray(result.knowledge_points) ||
      !Array.isArray(result.sources)
    ) {
      throw new Error('题目详情格式错误');
    }
    selected.value = {
      type: 'question',
      id: result.question.id,
      key: `${node.type}:${node.id}`,
      slug: result.question.slug,
      updated_at: result.question.updated_at,
      sources: result.sources,
      entry: node.entry || null
    };
    form.value = {
      difficulty: String(result.question.difficulty),
      stem_source: result.question.stem_source || '',
      focus_source: result.question.focus_source || '',
      solution_source: result.question.solution_source || '',
      conclusion_source: result.question.conclusion_source || '',
      pitfalls_source: result.question.pitfalls_source || '',
      knowledge_slugs: result.knowledge_points.map((point) => point.slug)
    };
    activeSource.value = 'stem_source';
    saveUncertain.value = false;
    remember();
    editingUserId = currentUser.value?.id;
  } catch (error) {
    if (context === epoch) {
      fail(error, '题目详情加载失败');
    }
  } finally {
    if (current === selectionSequence) {
      selecting.value = false;
    }
  }
}
async function newQuestion(category) {
  if (!authorized.value || !(await confirmLeave())) {
    return;
  }
  selected.value = {
    type: 'new-question',
    id: category.id,
    key: '',
    categoryName: category.name
  };
  editingUserId = currentUser.value?.id;
  form.value = {
    slug: '',
    source_number: '',
    difficulty: '3',
    stem_source: '',
    focus_source: '',
    solution_source: '',
    conclusion_source: '',
    pitfalls_source: '',
    knowledge_slugs: []
  };
  baseline.value = JSON.stringify({});
  activeSource.value = 'stem_source';
  saveUncertain.value = false;
}
function reset() {
  if (selected.value?.type === 'new-question') {
    selected.value = null;
    form.value = null;
    baseline.value = '';
  } else {
    form.value = JSON.parse(baseline.value);
  }
}
async function save() {
  if (!authorized.value || saving.value || saveUncertain.value || !form.value || !selected.value) {
    return;
  }
  const type = selected.value.type;
  const copy = JSON.parse(JSON.stringify(form.value));
  if (!copy.stem_source.trim() || (type === 'new-question' && !copy.slug.trim())) {
    return notify('请填写题目标识和题干', 'warn');
  }
  const context = epoch;
  saving.value = true;
  try {
    const body = {
      difficulty: Number(copy.difficulty),
      stem_source: copy.stem_source,
      focus_source: copy.focus_source,
      solution_source: copy.solution_source,
      conclusion_source: copy.conclusion_source,
      pitfalls_source: copy.pitfalls_source,
      knowledge_slugs: copy.knowledge_slugs
    };
    const result =
      type === 'new-question'
        ? await questionApi.create({
            ...body,
            slug: copy.slug.trim(),
            category_id: selected.value.id,
            source_number: copy.source_number.trim()
          })
        : await questionApi.update(selected.value.id, {
            ...body,
            updated_at: selected.value.updated_at
          });
    if (context !== epoch) {
      return;
    }
    if (result?.question?.focus_source !== copy.focus_source) {
      saveUncertain.value = true;
      notify('保存结果中的考点不一致，请保留内容并刷新核对，避免重复提交', 'warn');
      return;
    }
    if (type === 'new-question') {
      const categoryId = selected.value.id;
      selected.value = null;
      form.value = null;
      baseline.value = '';
      await loadPage(categoryId);
      treeRef.value?.expand('group', categoryId);
    } else {
      selected.value.updated_at = result.question.updated_at;
      selected.value.sources = result.sources;
      remember();
      await refreshPages();
    }
    notify('保存成功', 'success');
  } catch (error) {
    if (context === epoch) {
      fail(error, '保存失败');
    }
  } finally {
    saving.value = false;
  }
}
function openCategory(parentId = '') {
  modalForm.value = {
    name: '',
    slug: '',
    parent_id: String(parentId),
    pos: '0'
  };
  modal.value = 'category';
}
function openAdd(category) {
  if (!authorized.value || saving.value || !category) {
    return;
  }
  addTarget.value = category;
  modal.value = 'choose-add';
}
function chooseAdd(type) {
  const category = addTarget.value;
  modal.value = '';
  addTarget.value = null;
  if (!category) {
    return;
  }
  if (type === 'category') {
    openCategory(category.id);
  } else if (type === 'entry') {
    openEntry(null, category);
  } else {
    newQuestion(category);
  }
}
function openImport(category) {
  if (!authorized.value || saving.value || !category) {
    return;
  }
  modalForm.value = {
    category_id: category.id
  };
  importFile.value = null;
  modal.value = 'import';
}
async function openEntry(entry = null, category = null) {
  if (entry && !(await confirmLeave())) {
    return;
  }
  modalForm.value = {
    question_slug: category ? '' : selected.value?.slug || '',
    fixed_category: Boolean(category),
    category_id: String(entry?.category_id ?? category?.id ?? ''),
    source_number: entry?.source_number || '',
    pos: String(entry?.pos ?? 0),
    updated_at: entry?.updated_at
  };
  modal.value = entry ? 'edit-entry' : 'entry';
}
async function removeTarget(node) {
  if (!authorized.value || saving.value) {
    return;
  }
  if (!(await confirmLeave())) {
    return;
  }
  const context = epoch;
  saving.value = true;
  try {
    const result =
      node.type === 'group'
        ? await questionApi.categoryImpact(node.id)
        : await questionApi.impact(node.questionId || node.entry?.question_id || node.id);
    if (context !== epoch) {
      return;
    }
    impact.value = {
      node,
      result
    };
    modal.value = node.type === 'group' ? 'delete-category' : 'delete-question';
  } catch (error) {
    if (context === epoch) {
      fail(error, '无法获取删除影响');
    }
  } finally {
    saving.value = false;
  }
}
async function removeEntry(entry) {
  if (!(await confirmLeave())) {
    return;
  }
  impact.value = {
    entry
  };
  modal.value = 'delete-entry';
}
async function openClearOrphaned() {
  if (!authorized.value || saving.value) {
    return;
  }
  if (selected.value?.key?.startsWith('orphan:') && !(await confirmLeave())) {
    return;
  }
  const context = epoch;
  saving.value = true;
  try {
    const result = await questionApi.orphaned({
      limit: 1,
      offset: 0
    });
    if (context !== epoch) {
      return;
    }
    if (!Number.isSafeInteger(result?.pagination?.total) || result.pagination.total < 0) {
      throw new Error('清空预览数据格式错误');
    }
    if (!result.pagination.total) {
      notify('没有无来源题目', 'info');
      await loadPage('orphaned');
      return;
    }
    clearImpact.value = {
      count: result.pagination.total
    };
    clearStage.value = 0;
    modal.value = 'clear-orphaned';
  } catch (error) {
    if (context === epoch) {
      fail(error, '无法获取清空范围');
    }
  } finally {
    saving.value = false;
  }
}
function closeClearOrphaned() {
  if (saving.value) {
    return;
  }
  modal.value = '';
  clearImpact.value = null;
  clearStage.value = 0;
}
async function confirmClearOrphaned() {
  if (!authorized.value || saving.value || !clearImpact.value) {
    return;
  }
  if (clearStage.value < 2) {
    clearStage.value++;
    return;
  }
  const context = epoch;
  saving.value = true;
  try {
    const result = await questionApi.clearOrphaned();
    if (context !== epoch) {
      return;
    }
    if (!Number.isSafeInteger(result?.deleted)) {
      throw new Error('清空结果不完整，请刷新核对');
    }
    if (selected.value?.key?.startsWith('orphan:')) {
      selected.value = null;
      form.value = null;
      baseline.value = '';
    }
    modal.value = '';
    clearImpact.value = null;
    await loadPage('orphaned');
    notify(`已清空 ${result.deleted} 个无来源题目`, 'success');
  } catch (error) {
    if (context === epoch) {
      modal.value = '';
      clearImpact.value = null;
      notify('清空结果未确认，请刷新列表核对后重试', 'warn');
      await loadPage('orphaned');
    }
  } finally {
    saving.value = false;
  }
}
async function confirmModal() {
  if (!authorized.value || saving.value) {
    return;
  }
  const context = epoch;
  const action = modal.value;
  const values = {
    ...modalForm.value
  };
  saving.value = true;
  try {
    if (action === 'category') {
      if (!values.name.trim() || !values.slug.trim()) {
        return notify('请填写分类名称和分类标识', 'warn');
      }
      await questionApi.createCategory({
        name: values.name.trim(),
        slug: values.slug.trim(),
        parent_id: values.parent_id ? Number(values.parent_id) : null
      });
      if (context === epoch) {
        await loadCategories();
        if (values.parent_id) {
          treeRef.value?.expand('group', Number(values.parent_id));
          if (!pages.value[values.parent_id]) {
            await loadPage(Number(values.parent_id));
          }
        }
      }
    } else if (action === 'entry' || action === 'edit-entry') {
      if (!values.category_id || (action === 'entry' && !values.question_slug.trim())) {
        return notify('请选择分类并填写题目标识', 'warn');
      }
      if (action === 'entry') {
        await questionApi.createEntry({
          category_id: Number(values.category_id),
          question_slug: values.question_slug.trim()
        });
      } else {
        await questionApi.updateEntry(selected.value.entry.id, {
          category_id: Number(values.category_id),
          source_number: values.source_number.trim(),
          pos: Number(values.pos),
          updated_at: values.updated_at
        });
      }
      if (context === epoch) {
        if (action === 'edit-entry') {
          selected.value = null;
          form.value = null;
          baseline.value = '';
        }
        await refreshPages();
        if (
          action === 'entry' &&
          selected.value?.type === 'question' &&
          selected.value.slug === values.question_slug.trim()
        ) {
          try {
            const detail = await questionApi.detail(selected.value.id);
            if (context === epoch && selected.value?.id === detail.question?.id) {
              selected.value.sources = detail.sources;
            }
          } catch {
            notify('来源已添加，详情刷新失败', 'warn');
          }
        }
      }
    } else if (action === 'delete-category') {
      await questionApi.deleteCategory(impact.value.node.id);
      if (context === epoch) {
        selected.value = null;
        form.value = null;
        baseline.value = '';
        await loadCategories();
        await refreshPages();
      }
    } else if (action === 'delete-question') {
      await questionApi.remove(
        impact.value.node.questionId || impact.value.node.entry?.question_id || impact.value.node.id
      );
      if (context === epoch) {
        selected.value = null;
        form.value = null;
        baseline.value = '';
        await refreshPages();
      }
    } else if (action === 'delete-entry') {
      await questionApi.deleteEntry(impact.value.entry.id);
      if (context === epoch) {
        selected.value = null;
        form.value = null;
        baseline.value = '';
        await refreshPages();
      }
    } else if (action === 'import') {
      if (!importFile.value) {
        return notify('请选择 JSON 文件', 'warn');
      }
      let data;
      try {
        data = JSON.parse(await importFile.value.text());
      } catch {
        return notify('JSON 文件格式错误', 'error');
      }
      if (new TextEncoder().encode(JSON.stringify(data)).length > 32 * 1024 * 1024) {
        return notify('导入数据不能超过 32 MiB', 'warn');
      }
      if (context !== epoch || !authorized.value) {
        return;
      }
      await questionApi.import({
        category_id: Number(values.category_id),
        data
      });
      if (context === epoch) {
        await loadCategories();
        await refreshPages();
      }
    }
    if (context === epoch) {
      modal.value = '';
      impact.value = null;
      notify('操作成功', 'success');
    }
  } catch (error) {
    if (context === epoch) {
      fail(error, '操作失败');
    }
  } finally {
    saving.value = false;
  }
}
function addKnowledge(slug) {
  if (form.value && !form.value.knowledge_slugs.includes(slug)) {
    form.value.knowledge_slugs.push(slug);
  }
  knowledgeOpen.value = false;
}
watch(
  [authStatus, () => currentUser.value?.id],
  () => {
    epoch++;
    selectionSequence++;
    selecting.value = false;
    categories.value = [];
    pages.value = {};
    pageRequests.clear();
    modal.value = '';
    if (authorized.value) {
      if (editingUserId != null && editingUserId !== currentUser.value?.id) {
        selected.value = null;
        form.value = null;
        baseline.value = '';
      }
      loadCategories();
    }
  },
  {
    immediate: true
  }
);
initAuth();
onBeforeUnmount(() => {
  epoch++;
  selectionSequence++;
});
</script>

<template>
  <div class="question-workbench">
    <WorkbenchTree
      ref="treeRef"
      class="question-tree"
      title="QUESTION WORKBENCH"
      :nodes="authorized ? treeNodes : []"
      :loading="loading"
      :selected-key="selectedKey"
      :add-label="authorized ? '新建顶级分类' : ''"
      :show-refresh="authorized"
      refresh-label="刷新题库"
      empty-text="请使用超级管理员账号登录"
      @refresh="refresh"
      @add-root="openCategory()"
      @expand="expand"
      @select="select"
      @add="openAdd($event.category)"
      @import="openImport($event.category)"
      @move="moveNode"
      @remove="
        $event.id === 'orphaned'
          ? openClearOrphaned()
          : $event.type === 'group'
            ? removeTarget($event)
            : removeEntry($event.entry)
      "
    />
    <main class="workbench-main">
      <WorkbenchPanel
        v-if="form && selected && authorized"
        kind="QUESTION"
        :title="selected.type === 'new-question' ? '新建题目' : selected.slug"
        :dirty="dirty"
        :saving="saving"
        :can-save="!saveUncertain"
        @save="save"
        @reset="reset"
      >
        <p
          v-if="saveUncertain"
          class="muted"
        >
          保存结果尚未确认，请保留当前内容并刷新核对。
        </p>
        <template #actions>
          <template v-if="selected.type === 'question'">
            <MButton
              size="sm"
              @click="openEntry()"
              >添加来源</MButton
            >
            <MButton
              v-if="selected.entry"
              size="sm"
              @click="openEntry(selected.entry)"
              >编辑来源</MButton
            >
            <MButton
              size="sm"
              variant="danger"
              @click="
                removeTarget({
                  id: selected.id,
                  questionId: selected.id
                })
              "
              >删除题目</MButton
            >
          </template>
        </template>
        <div class="wb-form-grid">
          <MInput
            v-if="selected.type === 'new-question'"
            v-model="form.slug"
            label="题目标识"
            hint="创建后不可修改"
            required
          />
          <MInput
            v-if="selected.type === 'new-question'"
            v-model="form.source_number"
            label="来源题号"
          />
          <MSelect
            v-model="form.difficulty"
            label="难度"
            :options="
              [1, 2, 3, 4, 5].map((n) => ({
                value: String(n),
                label: String(n)
              }))
            "
          />
        </div>
        <div class="wb-block">
          <div class="wb-block-head">
            <span class="wb-block-title">关联知识点</span
            ><MButton
              size="sm"
              @click="knowledgeOpen = true"
              >添加</MButton
            >
          </div>
          <div class="wb-row">
            <span
              v-for="slug in form.knowledge_slugs"
              :key="slug"
              class="knowledge-item"
              >{{ slug }}
              <button
                type="button"
                :aria-label="`移除 ${slug}`"
                @click="form.knowledge_slugs = form.knowledge_slugs.filter((item) => item !== slug)"
              >
                ×
              </button></span
            >
            <span
              v-if="!form.knowledge_slugs.length"
              class="muted"
              >未关联知识点</span
            >
          </div>
        </div>
        <div
          v-if="selected.type === 'question'"
          class="wb-block"
        >
          <div class="wb-block-title">来源</div>
          <p
            v-for="source in selected.sources"
            :key="source.entry_id"
            class="source-line"
          >
            {{ source.path.map((item) => item.name).join(' / ')
            }}{{ source.source_number ? ` · ${source.source_number}` : '' }}
          </p>
          <span
            v-if="!selected.sources.length"
            class="muted"
            >暂无来源</span
          >
        </div>
        <div class="wb-block">
          <div class="source-tabs">
            <MButton
              v-for="field in fields"
              :key="field.key"
              size="sm"
              :variant="activeSource === field.key ? 'primary' : 'ghost'"
              @click="activeSource = field.key"
              >{{ field.label }}</MButton
            >
          </div>
          <TypstEditorPreview
            :key="activeSource"
            v-model="form[activeSource]"
            :editable="true"
            :allow-question-references="false"
            @save="save"
          />
        </div>
      </WorkbenchPanel>
      <MEmpty
        v-else
        class="workbench-empty"
        :description="authorized ? '从左侧选择分类或题目' : '请使用超级管理员账号登录'"
      />
    </main>
    <KnowledgeReferencePicker
      :open="knowledgeOpen"
      @close="knowledgeOpen = false"
      @select="addKnowledge"
    />
    <MModal
      :open="modal === 'choose-add'"
      title="新建"
      :hide-footer="true"
      :show-close="true"
      @close="
        modal = '';
        addTarget = null;
      "
    >
      <p class="muted">在“{{ addTarget?.name }}”下新建</p>
      <div class="add-choices">
        <MButton @click="chooseAdd('category')">新建子分类</MButton>
        <MButton @click="chooseAdd('question')">新建题目</MButton>
        <MButton @click="chooseAdd('entry')">关联题目</MButton>
      </div>
    </MModal>
    <MModal
      :open="modal === 'category'"
      title="新建分类"
      :busy="saving"
      @close="modal = ''"
      @confirm="confirmModal"
    >
      <div class="modal-fields">
        <MInput
          v-model="modalForm.name"
          label="分类名称"
          required
        />
        <MInput
          v-model="modalForm.slug"
          label="分类标识"
          hint="创建后不可修改"
          required
        />
        <p class="muted">
          {{
            modalForm.parent_id
              ? `父分类：${categories.find((item) => String(item.id) === modalForm.parent_id)?.name || ''}`
              : '顶级分类'
          }}
        </p>
      </div>
    </MModal>
    <MModal
      :open="modal === 'entry' || modal === 'edit-entry'"
      :title="
        modalForm.fixed_category ? '关联题目' : modal === 'entry' ? '添加题目来源' : '编辑题目来源'
      "
      :height="modal === 'entry' ? 'min(600px, calc(100vh - 96px))' : ''"
      :busy="saving"
      @close="modal = ''"
      @confirm="confirmModal"
    >
      <div class="modal-fields">
        <QuestionPicker
          v-if="modalForm.fixed_category"
          v-model="modalForm.question_slug"
          :open="modal === 'entry'"
          :disabled="saving"
        />
        <QuestionCategoryPicker
          v-if="modal === 'entry' && !modalForm.fixed_category"
          :open="true"
          :disabled="saving"
          @select="modalForm.category_id = $event === null ? '' : String($event)"
        />
        <MSelect
          v-if="modal === 'edit-entry'"
          v-model="modalForm.category_id"
          label="来源分类"
          :options="[
            {
              value: '',
              label: '请选择分类'
            },
            ...categoryOptions
          ]"
        />
        <MInput
          v-if="modal === 'edit-entry'"
          v-model="modalForm.source_number"
          label="来源题号"
        />
        <MInput
          v-if="modal === 'edit-entry'"
          v-model="modalForm.pos"
          label="排序"
          type="number"
        />
      </div>
    </MModal>
    <MModal
      :open="modal === 'import'"
      title="导入题目"
      :busy="saving"
      confirm-text="导入"
      @close="modal = ''"
      @confirm="confirmModal"
    >
      <p class="muted">
        导入到
        {{ categories.find((item) => item.id === Number(modalForm.category_id))?.name }}，数据最大
        32 MiB。
      </p>
      <MFilePicker
        :title="importFile?.name || 'JSON 文件'"
        detail="选择符合导入格式的文件"
        :action="importFile ? '重新选择' : '选择文件'"
        accept=".json,application/json"
        :disabled="saving"
        @change="importFile = $event.target.files[0] || null"
      />
    </MModal>
    <MModal
      :open="modal === 'clear-orphaned'"
      title="清空无来源题目"
      :confirm-text="clearStage === 2 ? '确认永久清空' : `继续确认 ${clearStage + 1} / 3`"
      confirm-variant="danger"
      :busy="saving"
      @close="closeClearOrphaned"
      @confirm="confirmClearOrphaned"
    >
      <p>
        当前有
        {{ clearImpact?.count }}
        个无来源题目。数量可能变化，执行时所有仍无来源的题目及其知识点关联都会被永久删除，无法撤销。知识点本身不会删除，图书中的相关引用会显示缺失。
      </p>
      <p>第 {{ clearStage + 1 }} 次确认，共 3 次。</p>
    </MModal>
    <MModal
      :open="modal === 'delete-category' || modal === 'delete-question' || modal === 'delete-entry'"
      title="确认删除"
      confirm-text="永久删除"
      confirm-variant="danger"
      :busy="saving"
      @close="modal = ''"
      @confirm="confirmModal"
    >
      <p v-if="modal === 'delete-category'">
        将删除 {{ impact?.result?.categories }} 个分类和
        {{ impact?.result?.entries }} 个来源，题目本身会保留。
      </p>
      <p v-else-if="modal === 'delete-question'">
        将永久删除题目及其所有来源和知识点关联，已有图书引用将无法显示该题目。
      </p>
      <p v-else>将删除此来源，题目本身会保留。</p>
    </MModal>
    <MModal
      :open="leaveOpen"
      title="放弃未保存的修改"
      desc="离开后当前修改将丢失"
      confirm-text="放弃修改"
      confirm-variant="danger"
      @close="finishLeave(false)"
      @confirm="finishLeave(true)"
    />
  </div>
</template>

<style scoped>
.question-workbench {
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.workbench-main {
  display: flex;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.workbench-empty {
  flex: 1;
}
.modal-fields {
  display: grid;
  gap: 16px;
}
.modal-fields:has(.picker) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
.add-choices {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.source-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.source-line {
  margin: 0;
  color: var(--text-secondary);
}
.muted {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.knowledge-item {
  padding: 4px 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}
.knowledge-item button {
  margin-left: 4px;
  color: var(--text-secondary);
}
</style>
