<script setup>
import { inject, onBeforeUnmount, ref, watch } from 'vue';

import { authStatus, currentUser } from '../../../utils/auth.js';
import { getReferencedQuestion } from './question-reference.js';
import QuestionCard from './QuestionCard.vue';

const props = defineProps({
  slug: {
    type: String,
    required: true
  },
  number: {
    type: String,
    default: ''
  },
  overrides: {
    type: Object,
    default: () => ({})
  }
});
const allowed = inject('typstQuestionReferencesAllowed', ref(true));
const printReferences = inject('typstPrintQuestionReferences', null);
const readingReferences = inject('typstReadingReferences', null);
const detail = ref(null);
const loading = ref(false);
const error = ref('');
let sequence = 0;
async function load() {
  const current = ++sequence;
  detail.value = null;
  error.value = '';
  if (!allowed.value) {
    error.value = '题目正文中的题目引用不展开';
    return;
  }
  loading.value = true;
  try {
    const result = printReferences
      ? printReferences.get(props.slug)
      : readingReferences?.value?.questions.has(props.slug)
        ? readingReferences.value.questions.get(props.slug)
        : await getReferencedQuestion(props.slug);
    if (current !== sequence) {
      return;
    }
    if (!result) {
      error.value = '题目不存在或已删除';
    } else if (
      result.question?.slug !== props.slug ||
      !Array.isArray(result.sources) ||
      !Array.isArray(result.knowledge_points)
    ) {
      throw new Error('题目数据不完整');
    } else {
      detail.value = result;
    }
  } catch {
    if (current === sequence) {
      error.value = '题目加载失败';
    }
  } finally {
    if (current === sequence) {
      loading.value = false;
    }
  }
}
watch(() => [props.slug, allowed.value, authStatus.value, currentUser.value?.id], load, {
  immediate: true
});
onBeforeUnmount(() => {
  sequence++;
});
</script>

<template>
  <div
    v-if="loading"
    class="reference-state"
  >
    正在加载题目…
  </div>
  <div
    v-else-if="error"
    class="reference-state"
    role="status"
  >
    {{ error
    }}<button
      v-if="error === '题目加载失败'"
      type="button"
      @click="load"
    >
      重试
    </button>
  </div>
  <QuestionCard
    v-else-if="detail"
    :detail="detail"
    :number="number"
    :overrides="overrides"
  />
</template>

<style scoped>
.reference-state {
  margin: 1em 0;
  padding: 12px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.reference-state button {
  margin-left: 8px;
  color: var(--accent-primary);
  cursor: pointer;
}
</style>
