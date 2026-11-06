<script setup>
import { computed, inject, provide, ref } from 'vue';

import MTag from '../../MTag.vue';
import TypstNode from '../typst/TypstNode.vue';
import TypstDoc from '../TypstDoc.vue';
import MmQuestion from './MmQuestion.vue';

const props = defineProps({
  detail: {
    type: Object,
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
provide('typstQuestionReferencesAllowed', ref(false));
const printReferences = inject('typstPrintQuestionReferences', null);
const question = computed(() => props.detail.question || {});
const difficulty = computed(() =>
  props.overrides.difficulty === undefined ? question.value.difficulty : props.overrides.difficulty
);
const knowledge = computed(() => {
  const value = props.overrides.knowledge;
  if (value === false) {
    return [];
  }
  return Array.isArray(value)
    ? value.map((slug) => ({
        slug,
        title: slug
      }))
    : props.detail.knowledge_points || [];
});
const sources = computed(() => props.detail.sources || []);
const sections = computed(() =>
  [
    {
      key: 'focus',
      label: '考点',
      source: question.value.focus_source
    },
    {
      key: 'solution',
      label: '解答',
      source: question.value.solution_source
    },
    {
      key: 'conclusion',
      label: '结论',
      source: question.value.conclusion_source
    },
    {
      key: 'pitfalls',
      label: '易错点',
      source: question.value.pitfalls_source
    }
  ]
    .map((section) => ({
      ...section,
      override: props.overrides[section.key]
    }))
    .filter(
      (section) =>
        section.override !== false &&
        (Array.isArray(section.override)
          ? section.override.length
          : Boolean(section.source?.trim()))
    )
);
</script>

<template>
  <MmQuestion
    :difficulty="difficulty === false ? null : difficulty"
    :has-title="Boolean(number)"
    :has-body="true"
  >
    <template #title>{{ number }}</template>
    <div
      v-if="sources.length || knowledge.length || overrides.tags?.length"
      class="question-tags"
    >
      <MTag
        v-for="source in sources"
        :key="source.entry_id"
        variant="blue"
        size="sm"
      >
        {{ source.path.map((entry) => entry.name).join(' / ')
        }}{{ source.source_number ? ` · ${source.source_number}` : '' }}
      </MTag>
      <MTag
        v-for="point in knowledge"
        :key="point.slug"
        variant="teal"
        size="sm"
        >{{ point.title || `${point.slug}（不可用）` }}</MTag
      >
      <TypstDoc
        v-for="(tag, index) in overrides.tags || []"
        :key="index"
        :source="tag"
        :allow-question-references="false"
      />
    </div>
    <TypstDoc
      :source="question.stem_source || ''"
      :allow-question-references="false"
    />
    <details
      v-for="section in sections"
      :key="section.key"
      class="question-section"
      :open="Boolean(printReferences)"
    >
      <summary>{{ section.label }}</summary>
      <div class="section-content">
        <template v-if="Array.isArray(section.override)">
          <TypstNode
            v-for="(node, index) in section.override"
            :key="index"
            :node="node"
          />
        </template>
        <TypstDoc
          v-else
          :source="section.source"
          :allow-question-references="false"
        />
      </div>
    </details>
  </MmQuestion>
</template>

<style scoped>
.question-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
.question-section {
  margin-top: 12px;
  color: var(--text-secondary);
}
.question-section summary {
  cursor: pointer;
  color: var(--text-primary);
}
.section-content {
  margin-top: 8px;
}
</style>
