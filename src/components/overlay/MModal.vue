<script setup>
import { nextTick, onUnmounted, ref, watch } from 'vue';

import MButton from '../form/MButton.vue';
import { Xmark } from '../icons/icons.js';
import MBackdrop from './MBackdrop.vue';

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  desc: {
    type: String,
    default: ''
  },
  width: {
    type: String,
    default: '440px'
  },
  height: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  confirmVariant: {
    type: String,
    default: 'primary'
  },
  busy: {
    type: Boolean,
    default: false
  },
  hideFooter: {
    type: Boolean,
    default: false
  },
  hideScrollbar: {
    type: Boolean,
    default: false
  },
  showClose: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'confirm']);
const panel = ref(null);
const head = ref(null);
const body = ref(null);
const content = ref(null);
const foot = ref(null);
const panelHeight = ref(null);
let observer;
let frame = 0;
let generation = 0;

function updateHeight() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (!panel.value || !head.value || !body.value || !content.value) {
      return;
    }
    const bodyStyle = getComputedStyle(body.value);
    const panelStyle = getComputedStyle(panel.value);
    const padding = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
    const borders =
      parseFloat(panelStyle.borderTopWidth) + parseFloat(panelStyle.borderBottomWidth);
    panelHeight.value = Math.ceil(
      head.value.offsetHeight +
        content.value.scrollHeight +
        padding +
        (foot.value?.offsetHeight || 0) +
        borders
    );
  });
}

watch(
  () => [props.open, props.height],
  async ([open, height]) => {
    const current = ++generation;
    observer?.disconnect();
    cancelAnimationFrame(frame);
    panelHeight.value = null;
    if (!open || height) {
      return;
    }
    await nextTick();
    if (current !== generation || !panel.value) {
      return;
    }
    observer = new ResizeObserver(updateHeight);
    [head.value, content.value, foot.value]
      .filter(Boolean)
      .forEach((element) => observer.observe(element));
    updateHeight();
  },
  {
    immediate: true
  }
);

onUnmounted(() => {
  generation++;
  observer?.disconnect();
  cancelAnimationFrame(frame);
});
</script>

<template>
  <MBackdrop
    :open="open"
    teleport
    fixed
    :z-index="90"
    @close="emit('close')"
  >
    <transition
      name="modal-pop"
      appear
    >
      <section
        v-if="open"
        ref="panel"
        class="modal-panel"
        :class="{
          'is-fixed-height': height
        }"
        :style="{
          width,
          height: height || (panelHeight === null ? undefined : `${panelHeight}px`)
        }"
        @click.stop
      >
        <header
          ref="head"
          class="modal-head"
        >
          <h2 class="modal-title">{{ title }}</h2>
          <button
            v-if="showClose"
            type="button"
            class="modal-close"
            aria-label="关闭窗口"
            @click="emit('close')"
          >
            <Xmark
              width="16"
              height="16"
            />
          </button>
          <p
            v-if="desc"
            class="modal-desc"
          >
            {{ desc }}
          </p>
        </header>

        <div
          ref="body"
          class="modal-body"
          :class="{
            'hide-scrollbar': hideScrollbar
          }"
        >
          <div
            ref="content"
            class="modal-content"
          >
            <slot />
          </div>
        </div>

        <footer
          v-if="!hideFooter"
          ref="foot"
          class="modal-foot"
        >
          <slot name="footer">
            <MButton
              variant="ghost"
              size="sm"
              :mono="true"
              :disabled="busy"
              @click="emit('close')"
            >
              {{ cancelText }}
            </MButton>
            <MButton
              :variant="confirmVariant"
              size="sm"
              :mono="true"
              :disabled="busy"
              @click="emit('confirm')"
            >
              {{ busy ? '处理中...' : confirmText }}
            </MButton>
          </slot>
        </footer>
      </section>
    </transition>
  </MBackdrop>
</template>

<style scoped>
.modal-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 96px);
  display: flex;
  flex-direction: column;
  /* 弹窗面板容器 */
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: height 220ms cubic-bezier(0.2, 0, 0, 1);
}

.modal-head {
  position: relative;
  padding: 18px 20px 0;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-title {
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.modal-desc {
  margin-top: 6px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  line-height: 1.6;
}

.modal-body {
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
  overflow-y: auto;
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-body.hide-scrollbar {
  scrollbar-width: none;
}

.modal-body.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.is-fixed-height .modal-body {
  box-sizing: border-box;
}

.is-fixed-height .modal-content {
  height: 100%;
  min-height: 0;
}

.modal-foot {
  padding: 14px 20px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-pop-enter-active,
.modal-pop-leave-active {
  transition:
    opacity 160ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 160ms cubic-bezier(0.16, 1, 0.3, 1),
    height 220ms cubic-bezier(0.2, 0, 0, 1);
}

.modal-pop-enter-from,
.modal-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% - 8px)) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .modal-panel {
    transition: none;
  }
}
</style>
