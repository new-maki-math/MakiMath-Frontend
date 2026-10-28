<script setup>
import { mmMacros } from '../mm/registry.js';
import MmBox from '../mm/MmBox.vue';
import MmKnowledgeReference from '../mm/MmKnowledgeReference.vue';
import MmTag from '../mm/MmTag.vue';
import MmQuestion from '../mm/MmQuestion.vue';
import MmQuestionOptions from '../mm/MmQuestionOptions.vue';
import MmQuestionBlank from '../mm/MmQuestionBlank.vue';

defineOptions({ name: 'TypstNode' });
defineProps({ node: { type: Object, required: true } });

function optionLabel(index) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value--;
    result = String.fromCharCode(65 + value % 26) + result;
    value = Math.floor(value / 26);
  }
  return result;
}
</script>

<template>
  <template v-if="node.type === 'fragment'"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></template>
  <span v-else-if="node.type === 'horizontal-space'" class="typst-horizontal-space" :style="{ width: node.length }" />
  <div v-else-if="node.type === 'vertical-space'" :style="{ height: node.length }" />
  <div v-else-if="node.type === 'align'" :style="{ textAlign: node.alignment, '--typst-table-margin-left': node.alignment === 'left' ? '0' : 'auto', '--typst-table-margin-right': node.alignment === 'right' ? '0' : 'auto' }"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></div>
  <span v-else-if="node.type === 'text'">{{ node.text }}</span>
  <br v-else-if="node.type === 'linebreak'" />
  <span v-else-if="node.type === 'paragraph-break'" class="typst-paragraph-break" />
  <span v-else-if="node.type === 'styled-scope'" class="typst-styled-scope" :style="node.style" v-bind="node.attrs"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></span>
  <span v-else-if="node.type === 'styled-text'" :style="node.style" v-bind="node.attrs"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></span>
  <a v-else-if="node.type === 'link'" :href="node.href" target="_blank" rel="noopener noreferrer"><template v-if="node.children"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></template><template v-else>{{ node.text }}</template></a>
  <dl v-else-if="node.type === 'term-item'" class="typst-term"><dt><TypstNode v-for="child in node.term" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></dt><dd><TypstNode v-for="child in node.description" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></dd></dl>
  <span v-else-if="node.type === 'highlight'" :style="{ backgroundColor: node.color }"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></span>
  <u v-else-if="node.type === 'underline'"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></u>
  <s v-else-if="node.type === 'strike'"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></s>
  <component v-else-if="['overline', 'sub', 'super', 'smallcaps', 'hidden', 'inline-box', 'block-box'].includes(node.type)" :is="{ sub: 'sub', super: 'sup', 'block-box': 'div' }[node.type] || 'span'" :class="`typst-${node.type}`" :style="node.style"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></component>
  <strong v-else-if="node.type === 'strong'"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></strong>
  <em v-else-if="node.type === 'emph'"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></em>
  <component v-else-if="node.type === 'heading'" :is="`h${Math.min(node.level, 6)}`" :aria-level="node.level" role="heading" class="typst-heading"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></component>
  <ul v-else-if="node.type === 'list-item'" class="typst-list"><li><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></li></ul>
  <ol v-else-if="node.type === 'enum-item'" class="typst-list" :start="node.number"><li><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></li></ol>
  <pre v-else-if="node.type === 'raw' && node.block" class="typst-raw"><code>{{ node.text }}</code></pre>
  <code v-else-if="node.type === 'raw'" class="typst-inline-code">{{ node.text }}</code>
  <span v-else-if="node.type === 'math'" class="typst-math" :class="{ 'is-display': node.display }" v-html="node.html" />
  <div v-else-if="node.type === 'table'" class="typst-table-wrap" :class="{ 'has-bottom-line': node.hasBottomLine }">
    <table class="typst-table">
      <colgroup v-if="node.widths"><col v-for="(width, index) in node.widths" :key="index" :style="{ width }" /></colgroup>
      <tbody>
        <tr v-for="(row, index) in node.rows" :key="index">
          <component :is="cell.header ? 'th' : 'td'" v-for="(cell, col) in row" :key="cell.empty ? `empty:${col}` : `${cell.start}:${cell.end}`" :colspan="cell.colspan" :rowspan="cell.rowspan" :class="{ 'has-bottom-line': cell.bottomLine }" :style="cell.style">
            <TypstNode v-for="child in cell.children || []" :key="`${child.start}:${child.end}:${child.type}`" :node="child" />
          </component>
        </tr>
      </tbody>
    </table>
  </div>
  <MmKnowledgeReference v-else-if="node.type === 'mm-knowledge'" :knowledge-slug="node.knowledgeSlug" />
  <MmQuestion v-else-if="node.type === 'mm-question'" :source="node.source" :question-id="node.questionId" :difficulty="node.difficulty" :has-title="node.hasTitle" :has-body="node.hasBody">
    <template #title><TypstNode v-for="child in node.titleNodes" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></template>
    <TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" />
  </MmQuestion>
  <MmQuestionOptions v-else-if="node.type === 'mm-question-options'" :columns="node.columns">
    <div v-for="(option, index) in node.options" :key="`${option.start}:${option.end}`" class="typst-option"><span class="typst-option-label">{{ optionLabel(index) }}.</span><div class="typst-option-content"><TypstNode v-for="child in option.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></div></div>
  </MmQuestionOptions>
  <MmQuestionBlank v-else-if="node.type === 'mm-question-blank'" :width="node.width" />
  <MmTag v-else-if="node.type === 'mm-tag'" :color="node.color"><TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></MmTag>
  <MmBox v-else-if="node.type === 'mm-box'" :title="node.title" :tone="node.tone" :icon="node.icon" :has-title="Boolean(node.externalTitle) || node.hasTitle">
    <template #title><template v-if="node.externalTitle">{{ node.externalTitle }}</template><TypstNode v-else v-for="child in node.titleNodes" :key="`${child.start}:${child.end}:${child.type}`" :node="child" /></template>
    <template v-if="node.referenceBox" #actions><slot name="box-actions" /></template>
    <TypstNode v-for="child in node.children" :key="`${child.start}:${child.end}:${child.type}`" :node="child" />
  </MmBox>
  <component v-else-if="mmMacros[node.type]" :is="mmMacros[node.type]" />
  <code v-else-if="node.type === 'unsupported'" class="typst-unsupported">{{ node.text }}</code>
