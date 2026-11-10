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
        role="img"
        :aria-label="`难度 ${difficulty}，满分 5 星`"
      >
        <span
          class="difficulty-stars"
          aria-hidden="true"
        >
          <svg
            v-for="star in 5"
            :key="star"
            class="difficulty-star"
            :class="{
              'is-filled': star <= difficulty
            }"
            viewBox="0 0 24 24"
            width="15"
            height="15"
          >
            <path
              d="M12 2.7 15 8.8l6.7 1-4.85 4.72L18 21.2 12 18l-6 3.2 1.15-6.68L2.3 9.8l6.7-1z"
            />
          </svg>
        </span>
      </span>
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
.mm-question-difficulty {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.difficulty-stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.difficulty-star {
  flex: none;
  fill: none;
  stroke: var(--tag-amber);
  stroke-width: 1.7;
  stroke-linejoin: round;
}
.difficulty-star.is-filled {
  fill: var(--tag-amber);
}
@media print {
  .difficulty-star {
    stroke: #92610b;
  }
  .difficulty-star.is-filled {
    fill: #92610b;
  }
}
.mm-question-body {
  min-width: 0;
  margin-top: 12px;
}
</style>
