<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { knowledgeApi } from '../../api/knowledge.js';
import MButton from '../../components/MButton.vue';
import MTable from '../../components/MTable.vue';

const router = useRouter();
const points = ref([]);
const loading = ref(false);
const error = ref('');

const load = async () => {
  loading.value = true;
  error.value = '';
  try {
    points.value = await knowledgeApi.list();
  } catch (err) {
    error.value = '知识库加载失败';
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <section class="knowledge-library">
    <h1>知识库</h1>
    <p>浏览已公开的知识点</p>
    <div v-if="error">
      <span>{{ error }}</span>
      <MButton size="sm" @click="load">重试</MButton>
    </div>
    <MTable v-else :data="points" :loading="loading" empty-text="暂无公开知识点">
      <template #header><th>知识点</th><th>简介</th><th>操作</th></template>
      <template #rows="{ data }">
        <tr v-for="point in data" :key="point.id">
          <td>{{ point.title }}</td><td>{{ point.summary || '-' }}</td>
          <td><MButton size="sm" @click="router.push(`/knowledge/${point.id}`)">查看</MButton></td>
        </tr>
      </template>
    </MTable>
  </section>
</template>

<style scoped>
.knowledge-library {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px;
}

.knowledge-library p {
  color: var(--text-secondary);
}
</style>
