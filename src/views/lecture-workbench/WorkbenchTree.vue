<script setup>
import { ref } from 'vue';
import { Refresh } from '@iconoir/vue';
import WorkbenchTreeNode from './WorkbenchTreeNode.vue';
import MButton from '../../components/MButton.vue';

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  selectedKey: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  title: { type: String, default: 'LECTURE WORKBENCH' },
  refreshLabel: { type: String, default: '刷新讲义' }
});
const emit = defineEmits(['select', 'expand', 'refresh', 'add', 'remove', 'move']);
const expandedKeys = ref(new Set());

function prepare(nodes) {
  return nodes.map((node) => ({
    ...node,
    expanded: expandedKeys.value.has(`${node.type}:${node.id}`),
    children: Array.isArray(node.children) ? prepare(node.children) : undefined
  }));
}

function toggle(node) {
  const key = `${node.type}:${node.id}`;
  const expanded = new Set(expandedKeys.value);
  if (expanded.has(key)) expanded.delete(key);
  else {
    expanded.add(key);
    emit('expand', node);
  }
  expandedKeys.value = expanded;
}

function expand(type, id) {
  expandedKeys.value = new Set(expandedKeys.value).add(`${type}:${id}`);
}

defineExpose({ expand });
</script>

<template>
  <aside class="workbench-tree">
    <header class="tree-head">
      <span class="tree-title font-mono">{{ title }}</span>
      <div class="tree-head-actions">
        <button class="head-icon-btn" type="button" :title="refreshLabel" :aria-label="refreshLabel" @click="emit('refresh')"><Refresh width="16" height="16" :class="{ 'spin-icon': loading }" /></button>
      </div>
    </header>
    <div class="tree-body">
      <div v-if="loading && !nodes.length" class="tree-empty font-mono">加载中...</div>
      <div v-else-if="!nodes.length" class="tree-empty"><p>暂无讲义</p><MButton size="sm" @click="emit('refresh')">重试</MButton></div>
      <WorkbenchTreeNode v-for="(node, index) in prepare(props.nodes)" :key="`${node.type}:${node.id}`" :node="node" :index="index" :sibling-count="nodes.length" :selected-key="selectedKey" @select="emit('select', $event)" @toggle="toggle" @add="emit('add', $event)" @remove="emit('remove', $event)" @move="emit('move', $event)" />
    </div>
  </aside>
</template>

<style scoped>
.workbench-tree {
  width: 324px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
}

.tree-head {
  height: 48px;
  flex-shrink: 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
}

.tree-title {
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  color: var(--text-muted);
  letter-spacing: 1px;
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
