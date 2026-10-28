<script setup>
import { computed, provide, useSlots } from 'vue';
import 'typlet/fonts/typlet.css';
import { parseDocument } from './typst/parse-document.js';
import TypstNode from './typst/TypstNode.vue';

defineOptions({ name: 'TypstDoc' });
const props = defineProps({ source: { type: String, default: '' }, boxTitle: { type: String, default: '' }, allowKnowledgeReferences: { type: Boolean, default: true } });
const slots = useSlots();
provide('typstKnowledgeReferencesAllowed', computed(() => props.allowKnowledgeReferences));
const result = computed(() => {
  try {
    const parsed = parseDocument(props.source);
    if (props.boxTitle || slots.boxActions) {
      const box = parsed.nodes.find((node) => node.type === 'mm-box');
      if (box) { box.externalTitle = props.boxTitle; box.referenceBox = Boolean(slots.boxActions); }
    }
    return parsed;
  }
  catch (error) { return { nodes: [{ type: 'unsupported', text: props.source, start: 0, end: props.source.length }], diagnostics: [{ severity: 'error', message: error.message || '文档解析失败', start: 0, end: 0, line: 1, column: 1 }] }; }
});
</script>

<template>
  <div class="typst-document">
    <div class="typst-content"><span v-for="node in result.nodes" :key="`${node.start}:${node.end}:${node.type}`" class="typst-source-anchor" :data-source-start="node.start" :data-source-end="node.end"><TypstNode :node="node"><template v-if="node.referenceBox" #box-actions><slot name="boxActions" /></template></TypstNode></span></div>
    <details v-if="result.diagnostics.length" class="typst-diagnostics">
      <summary>文档诊断 {{ result.diagnostics.length }}</summary>
      <ul><li v-for="(item, index) in result.diagnostics" :key="index"><span>{{ item.severity === 'error' ? '错误' : '提示' }} · 第 {{ item.line }} 行第 {{ item.column }} 列</span> {{ item.message }}</li></ul>
    </details>
  </div>
</template>

<style scoped>
.typst-document { min-width: 0; color: var(--text-primary); }
.typst-source-anchor { display: contents; }
.typst-content { overflow-wrap: anywhere; line-height: 1.75; }
.typst-diagnostics { margin-top: 20px; padding: 10px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); color: var(--text-secondary); font-size: var(--font-size-smaller); }
.typst-diagnostics summary { cursor: pointer; }
.typst-diagnostics ul { margin: 8px 0 0; padding-left: 20px; }
.typst-diagnostics li { margin: 4px 0; overflow-wrap: anywhere; }
.typst-diagnostics li span { color: var(--tag-orange); }
</style>
