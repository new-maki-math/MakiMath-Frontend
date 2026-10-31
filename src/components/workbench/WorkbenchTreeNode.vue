<script setup>
import {
  Archive,
  Book,
  Folder,
  Journal,
  NavArrowDown,
  NavArrowRight,
  NavArrowUp,
  Page,
  Plus,
  Trash
} from '@iconoir/vue';
import { computed, ref, watch } from 'vue';

import MCollapse from '../MCollapse.vue';

defineOptions({
  name: 'WorkbenchTreeNode'
});

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
  // 兄弟节点中的下标
  index: {
    type: Number,
    default: 0
  },
  siblingCount: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['select', 'toggle', 'add', 'remove', 'move', 'import', 'archive']);

const isSelected = computed(() => `${props.node.type}:${props.node.id}` === props.selectedKey);
const isBranch = computed(() => Array.isArray(props.node.children));
const hasOpened = ref(props.node.type === 'group' || Boolean(props.node.expanded));
watch(
  () => props.node.expanded,
  (expanded) => {
    if (expanded) {
      hasOpened.value = true;
    }
  }
);
const indent = computed(() => `${4 + props.depth * 14}px`);
const childIndent = computed(() => `${4 + (props.depth + 1) * 14}px`);
const isEmpty = computed(() => props.node.children && props.node.children.length === 0);
const canMoveUp = computed(() => props.index > 0);
const canMoveDown = computed(() => props.index < props.siblingCount - 1);
</script>

<template>
  <div class="tree-node">
    <div
      class="node-row"
      :class="[
        `type-${node.type}`,
        {
          'is-selected': isSelected,
          'actions-on-hover': node.actionsOnHover,
          'has-archive': node.actions?.archive
        }
      ]"
      :style="{
        paddingLeft: indent,
        '--node-indent': indent
      }"
      @click="emit('select', node)"
    >
      <button
        v-if="isBranch"
        class="node-caret"
        :class="{
          'is-open': node.expanded
        }"
        type="button"
        :title="node.expanded ? '收起' : '展开'"
        :aria-label="`${node.expanded ? '收起' : '展开'}${node.label}`"
        :aria-expanded="Boolean(node.expanded)"
        @click.stop="emit('toggle', node)"
      >
        <NavArrowRight
          width="16"
          height="16"
        />
      </button>
      <span
        v-else
        class="node-caret is-leaf"
      ></span>

      <component
        :is="
          node.type === 'group'
            ? Folder
            : node.type === 'chapter'
              ? Journal
              : node.type === 'lecture' || node.type === 'version' || node.type === 'notebook'
                ? Book
                : Page
        "
        class="node-icon"
        width="16"
        height="16"
      />

      <span class="node-label">{{ node.label }}</span>

      <span
        v-if="node.type === 'section' && node.hasSource === false"
        class="node-flag font-mono"
        >空</span
      >

      <span
        v-if="node.actions"
        class="node-actions"
      >
        <button
          v-if="node.actions.move"
          class="node-action"
          type="button"
          title="上移"
          :disabled="!canMoveUp"
          @click.stop="
            emit('move', {
              node,
              delta: -1
            })
          "
        >
          <NavArrowUp
            width="15"
            height="15"
          />
        </button>
        <button
          v-if="node.actions.move"
          class="node-action"
          type="button"
          title="下移"
          :disabled="!canMoveDown"
          @click.stop="
            emit('move', {
              node,
              delta: 1
            })
          "
        >
          <NavArrowDown
            width="15"
            height="15"
          />
        </button>
        <button
          v-if="node.actions.add"
          class="node-action"
          type="button"
          :title="node.actions.addLabel || '新建子项'"
          :aria-label="node.actions.addLabel || '新建子项'"
          @click.stop="emit('add', node)"
        >
          <Plus
            width="15"
            height="15"
          />
        </button>
        <button
          v-if="node.actions.import"
          class="node-action import-action"
          type="button"
          title="导入 JSON"
          aria-label="导入 JSON"
          @click.stop="emit('import', node)"
        >
          JSON
        </button>
        <button
          v-if="node.actions.archive"
          class="node-action"
          type="button"
          title="归档讲义"
          :aria-label="`归档讲义 ${node.label}`"
          @click.stop="emit('archive', node)"
        >
          <Archive
            width="15"
            height="15"
          />
        </button>
        <button
          v-if="node.actions.remove"
          class="node-action is-danger"
          type="button"
          :title="node.actions.removeLabel || '删除'"
          :aria-label="node.actions.removeLabel || '删除'"
          :disabled="Boolean(node.actions.removeDisabled)"
          @click.stop="emit('remove', node)"
        >
          <Trash
            width="15"
            height="15"
          />
        </button>
      </span>
    </div>

    <MCollapse
      v-if="isBranch"
      :open="Boolean(node.expanded)"
      :fade="false"
    >
      <div
        v-if="hasOpened"
        class="node-children"
      >
        <WorkbenchTreeNode
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
          @import="emit('import', $event)"
          @archive="emit('archive', $event)"
        />
        <div
          v-if="node.loading"
          class="node-hint font-mono"
          :style="{
            paddingLeft: childIndent
          }"
        >
          加载中...
        </div>
        <div
          v-else-if="isEmpty"
          class="node-hint font-mono"
          :style="{
            paddingLeft: childIndent
          }"
        >
          暂无内容
        </div>
      </div>
    </MCollapse>
  </div>
