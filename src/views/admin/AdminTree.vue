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
const expandedKeys = ref(new Set());

// 深度优先查找目标节点
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

// 查找目标节点的祖先链路
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

// 获取兄弟节点与自身索引
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

// 切换展开/折叠（纯前端同步切换，零网络延迟）
const toggle = (node) => {
  if (node.type === 'section') return;
  node.expanded = !node.expanded;
  const key = `${node.type}:${node.id}`;
  if (node.expanded) {
    expandedKeys.value.add(key);
  } else {
    expandedKeys.value.delete(key);
  }
};

// 展开目标节点及其所有祖先层级
const expandTo = async (type, id) => {
  const path = findPath(type, id);
  if (path) {
    for (const n of path) {
      n.expanded = true;
      expandedKeys.value.add(`${n.type}:${n.id}`);
    }
    return path[path.length - 1];
  }
  return null;
};

// 单接口一次性全量拉取整树，并保持既有展开状态
const reload = async () => {
  loading.value = true;
  try {
    const rawTree = await adminApi.tree();
    const tree = Array.isArray(rawTree) ? rawTree : [];

    // 默认或恢复展开状态
    const syncExpanded = (list) => {
      for (const item of list) {
        const key = `${item.type}:${item.id}`;
        if (expandedKeys.value.has(key)) {
          item.expanded = true;
        }
        if (item.children) syncExpanded(item.children);
      }
    };

    // 首次进入若无展开记录，默认展开第一个分类和其第一门课程
    if (expandedKeys.value.size === 0 && tree.length > 0) {
      tree[0].expanded = true;
      expandedKeys.value.add(`${tree[0].type}:${tree[0].id}`);
      if (tree[0].children?.[0]) {
        tree[0].children[0].expanded = true;
        expandedKeys.value.add(`${tree[0].children[0].type}:${tree[0].children[0].id}`);
      }
    }

    syncExpanded(tree);
    nodes.value = tree;
  } catch (err) {
    emit('error', err);
  } finally {
    loading.value = false;
  }
};

// 局部变更统一走单接口秒级同步刷新
const refreshCourse = async () => reload();
const refreshCategory = async () => reload();
const refreshForNode = async () => reload();

onMounted(async () => {
  await reload();
});

defineExpose({
  reload,
  refreshCourse,
  refreshCategory,
  findNode,
  findPath,
  getSiblings,
  refreshForNode,
  expandTo
});
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
            width="16"
            height="16"
            :class="{ 'spin-icon': loading }"
          />
        </button>
        <button
          class="head-icon-btn"
          type="button"
          title="新建分类"
          @click="emit('create-category')"
        >
          <FolderPlus width="16" height="16" />
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
  font-size: 15px;
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary);
  letter-spacing: 0.6px;
}

.tree-head-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.head-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
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
