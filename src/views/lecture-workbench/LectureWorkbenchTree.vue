<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Plus, Upload } from '@iconoir/vue';
import LectureTreeSection from './LectureTreeSection.vue';
import WorkbenchTreeNode from './WorkbenchTreeNode.vue';

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  selectedKey: { type: String, default: '' },
  listLoading: { type: Object, required: true },
  listErrors: { type: Object, required: true },
  showOnline: { type: Boolean, default: false }
});
const emit = defineEmits(['select', 'expand', 'refresh', 'add', 'remove', 'move', 'import', 'archive']);
const expandedKeys = ref(new Set());
const treeBody = ref(null);
const bodyHeight = ref(0);
const reducedMotion = ref(false);
let bodyObserver;
let motionPreference;
const sectionDuration = computed(() => reducedMotion.value ? 0 : Math.min(260, Math.round(200 + Math.max(0, bodyHeight.value - 400) * 0.075)));
const sectionRows = computed(() => {
  const header = 35;
  const available = Math.max(0, bodyHeight.value - header * 3);
  const groups = [{ id: 'local', weight: 3 }, { id: 'online', weight: 1 }, { id: 'archived', weight: 1 }];
  const weight = groups.reduce((sum, group) => sum + (expandedKeys.value.has(`group:${group.id}`) ? group.weight : 0), 0);
  return groups.map((group) => `${header + (weight && expandedKeys.value.has(`group:${group.id}`) ? available * group.weight / weight : 0)}px`).join(' ');
});
function updateMotionPreference() {
  reducedMotion.value = motionPreference.matches;
}
onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  updateMotionPreference();
  motionPreference.addEventListener('change', updateMotionPreference);
  bodyObserver = new ResizeObserver(([entry]) => { bodyHeight.value = entry.contentRect.height; });
  if (treeBody.value) bodyObserver.observe(treeBody.value);
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
const localNode = computed(() => prepare(props.nodes).find((node) => node.id === 'local'));
function toggle(node) {
  const key = `${node.type}:${node.id}`;
  const expanded = new Set(expandedKeys.value);
  if (expanded.has(key)) expanded.delete(key);
  else { expanded.add(key); emit('expand', node); }
  expandedKeys.value = expanded;
}
function expand(type, id) {
  expandedKeys.value = new Set(expandedKeys.value).add(`${type}:${id}`);
}
watch(() => props.showOnline, (showOnline) => {
  if (showOnline) expand('group', 'local');
});
defineExpose({ expand });
</script>

<template>
  <aside class="workbench-tree">
    <header class="tree-head">
      <span class="tree-title font-mono">LECTURE WORKBENCH</span>
      <button v-if="!showOnline && localNode?.actions?.import" class="head-action" type="button" title="导入本地讲义" aria-label="导入本地讲义" @click="emit('import', localNode)"><Upload width="16" height="16" /></button>
      <button v-if="!showOnline && localNode?.actions?.add" class="head-action" type="button" title="新建本地讲义" aria-label="新建本地讲义" @click="emit('add', localNode)"><Plus width="16" height="16" /></button>
    </header>
    <div ref="treeBody" class="tree-body" :class="{ 'is-single': !showOnline }" :style="showOnline ? { gridTemplateRows: sectionRows, '--section-duration': `${sectionDuration}ms` } : null">
      <template v-if="showOnline">
        <LectureTreeSection v-for="node in prepare(props.nodes)" :key="node.id" :node="node" :duration="sectionDuration" :selected-key="selectedKey" :loading="listLoading[node.id === 'archived' ? 'online' : node.id]" :error="listErrors[node.id === 'archived' ? 'online' : node.id]" @toggle="toggle" @select="emit('select', $event)" @add="emit('add', $event)" @remove="emit('remove', $event)" @move="emit('move', $event)" @import="emit('import', $event)" @archive="emit('archive', $event)" @retry="emit('refresh')" />
      </template>
      <div v-else-if="localNode" class="single-content">
        <p v-if="listLoading.local && !localNode.children.length" class="single-hint">正在加载本地讲义…</p>
        <p v-if="listErrors.local" class="single-error" role="alert">{{ listErrors.local }} <button type="button" @click="emit('refresh')">重试</button></p>
        <WorkbenchTreeNode v-for="(child, index) in localNode.children" :key="`${child.type}:${child.id}`" :node="child" :depth="1" :index="index" :sibling-count="localNode.children.length" :selected-key="selectedKey" @select="emit('select', $event)" @toggle="toggle" @add="emit('add', $event)" @remove="emit('remove', $event)" @move="emit('move', $event)" @import="emit('import', $event)" />
        <p v-if="!localNode.children.length && !listLoading.local && !listErrors.local" class="single-hint">暂无讲义 <button type="button" @click="emit('add', localNode)">新建本地讲义</button></p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.workbench-tree { width: min(324px, 100%); flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; background: var(--bg-sidebar); border-right: 1px solid var(--border-subtle); }
.tree-head { height: 48px; flex-shrink: 0; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); }
.tree-title { flex: 1; min-width: 0; font-size: var(--font-size-smaller); font-weight: var(--font-weight-semibold); color: var(--text-muted); letter-spacing: 1px; }
.head-action { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-secondary); cursor: pointer; }
.head-action:hover { background: var(--bg-hover); color: var(--text-primary); }
.head-action:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: -2px; }
.tree-body.is-single { display: block; }
.single-content { padding: 4px 4px 8px; }
.single-hint, .single-error { margin: 0; padding: 8px 12px; color: var(--text-muted); font-size: var(--font-size-smaller); line-height: 1.5; }
.single-error { color: var(--tag-red); }
.single-hint button, .single-error button { margin-left: 4px; border: 0; background: transparent; color: var(--accent-primary); cursor: pointer; }
.single-hint button:focus-visible, .single-error button:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: -2px; }
.tree-body { display: grid; flex: 1; min-height: 0; align-content: start; overflow-y: auto; transition: grid-template-rows var(--section-duration, 200ms) cubic-bezier(0.4, 0, 0, 1); }
@media (prefers-reduced-motion: reduce) { .tree-body { transition: none; } }
</style>