</template>

<style scoped>
.import-action {
  width: auto;
  padding: 0 4px;
  font-size: 10px;
}

.node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding-right: 2px;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-size: var(--font-size);
  cursor: pointer;
  user-select: none;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.node-row:hover,
.node-row.is-selected {
  position: relative;
  background: transparent;
  color: var(--text-primary);
}

.node-row:hover::before,
.node-row.is-selected::before {
  content: '';
  position: absolute;
  z-index: 0;
  left: var(--node-indent, 4px);
  right: 2px;
  top: 4px;
  bottom: 4px;
  border-radius: var(--radius-xs);
  background: var(--bg-hover);
}

.node-row.is-selected::before {
  background: color-mix(in srgb, var(--accent-primary) 15%, var(--bg-sidebar));
}

.node-row.is-selected:hover::before {
  background: color-mix(in srgb, var(--accent-primary) 21%, var(--bg-sidebar));
}

.node-row:hover > *,
.node-row.is-selected > * {
  position: relative;
  z-index: 1;
}

.node-row.is-selected .node-label {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.node-row.is-selected .node-flag {
  color: var(--text-secondary);
}

.node-caret {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  border-radius: var(--radius-xs);
  transition:
    color 120ms ease,
    background-color 120ms ease;
}

.node-caret svg {
  transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.node-caret.is-open svg {
  transform: rotate(90deg);
}

.node-caret:not(.is-leaf):hover {
  background-color: var(--bg-elevated);
}

.node-caret:focus-visible,
.node-action:focus-visible {
  outline: 1px solid var(--accent-primary);
  outline-offset: -1px;
}

.node-caret.is-leaf {
  cursor: default;
}

.node-row:hover .node-caret {
  color: var(--text-secondary);
}

.node-row.is-selected .node-caret {
  color: var(--text-primary);
}

.node-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.node-row.type-section .node-icon {
  color: var(--tag-green);
}
.node-row.type-group .node-icon {
  color: var(--tag-purple);
}
.node-row.type-lecture .node-icon {
  color: var(--tag-blue);
}
.node-row.type-version .node-icon {
  color: var(--tag-teal);
}
.node-row.type-chapter .node-icon {
  color: var(--tag-orange);
}

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
  gap: 0;
  flex-shrink: 0;
}

.node-row:hover .node-actions,
.node-row:focus-within .node-actions,
.node-row.type-group:not(.actions-on-hover) .node-actions {
  display: inline-flex;
}

@media (hover: none) {
  .node-row.has-archive .node-actions {
    display: inline-flex;
  }
}

.node-action {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.node-action,
.node-caret:not(.is-leaf) {
  border-radius: 0;
}

.node-action:hover:not(:focus-visible) {
  border: 0;
  outline: 0;
  box-shadow: none;
}

.node-row.is-selected .node-action:hover:not(:disabled),
.node-row.is-selected .node-caret:not(.is-leaf):hover {
  background: color-mix(in srgb, var(--accent-primary) 32%, var(--bg-sidebar));
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
