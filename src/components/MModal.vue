<script setup>
import MBackdrop from './MBackdrop.vue';
import MButton from './MButton.vue';

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
  }
});

const emit = defineEmits(['close', 'confirm']);
</script>

<template>
  <MBackdrop
    v-if="open"
    :open="open"
    teleport
    fixed
    :z-index="90"
    @close="emit('close')"
  >
    <section
      class="modal-panel"
      :style="{ width }"
      @click.stop
    >
      <header class="modal-head">
        <h2 class="modal-title">{{ title }}</h2>
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
  padding: 18px 20px 0;
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
</style>
