<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { questionApi } from '../../api/questions.js';
import MDataView from '../../components/feedback/MDataView.vue';
import MButton from '../../components/form/MButton.vue';
import { NavArrowLeft, NavArrowRight } from '../../components/icons/icons.js';
import MModal from '../../components/overlay/MModal.vue';
import QuestionCard from '../../components/typst-renderer/mm/QuestionCard.vue';
import { authStatus, currentUser } from '../../utils/auth.js';

const props = defineProps({
  questionId: {
    type: [String, Number],
    default: null
  },
  entryId: {
    type: [String, Number],
    default: null
  },
  questionTitle: {
    type: String,
    default: ''
  }
});
const emit = defineEmits(['close', 'navigate']);
const detail = ref(null);
const loading = ref(false);
const error = ref('');
const neighbors = ref(null);
const neighborsLoading = ref(false);
const neighborsError = ref(false);
const navigation = ref(null);
let sequence = 0;
let controller;
let neighborsSequence = 0;
let neighborsController;
async function loadNeighbors() {
  const id = props.entryId;
  const current = ++neighborsSequence;
  neighborsController?.abort();
  neighborsController = new AbortController();
  neighbors.value = null;
  neighborsError.value = false;
  if (id == null) {
    neighborsLoading.value = false;
    return;
  }
  neighborsLoading.value = true;
  try {
    const result = await questionApi.entryNeighbors(id, {
      signal: neighborsController.signal
    });
    if (current !== neighborsSequence) {
      return;
    }
    if (
      !result ||
      !['previous', 'next'].every(
        (key) =>
          result[key] === null || (result[key]?.id != null && result[key]?.question_id != null)
      )
    ) {
      throw new Error('相邻题目数据不完整');
    }
    neighbors.value = result;
  } catch (failure) {
    if (current === neighborsSequence && failure.name !== 'AbortError') {
      neighborsError.value = true;
    }
  } finally {
    if (current === neighborsSequence) {
      neighborsLoading.value = false;
    }
  }
}
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
watch(
  () => [props.entryId, authStatus.value, currentUser.value?.id],
  async () => {
    loadNeighbors();
    await nextTick();
    navigation.value?.closest('.modal-panel')?.querySelector('.modal-body')?.scrollTo({
      top: 0
    });
  },
  {
    immediate: true
  }
);
onBeforeUnmount(() => {
  sequence++;
  controller?.abort();
  neighborsSequence++;
  neighborsController?.abort();
});
</script>

<template>
  <MModal
    :open="questionId !== null"
    :title="questionTitle ? `题目详情 · ${questionTitle}` : '题目详情'"
    width="760px"
    hide-scrollbar
    show-close
    @close="emit('close')"
  >
    <MDataView
      :loading="loading"
      :content-key="questionId"
      text="正在加载题目…"
    >
      <p
        v-if="error"
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
    </MDataView>
    <template #footer>
      <div
        ref="navigation"
        class="question-navigation"
        aria-label="文件内题目切换"
      >
        <MButton
          variant="ghost"
          size="sm"
          :disabled="neighborsLoading || !neighbors?.previous"
          @click="emit('navigate', neighbors.previous)"
        >
          <NavArrowLeft
            width="16"
            height="16"
            aria-hidden="true"
          />
          上一题
        </MButton>
        <button
          v-if="neighborsError"
          type="button"
          class="navigation-error"
          @click="loadNeighbors"
        >
          切换加载失败，点击重试
        </button>
        <MButton
          variant="ghost"
          size="sm"
          :disabled="neighborsLoading || !neighbors?.next"
          @click="emit('navigate', neighbors.next)"
        >
          下一题
          <NavArrowRight
            width="16"
            height="16"
            aria-hidden="true"
          />
        </MButton>
      </div>
    </template>
  </MModal>
</template>

<style scoped>
.question-navigation {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.question-navigation :deep(.btn-content) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.navigation-error {
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.state {
  color: var(--text-secondary);
}
</style>
