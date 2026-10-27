<script setup>
import MModal from './MModal.vue';
import MTag from './MTag.vue';
import MButton from './MButton.vue';

defineProps({
  open: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);
</script>

<template>
  <MModal
    :open="open"
    title="如何使用"
    hide-footer
    @close="emit('close')"
  >
    <div class="help-content font-mono">
      <MTag variant="blue" size="sm">DOCS // 手册</MTag>
      <h2 class="help-title">COMING SOON</h2>
      <p class="help-desc">使用手册正在编撰完善中，敬请期待</p>
      <MButton variant="secondary" size="sm" @click="emit('close')">关闭</MButton>
    </div>
  </MModal>
</template>

<style scoped>
.help-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 24px 0 8px;
  text-align: center;
}

.help-title {
  color: var(--text-primary);
  font-size: var(--font-size-largest);
  letter-spacing: 2px;
}

.help-desc {
  color: var(--text-muted);
  font-size: var(--font-size);
}
</style>
