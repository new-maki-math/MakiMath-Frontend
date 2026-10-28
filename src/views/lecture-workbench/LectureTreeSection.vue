<script setup>
import { onUnmounted, ref, watch } from 'vue';
import { NavArrowRight, Plus, Upload } from '@iconoir/vue';
import MCollapse from '../../components/MCollapse.vue';
import WorkbenchTreeNode from './WorkbenchTreeNode.vue';

const props = defineProps({
  node: { type: Object, required: true },
  selectedKey: { type: String, default: '' },
  loading: Boolean,
  error: { type: String, default: '' },
  duration: { type: Number, default: 260 }
});
const emit = defineEmits(['toggle', 'select', 'add', 'remove', 'move', 'import', 'archive', 'retry']);
const contentOpen = ref(Boolean(props.node.expanded));
let closeTimer;
watch(() => props.node.expanded, (expanded) => {
  clearTimeout(closeTimer);
  if (expanded) contentOpen.value = true;
  else if (!props.duration) contentOpen.value = false;
  else closeTimer = setTimeout(() => { contentOpen.value = false; }, props.duration);
});
onUnmounted(() => clearTimeout(closeTimer));
</script>

<template>
  <section class="lecture-section">
    <header class="section-head">
      <button class="section-toggle" type="button" :aria-expanded="Boolean(node.expanded)" @click="emit('toggle', node)">
        <NavArrowRight class="section-caret" :class="{ 'is-open': node.expanded }" width="16" height="16" />
        <span>{{ node.label }}</span>
      </button>
      <button v-if="node.actions?.import" class="section-action" type="button" :title="`导入${node.label}`" :aria-label="`导入${node.label}`" @click="emit('import', node)"><Upload width="16" height="16" /></button>
      <button v-if="node.actions?.add" class="section-action" type="button" :title="`在${node.label}中新建课程`" :aria-label="`在${node.label}中新建课程`" @click="emit('add', node)"><Plus width="16" height="16" /></button>
    </header>
    <MCollapse class="section-collapse" :open="contentOpen" :duration="0" :fade="false">
      <div class="section-content" :inert="!node.expanded">
        <p v-if="loading" class="section-hint">正在加载{{ node.label }}…</p>
        <p v-if="error" class="section-error" role="alert">{{ error }} <button type="button" @click="emit('retry')">重试</button></p>
        <template v-if="!loading || node.children.length">
          <WorkbenchTreeNode v-for="(child, index) in node.children" :key="`${child.type}:${child.id}`" :node="child" :depth="1" :index="index" :sibling-count="node.children.length" :selected-key="selectedKey" @select="emit('select', $event)" @toggle="emit('toggle', $event)" @add="emit('add', $event)" @remove="emit('remove', $event)" @move="emit('move', $event)" @import="emit('import', $event)" @archive="emit('archive', $event)" />
          <p v-if="!node.children.length && !loading && !error" class="section-hint">暂无{{ node.label }} <button v-if="node.actions?.add" type="button" @click="emit('add', node)">新建课程</button></p>
        </template>
      </div>
    </MCollapse>
  </section>
</template>

<style scoped>
.lecture-section { display: flex; flex-direction: column; min-height: 0; overflow: hidden; box-sizing: border-box; border-bottom: 1px solid var(--border-subtle); }
.section-head { flex-shrink: 0; display: flex; align-items: center; min-height: 34px; }
.section-toggle { display: flex; align-items: center; justify-content: flex-start; flex: 1; min-width: 0; min-height: 34px; gap: 5px; padding: 0 8px; border: 0; background: transparent; color: var(--text-primary); text-align: left; font-size: var(--font-size-smaller); font-weight: var(--font-weight-semibold); cursor: pointer; }
.section-toggle:hover, .section-action:hover { background: var(--bg-hover); }
.section-action:hover:not(:focus-visible) { border: 0; outline: 0; box-shadow: none; }
.section-toggle:focus-visible, .section-action:focus-visible, .section-hint button:focus-visible, .section-error button:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: -2px; }
.section-caret { flex: none; color: var(--text-secondary); transition: transform 160ms ease; }
.section-caret.is-open { transform: rotate(90deg); }
.section-action { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 34px; height: 34px; border: 0; border-radius: 0; background: transparent; color: var(--text-secondary); cursor: pointer; }
.section-collapse { flex: 1 1 0; min-height: 0; }
.section-collapse :deep(.m-collapse-inner) { display: flex; flex-direction: column; }
.section-content { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 4px 8px; }
.section-hint, .section-error { margin: 0; padding: 8px 12px; color: var(--text-muted); font-size: var(--font-size-smaller); line-height: 1.5; }
.section-error { color: var(--tag-red); }
.section-hint button, .section-error button { margin-left: 4px; border: 0; background: transparent; color: var(--accent-primary); cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .section-caret { transition: none; } }
</style>