</template>

<style scoped>
.typst-option { display: flex; align-items: baseline; min-width: 0; gap: .4em; }
.typst-option-label { flex: none; color: var(--text-secondary); }
.typst-option-content { min-width: 0; overflow-x: auto; overflow-wrap: anywhere; }
.typst-horizontal-space { display: inline-block; }
.typst-styled-scope { display: contents; }
.typst-overline { text-decoration: overline; }
.typst-smallcaps { font-variant: small-caps; }
.typst-hidden { visibility: hidden; }
.typst-inline-box { display: inline-block; }
.typst-heading { margin: 1.1em 0 .5em; color: var(--text-primary); line-height: 1.4; }
.typst-table-wrap { max-width: 100%; overflow-x: auto; margin: 1em 0; }
.typst-table-wrap.has-bottom-line { padding-bottom: 8px; }
.typst-table .has-bottom-line { position: relative; }
.typst-table .has-bottom-line::after { content: ""; position: absolute; left: 0; right: 0; bottom: -7px; border-bottom: var(--typst-bottom-line); }
.typst-table { margin-left: var(--typst-table-margin-left, 0); margin-right: var(--typst-table-margin-right, 0); border-collapse: collapse; }
.typst-table td, .typst-table th { min-width: 0; padding: 6px 10px; border: 1px solid var(--border-subtle); vertical-align: top; }
.typst-table th { text-align: left; }
.typst-term { margin: .25em 0; }
.typst-term dt { font-weight: 600; }
.typst-term dd { margin-left: 1.5em; }
.typst-list { margin: .25em 0; padding-left: 1.5em; }
.typst-paragraph-break { display: block; height: .8em; }
.typst-raw { overflow-x: auto; padding: 12px; background: var(--bg-elevated); border-radius: var(--radius-xs); white-space: pre; }
.typst-inline-code { white-space: pre-wrap; overflow-wrap: anywhere; padding: 1px 4px; background: var(--bg-elevated); border-radius: var(--radius-xs); }
.typst-math { font-size: 1.3em; }
.typst-math.is-display { display: block; overflow-x: auto; margin: 1em 0; font-size: 1.4em; text-align: center; }
.typst-unsupported { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--tag-orange); }
</style>
