<script setup>
import { computed, inject, provide, ref } from 'vue';

import { NavArrowRight } from '../../icons/icons.js';
import TypstNode from '../typst/TypstNode.vue';
import TypstDoc from '../TypstDoc.vue';
import MmQuestion from './MmQuestion.vue';
import MmTag from './MmTag.vue';

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
      <MmTag
        v-for="source in sources"
        :key="source.entry_id"
        :color="{
          preset: 'blue'
        }"
      >
        {{ source.path.map((entry) => entry.name).join(' / ')
        }}{{ source.source_number ? ` · ${source.source_number}` : '' }}
      </MmTag>
      <MmTag
        v-for="point in knowledge"
        :key="point.slug"
        :color="{
          preset: 'cyan'
        }"
        >{{ point.title || `${point.slug}（不可用）` }}</MmTag
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
    <div
      v-if="sections.length"
      class="question-sections"
    >
      <details
        v-for="section in sections"
        :key="section.key"
        class="question-section"
        :class="`section-${section.key}`"
        :open="Boolean(printReferences)"
      >
      <summary>
        <span
          class="section-marker"
          aria-hidden="true"
        ></span>
        <span class="section-label">{{ section.label }}</span>
        <NavArrowRight
          class="section-chevron"
          width="15"
          height="15"
        />
      </summary>
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
    </div>
  </MmQuestion>
</template>

<style scoped>
.question-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.question-sections {
  display: flex;
  flex-direction: column;
  margin-top: 14px;
  border-top: 1px solid var(--border-subtle);
}
.question-section {
  --section-color: var(--tag-blue);
  min-width: 0;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
}
.section-focus {
  --section-color: var(--tag-purple);
}
.section-conclusion {
  --section-color: var(--tag-green);
}
.section-pitfalls {
  --section-color: var(--tag-orange);
}
.question-section summary {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 36px;
  padding: 6px 4px;
  color: var(--text-secondary);
  cursor: pointer;
  list-style: none;
}
.question-section summary::-webkit-details-marker {
  display: none;
}
.question-section summary:hover {
  background: var(--bg-hover);
}
.question-section summary:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
}
.section-marker {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: var(--section-color);
}
.section-label {
  flex: 1;
  font-size: 0.9em;
  font-weight: var(--font-weight-medium);
}
.question-section[open] .section-label {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}
.section-chevron {
  flex: none;
  color: var(--text-muted);
  transition: transform 160ms ease;
}
.question-section[open] .section-chevron {
  transform: rotate(90deg);
}
.section-content {
  min-width: 0;
  padding: 4px 8px 14px 19px;
  color: var(--text-primary);
}
@media print {
  .question-sections {
    border-top: 0;
  }
  .question-section {
    border: 0;
    background: transparent;
    break-inside: avoid;
  }
  .question-section summary {
    min-height: 0;
    padding: 8px 0 4px;
  }
  .section-marker,
  .section-chevron {
    display: none;
  }
  .section-content {
    padding: 0 0 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .section-chevron {
    transition: none;
  }
}
</style>
