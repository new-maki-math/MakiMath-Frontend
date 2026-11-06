<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';

import { questionApi } from '../../api/questions.js';
import MButton from '../../components/MButton.vue';
import MModal from '../../components/MModal.vue';
import QuestionCard from '../../components/typst-renderer/mm/QuestionCard.vue';
import { authStatus, currentUser } from '../../utils/auth.js';

const props = defineProps({
  questionId: {
    type: [String, Number],
    default: null
  }
});
const emit = defineEmits(['close']);
const detail = ref(null);
const loading = ref(false);
const error = ref('');
let sequence = 0;
let controller;
async function load() {
  const id = props.questionId;
  const current = ++sequence;
  controller?.abort();
  controller = new AbortController();
  detail.value = null;
  error.value = '';
  if (id == null) {
    return;
  }
  loading.value = true;
  try {
    const result = await questionApi.detail(id, {
      signal: controller.signal
    });
    if (current !== sequence) {
      return;
    }
    if (
      String(result?.question?.id) !== String(id) ||
      !Array.isArray(result.sources) ||
      !Array.isArray(result.knowledge_points)
    ) {
      throw new Error('题目数据不完整');
    }
    detail.value = result;
  } catch (failure) {
    if (current === sequence && failure.name !== 'AbortError') {
      error.value = failure.status === 404 ? '题目不存在或已删除' : '题目加载失败';
    }
  } finally {
    if (current === sequence) {
      loading.value = false;
    }
  }
}
watch(() => [props.questionId, authStatus.value, currentUser.value?.id], load, {
  immediate: true
});
onBeforeUnmount(() => {
  sequence++;
  controller?.abort();
});
</script>

<template>
  <MModal
    :open="questionId !== null"
    title="题目详情"
    width="760px"
    hide-footer
    show-close
    @close="emit('close')"
  >
    <p
      v-if="loading"
      class="state"
    >
      正在加载题目…
    </p>
    <p
      v-else-if="error"
      class="state"
      role="alert"
    >
      {{ error }}
      <MButton
        v-if="error === '题目加载失败'"
        size="sm"
        variant="ghost"
        @click="load"
        >重试</MButton
      >
    </p>
    <QuestionCard
      v-else-if="detail"
      :detail="detail"
    />
  </MModal>
</template>

<style scoped>
.state {
  color: var(--text-secondary);
}
</style>
