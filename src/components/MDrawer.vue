<script setup>
import { computed, onBeforeUnmount, watch } from 'vue';
import { NavArrowLeft, NavArrowRight } from '@iconoir/vue';
import MBackdrop from './MBackdrop.vue';

const props = defineProps({
  open: {
    type: Boolean,
    default: undefined
  },
  modelValue: {
    type: Boolean,
    default: undefined
  },
  placement: {
    type: String,
    default: 'left',
    validator: (v) => ['left', 'right'].includes(v)
  },
  title: {
    type: String,
    default: ''
  },
  width: {
    type: String,
    default: '280px'
  },
  teleport: {
    type: [Boolean, String],
    default: false
  },
  fixed: {
    type: Boolean,
    default: false
  },
  zIndex: {
    type: [Number, String],
    default: 50
  },
  showClose: {
    type: Boolean,
    default: true
  },
  closeOnClickBackdrop: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['close', 'update:open', 'update:modelValue']);

const isOpen = computed(() => {
  if (props.open !== undefined) return Boolean(props.open);
  if (props.modelValue !== undefined) return Boolean(props.modelValue);
  return false;
});

const drawerWidth = computed(() => {
  if (!props.width) return '280px';
  return props.width;
});

const transitionName = computed(() => {
  return props.placement === 'right' ? 'drawer-slide-right' : 'drawer-slide-left';
});

const backdropZIndex = computed(() => {
  return Number(props.zIndex) - 2;
});

const panelZIndex = computed(() => {
  return Number(props.zIndex);
});

const handleClose = () => {
  emit('close');
  emit('update:open', false);
  emit('update:modelValue', false);
};

const handleKeyDown = (e) => {
  if (e.key === 'Escape' && isOpen.value) {
    handleClose();
  }
};

watch(
  isOpen,
  (val) => {
    if (val) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div
    class="m-drawer-container"
    :class="[
      fixed ? 'is-fixed' : 'is-absolute',
      { 'is-open': isOpen }
    ]"
    :style="{ zIndex: panelZIndex }"
  >
    <!-- 压暗遮罩（仅限容器内容区或全局） -->
    <MBackdrop
      :open="isOpen"
      :teleport="teleport"
      :fixed="fixed"
      :z-index="backdropZIndex"
      :close-on-click="closeOnClickBackdrop"
      @close="handleClose"
    />

    <!-- 浮动抽屉主体 -->
    <Transition :name="transitionName" appear>
      <aside
        v-if="isOpen"
        class="m-drawer-panel"
        :class="[
          `placement-${placement}`,
          fixed ? 'is-fixed' : 'is-absolute'
        ]"
        :style="{
          width: drawerWidth,
          maxWidth: '85vw',
          zIndex: panelZIndex
        }"
        aria-label="浮动抽屉面板"
        @click.stop
      >
        <!-- 抽屉头部 -->
        <header v-if="$slots.header || title || showClose" class="drawer-header">
          <slot name="header">
            <div class="drawer-title font-mono">
              <span>{{ title }}</span>
            </div>
            <button
              v-if="showClose"
              class="drawer-toggle-btn"
              :title="placement === 'right' ? '收起面板' : '收起目录'"
              @click="handleClose"
            >
              <NavArrowRight v-if="placement === 'right'" width="14" height="14" />
              <NavArrowLeft v-else width="14" height="14" />
            </button>
          </slot>
        </header>

        <!-- 抽屉正文内容插槽 -->
        <div class="drawer-body">
          <slot />
        </div>

        <!-- 抽屉底部扩展插槽 -->
        <footer v-if="$slots.footer" class="drawer-footer">
          <slot name="footer" />
        </footer>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.m-drawer-container {
  pointer-events: none;
}

.m-drawer-container.is-absolute {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.m-drawer-container.is-fixed {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
}

.m-drawer-container.is-open {
  pointer-events: auto;
}

/* 抽屉面板 */
.m-drawer-panel {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-sidebar, #181818);
  overflow: hidden;
  user-select: none;
  pointer-events: auto;
}

.m-drawer-panel.is-absolute {
  position: absolute;
  top: 0;
  bottom: 0;
  height: 100%;
}

.m-drawer-panel.is-fixed {
  position: fixed;
  top: 0;
  bottom: 0;
  height: 100vh;
}

/* 左侧展开（边界在右） */
.m-drawer-panel.placement-left {
  left: 0;
  border-right: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.45);
}

/* 右侧展开（边界在左） */
.m-drawer-panel.placement-right {
  right: 0;
  border-left: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.45);
}

/* 抽屉头部 */
.drawer-header {
  height: 44px;
  padding: 0 14px 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;
  background-color: var(--bg-sidebar, #181818);
}

.drawer-title {
  font-size: var(--font-size-smallest, 12px);
  font-weight: var(--font-weight-semibold, 600);
  letter-spacing: 0.8px;
  color: var(--text-muted, #808080);
}

.drawer-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-xs, 2px);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted, #808080);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.drawer-toggle-btn:hover {
  background-color: var(--bg-hover, #282828);
  color: var(--text-primary, #e0e0e0);
}

/* 抽屉正文滚动区 */
.drawer-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

/* 抽屉底部 */
.drawer-footer {
  padding: 10px 14px;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;
}

/* 左展开平移动效 */
.drawer-slide-left-enter-active,
.drawer-slide-left-leave-active {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}

.drawer-slide-left-enter-from,
.drawer-slide-left-leave-to {
  transform: translate3d(-100%, 0, 0);
  opacity: 0.8;
}

/* 右展开平移动效 */
.drawer-slide-right-enter-active,
.drawer-slide-right-leave-active {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}

.drawer-slide-right-enter-from,
.drawer-slide-right-leave-to {
  transform: translate3d(100%, 0, 0);
  opacity: 0.8;
}
</style>
