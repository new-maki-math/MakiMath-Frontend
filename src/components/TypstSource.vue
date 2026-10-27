<script setup>
import { ref, watch, onUnmounted } from 'vue';

const props = defineProps({
  source: {
    type: String,
    default: ''
  }
});

const pages = ref([]);
const error = ref('');
const loading = ref(false);
let project = null;
let projectPromise = null;
let generation = 0;
let disposed = false;

const clearPages = () => {
  for (const url of pages.value) URL.revokeObjectURL(url);
  pages.value = [];
};

watch(() => props.source, async (source) => {
  const current = ++generation;
  clearPages();
  error.value = '';
  if (!source) return;
  loading.value = true;
  try {
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
    await project.setText('/main.typ', source);
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
</style>
