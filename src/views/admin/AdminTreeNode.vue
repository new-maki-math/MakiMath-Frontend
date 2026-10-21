<script setup>
import { computed } from 'vue';
import {
  NavArrowRight,
  NavArrowUp,
  NavArrowDown,
  Page,
  Plus,
  Trash
} from '@iconoir/vue';
import MCollapse from '../../components/MCollapse.vue';

defineOptions({ name: 'AdminTreeNode' });

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  selectedKey: {
    type: String,
    default: ''
  },
  /** 在兄弟节点中的下标，用于判断能否上移 / 下移 */
  index: {
    type: Number,
    default: 0
  },
  siblingCount: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['select', 'toggle', 'add', 'remove', 'move']);

const isSelected = computed(() => `${props.node.type}:${props.node.id}` === props.selectedKey);
const isBranch = computed(() => props.node.type !== 'section');
const indent = computed(() => `${10 + props.depth * 18}px`);
const childIndent = computed(() => `${10 + (props.depth + 1) * 18}px`);
const isEmpty = computed(() => props.node.children && props.node.children.length === 0);
const canMoveUp = computed(() => props.index > 0);
const canMoveDown = computed(() => props.index < props.siblingCount - 1);
</script>

<template>
  <div class="tree-node">
    <div
      class="node-row"
      :class="[`type-${node.type}`, { 'is-selected': isSelected }]"
      :style="{ paddingLeft: indent }"
      @click="emit('select', node)"
    >
      <button
        v-if="isBranch"
        class="node-caret"
        :class="{ 'is-open': node.expanded }"
        type="button"
        :title="node.expanded ? '收起' : '展开'"
        @click.stop="emit('toggle', node)"
      >
        <NavArrowRight width="12" height="12" />
      </button>
      <span v-else class="node-caret is-leaf"></span>

      <!-- 仅小节显示图标，其余层级不占位，标题紧跟展开箭头 -->
      <Page
        v-if="node.type === 'section'"
        class="node-icon"
        width="15"
        height="15"
      />

      <span class="node-label">{{ node.label }}</span>

      <span
        v-if="node.type === 'section' && !node.hasSource"
        class="node-flag font-mono"
      >空</span>

      <span class="node-actions">
        <button
          class="node-action"
          type="button"
          title="上移"
          :disabled="!canMoveUp"
          @click.stop="emit('move', { node, delta: -1 })"
        >
          <NavArrowUp width="12" height="12" />
        </button>
        <button
          class="node-action"
          type="button"
          title="下移"
          :disabled="!canMoveDown"
          @click.stop="emit('move', { node, delta: 1 })"
        >
          <NavArrowDown width="12" height="12" />
        </button>
        <button
          v-if="isBranch"
          class="node-action"
          type="button"
          title="新建子项"
          @click.stop="emit('add', node)"
        >
          <Plus width="12" height="12" />
        </button>
        <button
          class="node-action is-danger"
          type="button"
          title="删除"
          @click.stop="emit('remove', node)"
        >
          <Trash width="12" height="12" />
        </button>
      </span>
    </div>

    <MCollapse
      v-if="isBranch"
      :open="Boolean(node.expanded)"
    >
      <div class="node-children">
        <AdminTreeNode
          v-for="(child, childIdx) in node.children || []"
          :key="`${child.type}:${child.id}`"
          :node="child"
          :depth="depth + 1"
          :selected-key="selectedKey"
          :index="childIdx"
          :sibling-count="(node.children || []).length"
          @select="emit('select', $event)"
          @toggle="emit('toggle', $event)"
          @add="emit('add', $event)"
          @remove="emit('remove', $event)"
          @move="emit('move', $event)"
        />
        <div
          v-if="node.loading"
          class="node-hint font-mono"
          :style="{ paddingLeft: childIndent }"
        >
          加载中...
        </div>
        <div
          v-else-if="isEmpty"
          class="node-hint font-mono"
          :style="{ paddingLeft: childIndent }"
        >
          暂无内容
        </div>
      </div>
    </MCollapse>
  </div>
</template>

<style scoped>
.node-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding-right: 6px;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-size: var(--font-size);
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms ease, color 120ms ease;
}

.node-row:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.node-row.is-selected {
  background-color: var(--accent-muted);
  color: var(--text-primary);
}

.node-caret {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1), color 120ms ease;
}

.node-caret.is-open {
  transform: rotate(90deg);
}

.node-caret.is-leaf {
  cursor: default;
}

.node-row:hover .node-caret {
  color: var(--text-secondary);
}

.node-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.node-row.type-section .node-icon { color: var(--tag-green); }

.node-row.is-selected .node-icon {
  opacity: 1;
}

.node-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-flag {
  flex-shrink: 0;
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  opacity: 0.7;
}

.node-actions {
  display: none;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.node-row:hover .node-actions {
  display: inline-flex;
}

.node-action {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.node-action:hover:not(:disabled) {
  background-color: var(--bg-elevated);
  color: var(--text-primary);
}

.node-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.node-action.is-danger:hover:not(:disabled) {
  color: #e07070;
}

.node-hint {
  height: 28px;
  display: flex;
  align-items: center;
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  opacity: 0.6;
}
</style>
