<script setup>
import { ref, watch } from 'vue';
import MModal from '../../components/MModal.vue';
import MButton from '../../components/MButton.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  busy: { type: Boolean, default: false }
});
const emit = defineEmits(['close', 'confirm']);
const step = ref(1);

watch(() => props.open, (open) => {
  if (open) step.value = 1;
});
</script>

<template>
  <MModal :open="open" :title="`永久删除讲义 · 第 ${step} / 3 步`" hide-footer @close="!busy && emit('close')">
    <p v-if="step === 1" class="delete-copy">确定要永久删除这份已归档讲义吗？</p>
    <template v-else-if="step === 2">
      <p class="delete-copy">请核对讲义名称：<strong>{{ title }}</strong></p>
      <p class="delete-copy">将永久删除讲义、草稿、所有审核快照、章节、小节、审核记录和协作者关系。</p>
    </template>
    <template v-else>
      <p class="delete-copy">此操作不可撤销，删除后无法恢复。</p>
    </template>
    <div class="delete-actions">
      <MButton variant="ghost" size="sm" mono :disabled="busy" @click="emit('close')">取消</MButton>
      <MButton v-if="step < 3" variant="primary" size="sm" mono @click="step++">下一步</MButton>
      <MButton v-else variant="danger" size="sm" mono :disabled="busy" @click="emit('confirm')">{{ busy ? '删除中...' : '永久删除' }}</MButton>
    </div>
  </MModal>
</template>

<style scoped>
.delete-copy { margin: 0; color: var(--text-primary); line-height: 1.7; overflow-wrap: anywhere; }
.delete-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
