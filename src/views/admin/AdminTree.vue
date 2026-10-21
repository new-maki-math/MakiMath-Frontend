<script setup>
import { onMounted, ref } from 'vue';
import { Refresh, FolderPlus } from '@iconoir/vue';
import { adminApi } from '../../api/admin.js';
import AdminTreeNode from './AdminTreeNode.vue';
import MButton from '../../components/MButton.vue';

const props = defineProps({
  selectedKey: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['select', 'add', 'remove', 'move', 'error', 'create-category']);

const nodes = ref([]);
const loading = ref(false);

const findNode = (type, id, list = nodes.value) => {
  for (const node of list) {
    if (node.type === type && node.id === id) return node;
    if (node.children) {
      const hit = findNode(type, id, node.children);
      if (hit) return hit;
    }
  }
  return null;
};

const loadCategories = async () => {
  const cats = await adminApi.categories.list();
  const previous = new Map(nodes.value.map((n) => [n.id, n]));
  nodes.value = cats.map((c) => {
    const old = previous.get(c.id);
    return {
      type: 'category',
      id: c.id,
      label: c.name,
      slug: c.slug,
      courseCount: c.course_count,
      children: old?.children ?? null,
      expanded: old?.expanded ?? false,
      loading: false
    };
  });
};

const loadCourses = async (node) => {
  const list = await adminApi.courses.list({ category_id: node.id });
  // 保留原有课程对象的已加载子树与展开状态，否则 reload 后整棵树会被收起
  const previous = new Map((node.children || []).map((c) => [c.id, c]));
  node.children = list.map((c) => {
    const old = previous.get(c.id);
    return {
      type: 'course',
      id: c.id,
      label: c.title,
      slug: c.slug,
      status: c.status,
      chapterCount: c.chapter_count,
      sectionCount: c.section_count,
      children: old?.children ?? null,
      expanded: old?.expanded ?? false,
      loading: false
    };
  });
};

const loadCourseTree = async (node) => {
  const tree = await adminApi.courses.tree(node.id);
  const previous = new Map((node.children || []).map((ch) => [ch.id, ch]));
  node.children = (tree.chapters || []).map((ch) => ({
    type: 'chapter',
    id: ch.id,
    label: ch.title,
    tag: ch.tag,
    slug: ch.slug,
    hasIntro: ch.has_intro,
    children: (ch.sections || []).map((s) => ({
      type: 'section',
      id: s.id,
      label: s.title,
      tag: s.tag,
      slug: s.slug,
      hasSource: s.has_source,
      sourceLen: s.source_len
    })),
    expanded: previous.get(ch.id)?.expanded ?? false,
    loading: false
  }));
};

const loadChildren = async (node) => {
  if (node.type === 'category') await loadCourses(node);
  else if (node.type === 'course') await loadCourseTree(node);
};

const toggle = async (node) => {
  if (node.type === 'section') return;
  if (node.type === 'chapter' || node.expanded) {
    node.expanded = !node.expanded;
    return;
  }

  node.expanded = true;
  if (node.children !== null) return;

  node.loading = true;
  try {
    await loadChildren(node);
  } catch (err) {
    node.expanded = false;
    emit('error', err);
  } finally {
    node.loading = false;
  }
};

// 展开指定节点，必要时先拉取子级
const expandTo = async (type, id) => {
  const node = findNode(type, id);
  if (!node) return null;
  if (!node.expanded) await toggle(node);
  return node;
};

// 重拉已展开的节点，保留展开状态
const reload = async () => {
  const loaded = [];
  const walk = (list) => {
    for (const node of list) {
      if (node.children && (node.type === 'category' || node.type === 'course')) {
        loaded.push({ type: node.type, id: node.id });
      }
      if (node.children) walk(node.children);
    }
  };
  walk(nodes.value);

  loading.value = true;
  try {
    await loadCategories();
  } catch (err) {
    emit('error', err);
    return;
  } finally {
    loading.value = false;
  }

  for (const item of loaded) {
    const node = findNode(item.type, item.id);
    if (!node) continue;
    try {
      await loadChildren(node);
      node.expanded = true;
    } catch {
      // 节点可能已被删除，忽略
    }
  }
};

// 只刷新某个课程的章 / 小节；课程自己的标题不在 children 里，改名时得单独同步
const refreshCourse = async (courseId, label) => {
  const node = findNode('course', courseId);
  if (!node) return;
  if (label) node.label = label;
  try {
    await loadCourseTree(node);
    node.expanded = true;
  } catch (err) {
    emit('error', err);
  }
};

// 只刷新某个分类下的课程；分类自己的名称不在 children 里，改名时得单独同步
const refreshCategory = async (categoryId, label) => {
  const node = findNode('category', categoryId);
  if (!node) return;
  if (label) node.label = label;
  try {
    await loadCourses(node);
    node.expanded = true;
  } catch (err) {
    emit('error', err);
  }
};

// 从根到目标节点的链路，用于定位祖先
const findPath = (type, id, list = nodes.value, trail = []) => {
  for (const node of list) {
    const next = [...trail, node];
    if (node.type === type && node.id === id) return next;
    if (node.children) {
      const hit = findPath(type, id, node.children, next);
      if (hit) return hit;
    }
  }
  return null;
};

// 同一父级下的兄弟列表与自身下标
const getSiblings = (type, id) => {
  const walk = (list, parent) => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (node.type === type && node.id === id) return { siblings: list, index: i, parent };
      if (node.children) {
        const hit = walk(node.children, node);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(nodes.value, null);
};

// 重拉目标节点所属的课程或分类，避免整棵树重载
const refreshForNode = async (type, id) => {
  const path = findPath(type, id);
  if (!path) {
    await reload();
    return;
  }
  const course = [...path].reverse().find((n) => n.type === 'course');
  if (course) {
    try {
      await loadCourseTree(course);
      course.expanded = true;
    } catch (err) {
      emit('error', err);
    }
    return;
  }
  const category = [...path].reverse().find((n) => n.type === 'category');
  if (category) {
    try {
      await loadCourses(category);
      category.expanded = true;
    } catch (err) {
      emit('error', err);
    }
  }
};

onMounted(async () => {
  loading.value = true;
  try {
    await loadCategories();
  } catch (err) {
    emit('error', err);
  } finally {
    loading.value = false;
  }
});

defineExpose({ reload, refreshCourse, refreshCategory, findNode, findPath, getSiblings, refreshForNode, expandTo });
</script>

<template>
  <aside class="admin-tree">
    <header class="tree-head">
      <span class="tree-title font-mono">知识库</span>
      <div class="tree-head-actions">
        <button
          class="head-icon-btn"
          type="button"
          title="刷新结构"
          @click="reload"
        >
          <Refresh
            width="13"
            height="13"
            :class="{ 'spin-icon': loading }"
          />
        </button>
        <button
          class="head-icon-btn"
          type="button"
          title="新建分类"
          @click="emit('create-category')"
        >
          <FolderPlus width="13" height="13" />
        </button>
      </div>
    </header>

    <div class="tree-body">
      <div
        v-if="loading && nodes.length === 0"
        class="tree-empty font-mono"
      >
        加载中...
      </div>
      <div
        v-else-if="nodes.length === 0"
        class="tree-empty"
      >
        <p>还没有任何分类。</p>
        <MButton
          variant="secondary"
          size="sm"
          :mono="true"
          @click="emit('create-category')"
        >
          新建分类
        </MButton>
      </div>

      <AdminTreeNode
        v-for="(node, idx) in nodes"
        v-else
        :key="`${node.type}:${node.id}`"
        :node="node"
        :depth="0"
        :selected-key="props.selectedKey"
        :index="idx"
        :sibling-count="nodes.length"
        @select="emit('select', $event)"
        @toggle="toggle"
        @add="emit('add', $event)"
        @remove="emit('remove', $event)"
        @move="emit('move', $event)"
      />
    </div>
  </aside>
</template>

<style scoped>
.admin-tree {
  width: 324px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
}

.tree-head {
  height: 44px;
  flex-shrink: 0;
  padding: 0 10px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
}

.tree-title {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  letter-spacing: 0.6px;
}

.tree-head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.head-icon-btn {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.head-icon-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.spin-icon {
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tree-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 8px 24px;
}

.tree-empty {
  padding: 24px 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}
</style>
