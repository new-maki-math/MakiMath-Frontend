<script setup>
import { computed } from 'vue';
import { renderMarkdown } from '../utils/markdown';

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
});

const renderedHtml = computed(() => {
  return renderMarkdown(props.content);
});
</script>

<template>
  <div class="markdown-view" v-html="renderedHtml"></div>
</template>

<style scoped>
.markdown-view {
  width: 100%;
  max-width: 720px;
  margin-inline: auto;
  font-family: var(--font-doc);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.8;
  letter-spacing: 0;
  color: #d4d4d4;
  word-break: normal;
  overflow-wrap: anywhere;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.markdown-view :deep(> *:first-child) {
  margin-top: 0;
}

.markdown-view :deep(> *:last-child) {
  margin-bottom: 0;
}

/* 标题 */
.markdown-view :deep(h1),
.markdown-view :deep(h2),
.markdown-view :deep(h3),
.markdown-view :deep(h4),
.markdown-view :deep(h5),
.markdown-view :deep(h6) {
  color: #f5f5f5;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.45;
}

.markdown-view :deep(h1) {
  margin: 1.8em 0 0.8em;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.4;
}

.markdown-view :deep(h2) {
  margin: 1.7em 0 0.7em;
  font-size: 21px;
}

.markdown-view :deep(h3) {
  margin: 1.5em 0 0.6em;
  font-size: 18px;
}

.markdown-view :deep(h4) {
  margin: 1.3em 0 0.5em;
  font-size: 16px;
}

.markdown-view :deep(h5) {
  margin: 1.2em 0 0.5em;
  font-size: 15px;
}

.markdown-view :deep(h6) {
  margin: 1.2em 0 0.5em;
  font-size: 14px;
  color: #b3b3b3;
}

/* 正文 */
.markdown-view :deep(p) {
  margin: 0 0 1em;
  line-height: 1.8;
}

.markdown-view :deep(strong),
.markdown-view :deep(b) {
  color: #f5f5f5;
  font-weight: 600;
}

.markdown-view :deep(em),
.markdown-view :deep(i) {
  color: #e5e5e5;
}

.markdown-view :deep(del),
.markdown-view :deep(s) {
  color: #8a8a8a;
}

/* 链接 */
.markdown-view :deep(a) {
  color: var(--accent-primary);
  text-decoration: none;
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
}

.markdown-view :deep(a:hover) {
  text-decoration: underline;
}

/* 列表 */
.markdown-view :deep(ul),
.markdown-view :deep(ol) {
  margin: 0.55em 0 1.1em;
  padding-left: 1.65em;
}

.markdown-view :deep(li) {
  padding-left: 0.1em;
  margin-bottom: 0.35em;
  line-height: 1.75;
}

.markdown-view :deep(li::marker) {
  color: #8a8a8a;
}

.markdown-view :deep(li:last-child) {
  margin-bottom: 0;
}

.markdown-view :deep(li > p) {
  margin-bottom: 0.55em;
  line-height: 1.8;
}

.markdown-view :deep(li > ul),
.markdown-view :deep(li > ol) {
  margin-top: 0.35em;
  margin-bottom: 0.55em;
}

/* 引用 */
.markdown-view :deep(blockquote) {
  margin: 1.35em 0;
  padding: 0.15em 0 0.15em 1em;
  border-left: 2px solid var(--border-subtle);
  color: #a3a3a3;
  font-size: 15px;
  line-height: 1.8;
}

.markdown-view :deep(blockquote p) {
  color: inherit;
  margin-bottom: 0.6em;
  line-height: inherit;
}

.markdown-view :deep(blockquote p:last-child) {
  margin-bottom: 0;
}

.markdown-view :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border-subtle);
  margin: 1.8em 0;
}

/* 数学公式：行内公式 */
.markdown-view :deep(.katex) {
  color: #e5e5e5;
  font-size: 1.05em;
  letter-spacing: 0;
}

/* 行内公式可能包含高分式、根号和上下标 */
.markdown-view :deep(p .katex),
.markdown-view :deep(li .katex),
.markdown-view :deep(blockquote .katex) {
  line-height: normal;
}

/* 独立公式容器 */
.markdown-view :deep(.math-block-wrap) {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0;
  padding: 0.5em 0;
  text-align: center;
  line-height: normal;
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-width: thin;
}

/* KaTeX 独立公式 */
.markdown-view :deep(.katex-display) {
  box-sizing: border-box;
  max-width: 100%;
  margin: 0.65em 0;
  padding: 0.35em 0 0.45em;
  overflow-x: auto;
  overflow-y: visible;
  text-align: center;
  line-height: normal;
  scrollbar-width: thin;
}

/* 防止公式内部元素继承异常的行高 */
.markdown-view :deep(.katex-display .katex) {
  line-height: normal;
}

/* 数学公式报错 */
.markdown-view :deep(.katex-error) {
  color: #f87171;
  font-family: var(--font-mono);
  font-size: 0.9em;
}

/* 表格 */
.markdown-view :deep(table) {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 1.3em 0;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.7;
  overflow-x: auto;
}

.markdown-view :deep(th),
.markdown-view :deep(td) {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border-subtle);
  text-align: left;
  vertical-align: top;
}

.markdown-view :deep(th) {
  color: #f5f5f5;
  font-weight: 600;
  background: transparent;
}

.markdown-view :deep(td) {
  color: #d4d4d4;
}

/* 行内代码 */
.markdown-view :deep(:not(pre) > code) {
  padding: 0.15em 0.35em;
  border: 0;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.07);
  color: #d4d4d4;
  font-family: var(--font-mono);
  font-size: 0.88em;
  font-weight: 400;
  line-height: inherit;
  letter-spacing: 0;
}

/* 代码块 */
.markdown-view :deep(pre) {
  box-sizing: border-box;
  max-width: 100%;
  margin: 1.3em 0;
  padding: 14px 16px;
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: #1a1a1a;
  line-height: 1.65;
  scrollbar-width: thin;
}

.markdown-view :deep(pre code) {
  padding: 0;
  border: 0;
  background: transparent;
  color: #e5e5e5;
  font-family: var(--font-mono);
  font-size: 13.5px;
  font-weight: 400;
  line-height: inherit;
  letter-spacing: 0;
}

/* 定理、证明和解答 */
.markdown-view :deep(.doc-node) {
  margin: 1.5em 0;
}

.markdown-view :deep(.node-proof),
.markdown-view :deep(.node-solution) {
  margin: 1.3em 0;
  padding: 14px 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  line-height: 1.8;
}

/* 特殊区块中的独立公式 */
.markdown-view :deep(.node-proof .katex-display),
.markdown-view :deep(.node-solution .katex-display) {
  margin: 0.8em 0;
}

.markdown-view :deep(.proof-label),
.markdown-view :deep(.solution-label) {
  display: block;
  margin-bottom: 0.6em;
  color: #a3a3a3;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

/* 小屏幕 */
@media (max-width: 768px) {
  .markdown-view {
    max-width: 100%;
    font-size: 16px;
  }

  .markdown-view :deep(h1) {
    font-size: 23px;
  }

  .markdown-view :deep(h2) {
    font-size: 20px;
  }

  .markdown-view :deep(.math-block-wrap) {
    margin-block: 1.2em;
    padding-inline: 0;
  }

  .markdown-view :deep(th),
  .markdown-view :deep(td) {
    padding: 8px;
  }

  .markdown-view :deep(pre) {
    padding: 12px;
  }
}
</style>