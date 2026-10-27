<script setup>
import MBackdrop from './MBackdrop.vue';
import MButton from './MButton.vue';
import { Xmark } from '@iconoir/vue';

defineProps({
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
  showClose: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'confirm']);
</script>

<template>
  <MBackdrop
    :open="open"
    teleport
    fixed
    :z-index="90"
    @close="emit('close')"
  >
    <transition name="modal-pop" appear>
      <section
        v-if="open"
        class="modal-panel"
        :style="{ width }"
        @click.stop
      >
        <header class="modal-head">
          <h2 class="modal-title">{{ title }}</h2>
          <button v-if="showClose" type="button" class="modal-close" aria-label="关闭窗口" @click="emit('close')"><Xmark width="16" height="16" /></button>
          <p v-if="desc" class="modal-desc">{{ desc }}</p>
        </header>

        <div class="modal-body">
          <slot />
        </div>

        <footer v-if="!hideFooter" class="modal-foot">
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
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 96px);
  display: flex;
  flex-direction: column;
  /* 弹窗面板容器 */
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
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
  padding: 16px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  transition: opacity 160ms cubic-bezier(0.16, 1, 0.3, 1), transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-pop-enter-from,
.modal-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% - 8px)) scale(0.98);
}
</style>
