<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { knowledgeApi } from '../../api/knowledge.js';
import MButton from '../../components/MButton.vue';

const route = useRoute();
const point = ref(null);
const loading = ref(true);
const error = ref('');
let loadId = 0;

const load = async (id) => {
  const current = ++loadId;
  loading.value = true;
  error.value = '';
  point.value = null;
  try {
    const result = await knowledgeApi.get(encodeURIComponent(id));
    if (current === loadId) point.value = result;
  } catch (err) {
    if (current === loadId) error.value = err.status === 404 ? '知识点不存在' : '知识点加载失败';
  } finally {
    if (current === loadId) loading.value = false;
  }
};

watch(() => route.params.knowledgeId, load, { immediate: true });
onUnmounted(() => { loadId++; });
</script>

<template>
  <div class="knowledge-view">
    <p v-if="loading">正在加载知识点</p>
    <div v-else-if="error">
      <p>{{ error }}</p>
      <MButton variant="secondary" @click="load(route.params.knowledgeId)">重试</MButton>
    </div>
    <article v-else-if="point">
      <h1>{{ point.title }}</h1>
      <pre class="knowledge-source">{{ point.source || '' }}</pre>
    </article>
  </div>
</template>

<style scoped>
.knowledge-view {
  max-width: 960px;
  margin: 0 auto;
  padding: 28px;
}

.knowledge-source { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
</style>
