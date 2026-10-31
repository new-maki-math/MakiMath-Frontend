<script setup>
import MmBoxIcon from './MmBoxIcon.vue';

defineProps({
  source: {
    type: String,
    default: ''
  },
  questionId: {
    type: String,
    default: ''
  },
  difficulty: {
    type: Number,
    default: null
  },
  hasTitle: {
    type: Boolean,
    default: false
  },
  hasBody: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <section
    class="mm-question"
    :data-question-id="questionId || undefined"
  >
    <div class="mm-question-header">
      <MmBoxIcon
        name="question"
        class="mm-question-icon"
      />
      <span class="mm-question-label">题目</span>
      <template v-if="hasTitle"
        ><span class="mm-question-separator"> · </span
        ><span class="mm-question-title"><slot name="title" /></span
      ></template>
      <span
        v-if="source"
        class="mm-question-source"
        >{{ source }}</span
      >
      <span
        v-if="difficulty"
        class="mm-question-difficulty"
        >难度 {{ difficulty }} / 5</span
      >
    </div>
    <div class="mm-question-body">
      <span
        v-if="!hasBody"
        class="mm-question-empty"
        >题干待补</span
      ><slot />
    </div>
  </section>
</template>

<style scoped>
.mm-question {
  min-width: 0;
  margin: 1em 0;
  padding: 12px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  background: var(--bg-surface);
  overflow-wrap: anywhere;
}
.mm-question-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 1.1em;
  line-height: 1.5;
}
.mm-question-icon {
  color: var(--accent-primary);
}
.mm-question-label {
  color: var(--accent-primary);
  font-weight: 600;
}
.mm-question-separator,
.mm-question-source,
.mm-question-difficulty,
.mm-question-empty {
  color: var(--text-secondary);
}
.mm-question-title {
  font-weight: 600;
}
.mm-question-source,
.mm-question-difficulty {
  font-size: 0.85em;
}
.mm-question-body {
  min-width: 0;
  margin-top: 18px;
}
</style>
