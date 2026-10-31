<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

import LectureTreeSection from './LectureTreeSection.vue';

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  selectedKey: {
    type: String,
    default: ''
  },
  listLoading: {
    type: Object,
    required: true
  },
  listErrors: {
    type: Object,
    required: true
  },
  showOnline: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits([
  'select',
  'expand',
  'refresh',
  'add',
  'remove',
  'move',
  'import',
  'archive'
]);
const expandedKeys = ref(new Set(['group:local']));
const treeBody = ref(null);
const bodyHeight = ref(0);
const reducedMotion = ref(false);
let bodyObserver;
let motionPreference;
const sectionDuration = computed(() =>
  reducedMotion.value
    ? 0
    : Math.min(260, Math.round(200 + Math.max(0, bodyHeight.value - 400) * 0.075))
);
const visibleNodes = computed(() =>
  props.showOnline ? props.nodes : props.nodes.filter((node) => node.id === 'local')
);
const sectionRows = computed(() => {
  const header = 35;
  const groups = visibleNodes.value.map((node) => ({
    id: node.id,
    weight: node.id === 'local' ? 3 : 1
  }));
  const available = Math.max(0, bodyHeight.value - header * groups.length);
  const weight = groups.reduce(
    (sum, group) => sum + (expandedKeys.value.has(`group:${group.id}`) ? group.weight : 0),
    0
  );
  return groups
    .map(
      (group) =>
        `${header + (weight && expandedKeys.value.has(`group:${group.id}`) ? (available * group.weight) / weight : 0)}px`
    )
    .join(' ');
});
function updateMotionPreference() {
  reducedMotion.value = motionPreference.matches;
}
onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  updateMotionPreference();
  motionPreference.addEventListener('change', updateMotionPreference);
  bodyObserver = new ResizeObserver(([entry]) => {
    bodyHeight.value = entry.contentRect.height;
  });
  if (treeBody.value) {
    bodyObserver.observe(treeBody.value);
  }
});
onUnmounted(() => {
  bodyObserver?.disconnect();
  motionPreference?.removeEventListener('change', updateMotionPreference);
});

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
  if (expanded.has(key)) {
    expanded.delete(key);
  } else {
    expanded.add(key);
    emit('expand', node);
  }
  expandedKeys.value = expanded;
}
function expand(type, id) {
  expandedKeys.value = new Set(expandedKeys.value).add(`${type}:${id}`);
}
defineExpose({
  expand
});
</script>

<template>
  <aside class="workbench-tree">
    <header class="tree-head">
      <span class="tree-title font-mono">LECTURE WORKBENCH</span>
    </header>
    <div
      ref="treeBody"
      class="tree-body"
      :style="{
        gridTemplateRows: sectionRows,
        '--section-duration': `${sectionDuration}ms`
      }"
    >
      <LectureTreeSection
        v-for="node in prepare(visibleNodes)"
        :key="node.id"
        :node="node"
        :duration="sectionDuration"
        :selected-key="selectedKey"
        :loading="listLoading[node.id === 'archived' ? 'online' : node.id]"
        :error="listErrors[node.id === 'archived' ? 'online' : node.id]"
        @toggle="toggle"
        @select="emit('select', $event)"
        @add="emit('add', $event)"
        @remove="emit('remove', $event)"
        @move="emit('move', $event)"
        @import="emit('import', $event)"
        @archive="emit('archive', $event)"
        @retry="emit('refresh')"
      />
    </div>
  </aside>
</template>

<style scoped>
.workbench-tree {
  width: min(324px, 100%);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-sidebar);
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
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  color: var(--text-muted);
  letter-spacing: 1px;
}
.tree-body {
  display: grid;
  flex: 1;
  min-height: 0;
  align-content: start;
  overflow-y: auto;
  transition: grid-template-rows var(--section-duration, 200ms) cubic-bezier(0.4, 0, 0, 1);
}
@media (prefers-reduced-motion: reduce) {
  .tree-body {
    transition: none;
  }
}
</style>
