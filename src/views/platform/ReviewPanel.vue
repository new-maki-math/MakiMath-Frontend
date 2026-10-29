<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { reviewApi } from '../../api/reviews.js';
import { lectureLocation } from '../../utils/lecture-route.js';
import { notify } from '../../components/MNotice.vue';
import MButton from '../../components/MButton.vue';
import MTable from '../../components/MTable.vue';

const router = useRouter();
const kind = ref('lecture');
const items = ref([]);
const loading = ref(false);
let loadId = 0;

async function load() {
  const id = ++loadId;
  loading.value = true;
  try {
    const result = await reviewApi.pending(kind.value);
    if (id === loadId) items.value = result;
  } catch (error) {
    if (id === loadId) notify(error.message || '加载审核列表失败', 'error');
  } finally {
    if (id === loadId) loading.value = false;
  }
}

function openReview(item) {
  if (!item.lecture_slug || !item.id) { notify('讲义或审核版本标识缺失，请刷新审核列表', 'error'); return; }
  router.push(lectureLocation({ slug: item.lecture_slug, revisionId: String(item.id), origin: 'platform-reviews' }));
}

watch(kind, () => { items.value = []; load(); }, { immediate: true });
</script>

<template>
  <section class="review-panel font-mono">
    <h1>内容审核</h1>
    <MTable :data="items" :loading="loading">
      <template #header><th>版本</th><th>标题</th><th>提交时间</th><th>操作</th></template>
      <template #rows="{ data }">
        <tr v-for="item in data" :key="item.id">
          <td>{{ item.id }}</td><td>{{ item.title }}</td><td>{{ item.submitted_at }}</td>
          <td><MButton size="sm" @click="openReview(item)">审核</MButton></td>
        </tr>
      </template>
    </MTable>
  </section>
</template>

<style scoped>
.review-panel { display: flex; flex-direction: column; gap: 16px; }
</style>
