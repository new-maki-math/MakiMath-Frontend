<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { knowledgeApi } from '../api/knowledge.js';
import { findKnowledgeReferences } from '../utils/typst-knowledge-references.js';
import MButton from './MButton.vue';

const props = defineProps({
  source: {
    type: String,
    default: ''
  },
  resolveKnowledge: {
    type: Boolean,
    default: false
  }
});

const pages = ref([]);
const error = ref('');
const loading = ref(false);
const failedKnowledgeIds = ref([]);
const retryKey = ref(0);
let project = null;
let projectPromise = null;
let generation = 0;
let disposed = false;

const clearPages = () => {
  for (const url of pages.value) URL.revokeObjectURL(url);
  pages.value = [];
};

async function resolveSource(source) {
  const references = findKnowledgeReferences(source);
  const ids = [...new Set(references.map((reference) => reference.id))];
  const results = await Promise.all(ids.map(async (id) => {
    try {
      const point = await knowledgeApi.get(id);
      if (typeof point?.source !== 'string') throw new Error('知识点内容不完整');
      return { id, source: point.source };
    } catch (err) {
      return { id, status: err.status === 404 ? 'missing' : 'error' };
    }
  }));
  const byId = new Map(results.map((result) => [result.id, result]));
  let resolved = source;
  for (const reference of references.slice().sort((a, b) => b.from - a.from)) {
    const result = byId.get(reference.id);
    const replacement = result.status === 'missing'
      ? `#box[知识点 ${reference.id} 不存在或不可用]`
      : result.status === 'error'
        ? `#box[知识点 ${reference.id} 读取失败，请重试]`
        : result.source;
    resolved = resolved.slice(0, reference.from) + replacement + resolved.slice(reference.to);
  }
  return { source: resolved, failedIds: results.filter((item) => item.status === 'error').map((item) => item.id) };
}

watch([() => props.source, () => props.resolveKnowledge, retryKey], async ([source, resolveKnowledge]) => {
  const current = ++generation;
  clearPages();
  error.value = '';
  failedKnowledgeIds.value = [];
  if (!source) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const resolved = resolveKnowledge ? await resolveSource(source) : { source, failedIds: [] };
    if (current !== generation || disposed) return;
    failedKnowledgeIds.value = resolved.failedIds;
    if (!projectPromise) {
      projectPromise = (async () => {
        const runtimeUrl = `${import.meta.env.BASE_URL}typst/typst-editor.js`;
        const { TypstProject } = await import(/* @vite-ignore */ runtimeUrl);
        const instance = await TypstProject.create();
        if (disposed) {
          instance.destroy();
          throw new Error('页面已关闭');
        }
        project = instance;
        const response = await fetch(`${import.meta.env.BASE_URL}typst/fonts/NotoSansSC.otf`);
        if (!response.ok) throw new Error('无法加载讲义字体');
        await project.addFont(await response.arrayBuffer());
        return project;
      })();
    }
    await projectPromise;
    if (current !== generation) return;
    await project.setText('/main.typ', resolved.source);
    if (current !== generation || disposed) return;
    const result = await project.compile();
    if (current !== generation || disposed) return;
    const diagnostics = (result.diagnostics || []).filter((item) => item.severity === 'error');
    if (diagnostics.length) throw new Error(diagnostics.map((item) => item.message).join('；'));
    const rendered = await project.renderedPages(0, result.pages.length);
    if (current !== generation || disposed) return;
    pages.value = rendered.map((page) => URL.createObjectURL(new Blob([page.svg], { type: 'image/svg+xml' })));
  } catch (err) {
    if (current === generation && !disposed) error.value = err.message || '讲义排版失败';
  } finally {
    if (current === generation && !disposed) loading.value = false;
  }
}, { immediate: true });

onUnmounted(() => {
  disposed = true;
  generation++;
  clearPages();
  project?.destroy();
});
</script>

<template>
  <div class="typst-source">
    <p v-if="loading">正在排版讲义</p>
    <template v-else-if="error">
      <p class="typst-error">排版失败：{{ error }}</p>
      <pre>{{ source }}</pre>
    </template>
    <img v-for="(page, index) in pages" :key="page" :src="page" :alt="`讲义第 ${index + 1} 页`" />
    <div v-if="!loading && failedKnowledgeIds.length" class="knowledge-retry">
      <span>知识点 {{ failedKnowledgeIds.join('、') }} 读取失败</span>
      <MButton size="sm" @click="retryKey++">重试</MButton>
    </div>
  </div>
</template>

<style scoped>
.typst-source img {
  display: block;
  max-width: 100%;
  height: auto;
}

.typst-source pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.typst-error {
  color: var(--tag-red);
}

.knowledge-retry {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}
</style>
