<script setup>
import { onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';

import {
  Copy,
  EditPencil,
  NavArrowLeft,
  NavArrowRight,
  Plus,
  Trash
} from '../../components/icons/icons.js';

const props = defineProps({
  conversations: {
    type: Array,
    default: () => []
  },
  activeId: {
    type: String,
    default: ''
  },
  collapsed: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select', 'new', 'update:collapsed', 'rename', 'copy', 'delete']);
const menuId = ref('');
const menuPosition = ref({});
const menu = ref(null);
let trigger;
function toggleMenu(event, id) {
  if (menuId.value === id) {
    menuId.value = '';
    return;
  }
  trigger = event.currentTarget;
  const rect = trigger.getBoundingClientRect();
  menuPosition.value = {
    left: `${Math.max(8, Math.min(rect.right - 150, window.innerWidth - 158))}px`,
    top: `${Math.min(rect.bottom + 4, window.innerHeight - 140)}px`
  };
  menuId.value = id;
}
function choose(action) {
  emit(action, menuId.value);
  menuId.value = '';
}
function onPointer(event) {
  if (menuId.value && !menu.value?.contains(event.target) && !trigger?.contains(event.target)) {
    menuId.value = '';
  }
}
function onKey(event) {
  if (event.key === 'Escape' && menuId.value) {
    event.stopPropagation();
    menuId.value = '';
    trigger?.focus();
  }
}
function closeMenu() {
  menuId.value = '';
}
onDeactivated(closeMenu);
watch(() => props.collapsed, closeMenu);
onMounted(() => {
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointer, true);
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', closeMenu);
  window.removeEventListener('scroll', closeMenu, true);
});
</script>

<template>
  <aside
    class="conversation-list"
    :class="{
      'is-collapsed': collapsed
    }"
    aria-label="对话列表"
  >
    <header class="conversation-head">
      <button
        type="button"
        class="conversation-toggle"
        :title="collapsed ? '展开对话列表' : '收起对话列表'"
        :aria-label="collapsed ? '展开对话列表' : '收起对话列表'"
        :aria-expanded="!collapsed"
        aria-controls="ai-conversation-list"
        @click="$emit('update:collapsed', !collapsed)"
      >
        <component
          :is="collapsed ? NavArrowRight : NavArrowLeft"
          width="18"
          height="18"
          aria-hidden="true"
        />
      </button>
      <span class="conversation-title font-mono">对话列表</span>
      <button
        v-if="!collapsed"
        type="button"
        class="conversation-new"
        title="新建对话"
        @click="$emit('new')"
        aria-label="新建对话"
      >
        <Plus
          width="18"
          height="18"
          aria-hidden="true"
        />
      </button>
    </header>
    <div
      id="ai-conversation-list"
      class="conversation-body"
      :inert="collapsed"
      :aria-hidden="collapsed"
    >
      <div
        v-if="!conversations.length"
        class="conversation-empty"
      >
        <span aria-hidden="true">（・_・）</span>
        <p>暂无对话</p>
      </div>
      <nav
        v-else
        class="conversation-items"
        aria-label="对话列表"
      >
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          class="conversation-row"
          :class="{
            'is-active': conversation.id === activeId
          }"
        >
          <button
            type="button"
            class="conversation-item"
            :aria-current="conversation.id === activeId ? 'page' : undefined"
            @click="$emit('select', conversation.id)"
          >
            {{ conversation.title }}
          </button>
          <button
            type="button"
            class="conversation-menu-trigger"
            :aria-label="`${conversation.title} 的菜单`"
            aria-haspopup="menu"
            :aria-expanded="menuId === conversation.id"
            @click="toggleMenu($event, conversation.id)"
          >
            ⋯
          </button>
        </div>
      </nav>
    </div>
  </aside>
  <Teleport to="body">
    <div
      v-if="menuId"
      ref="menu"
      class="conversation-menu"
      :style="menuPosition"
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        @click="choose('rename')"
      >
        <EditPencil
          width="16"
          height="16"
        />重命名
      </button>
      <button
        type="button"
        role="menuitem"
        @click="choose('copy')"
      >
        <Copy
          width="16"
          height="16"
        />复制对话
      </button>
      <button
        type="button"
        role="menuitem"
        class="is-danger"
        @click="choose('delete')"
      >
        <Trash
          width="16"
          height="16"
        />删除
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.conversation-list {
  --conversation-expanded-width: 240px;
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  width: var(--conversation-expanded-width);
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-sidebar);
  transition: width 220ms var(--ease-layout);
}
.conversation-list.is-collapsed {
  width: 48px;
}
.conversation-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex: 0 0 48px;
  min-width: 0;
  gap: 8px;
  padding: 4px 8px 0 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.conversation-list.is-collapsed .conversation-head {
  justify-content: center;
  gap: 0;
  padding-inline: 0;
}
.conversation-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 1px;
  white-space: nowrap;
  transition: opacity 220ms var(--ease-layout);
}
.conversation-list.is-collapsed .conversation-title {
  opacity: 0;
  flex: 0 0 0;
  width: 0;
}
.conversation-toggle,
.conversation-new {
  display: inline-flex;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
}
.conversation-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.conversation-new:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.conversation-toggle:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
}
.conversation-body {
  flex: 1;
  width: calc(var(--conversation-expanded-width) - 1px);
  min-height: 0;
  overflow-y: auto;
  padding: 8px 8px 24px;
  transition: opacity 220ms var(--ease-layout);
}
.conversation-list.is-collapsed .conversation-body {
  opacity: 0;
  pointer-events: none;
}
.conversation-empty {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.conversation-empty span {
  font-size: 24px;
}
.conversation-empty p {
  margin: 0;
}
.conversation-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  overflow-y: auto;
}
.conversation-row {
  display: flex;
  align-items: center;
  border-radius: var(--radius);
  min-width: 0;
}
.conversation-row:hover,
.conversation-row.is-active {
  background: var(--bg-hover);
}
.conversation-item {
  display: block;
  flex: 1;
  min-width: 0;
  padding: 10px 8px;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conversation-item:hover,
.conversation-row.is-active .conversation-item {
  color: var(--text-primary);
}
.conversation-menu-trigger {
  flex: none;
  width: 30px;
  height: 32px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-muted);
  font-size: 20px;
  opacity: 0;
}
.conversation-row:hover .conversation-menu-trigger,
.conversation-row:focus-within .conversation-menu-trigger,
.conversation-menu-trigger[aria-expanded='true'] {
  opacity: 1;
}
.conversation-menu-trigger:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}
.conversation-menu {
  position: fixed;
  z-index: 150;
  width: 150px;
  padding: 4px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  box-shadow: 0 6px 20px var(--shadow-color-strong);
}
.conversation-menu button {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
}
.conversation-menu button:hover,
.conversation-menu button:focus-visible {
  background: var(--bg-hover);
}
.conversation-menu .is-danger {
  color: var(--color-danger, #df6262);
}
@media (hover: none) {
  .conversation-menu-trigger {
    opacity: 1;
  }
}
.conversation-item:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
}
@media (max-width: 767px) {
  .conversation-list {
    --conversation-expanded-width: min(70vw, 240px);
  }
  .conversation-list.is-collapsed {
    width: 48px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .conversation-list,
  .conversation-title,
  .conversation-body {
    transition: none;
  }
}
</style>
