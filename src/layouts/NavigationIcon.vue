<script setup>
import {
  BookWorkbench,
  Folder,
  Knowledge,
  KnowledgeWorkbench,
  MistakeBook,
  Platform,
  QuestionBank,
  QuestionWorkbench,
  Recommendation,
  Shelf
} from '../components/icons/icons.js';

defineProps({
  name: {
    type: String,
    required: true
  }
});

const icons = {
  'my-lecture': Shelf,
  knowledge: Knowledge,
  'question-bank': QuestionBank,
  'mistake-book': MistakeBook,
  'recom-lecture': Recommendation,
  'resource-center': Folder,
  'knowledge-workbench': KnowledgeWorkbench,
  'question-workbench': QuestionWorkbench,
  'book-workbench': BookWorkbench,
  platform: Platform
};

const colors = {
  'my-lecture': 'var(--tag-blue)',
  knowledge: 'var(--tag-purple)',
  'question-bank': 'var(--tag-green)',
  'mistake-book': 'var(--tag-red)',
  'recom-lecture': 'var(--tag-orange)',
  'resource-center': 'var(--tag-cyan)',
  'knowledge-workbench': 'var(--tag-purple)',
  'question-workbench': 'var(--tag-green)',
  'book-workbench': 'var(--tag-blue)',
  platform: 'var(--tag-amber)'
};
</script>

<template>
  <component
    :is="icons[name]"
    :style="{
      color: colors[name]
    }"
  />
</template>
