<script setup>
import { ref, watch } from 'vue';
import MModal from '../../components/MModal.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  impact: { type: String, required: true },
  busy: { type: Boolean, default: false }
});
const emit = defineEmits(['close', 'confirm']);
const step = ref(1);

watch(() => props.open, (open) => {
  if (open) step.value = 1;
});

function close() {
  if (!props.busy) emit('close');
}

function advance() {
  if (props.busy) return;
  if (step.value < 3) step.value++;
  else emit('confirm');
}
</script>

<template>
  <MModal :open="open" :title="`归档讲义 · 第 ${step} / 3 步`" :busy="busy" :confirm-text="step === 3 ? '确认归档' : '下一步'" cancel-text="取消" @close="close" @confirm="advance">
    <p v-if="step === 1" class="archive-copy">确定要归档这份讲义吗？</p>
    <p v-else-if="step === 2" class="archive-copy">请核对讲义名称：<strong>{{ title || '未命名讲义' }}</strong></p>
    <template v-else>
      <p class="archive-copy">将归档整本讲义，并移入已归档讲义列表。</p>
      <p class="archive-copy">{{ impact }}</p>
    </template>
  </MModal>
</template>

<style scoped>
.archive-copy { margin: 0; color: var(--text-primary); line-height: 1.7; overflow-wrap: anywhere; }
</style>
