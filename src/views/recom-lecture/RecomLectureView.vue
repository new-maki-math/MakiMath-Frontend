<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { lectureApi } from '../../api/lectures.js';
import MButton from '../../components/MButton.vue';
import MLectureCover from '../../components/MLectureCover.vue';
import { notify } from '../../components/MNotice.vue';
import { lectureLocation } from '../../utils/lecture-route.js';

const router = useRouter();
const lectures = ref([]);
const loading = ref(true);
const error = ref('');
let loadSequence = 0;

async function load() {
  const sequence = ++loadSequence;
  loading.value = true;
  error.value = '';
  try {
    const items = await lectureApi.list();
    if (!Array.isArray(items)) {
      throw new Error('讲义列表格式错误');
    }
    if (sequence === loadSequence) {
      lectures.value = items;
    }
  } catch {
    if (sequence === loadSequence) {
      lectures.value = [];
      error.value = '讲义加载失败';
    }
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }
}

function openLecture(lecture) {
  if (!lecture.slug) {
    notify('讲义标识缺失，请刷新列表', 'warn');
    return;
  }
  router.push(
    lectureLocation({
      slug: lecture.slug,
      origin: 'recom-lecture'
    })
  );
}

onMounted(load);
onUnmounted(() => {
  loadSequence++;
});
</script>

<template>
  <main class="recom-lecture-view">
    <h1>所有讲义</h1>
    <p
      v-if="loading"
      class="shelf-message"
    >
      正在加载讲义…
    </p>
    <p
      v-else-if="error"
      class="shelf-message error"
    >
      {{ error }}
      <MButton
        size="sm"
        variant="ghost"
        @click="load"
        >重试</MButton
      >
    </p>
    <p
      v-else-if="!lectures.length"
      class="shelf-message"
    >
      暂无讲义
    </p>
    <div
      v-else
      class="lecture-grid"
    >
      <MLectureCover
        v-for="lecture in lectures"
        :key="lecture.id"
        :title="lecture.title || '未命名讲义'"
        :subtitle="lecture.subtitle || ''"
        :cover-revision-id="lecture.revision_id"
        :cover-hash="lecture.cover_hash || ''"
        :has-cover="Boolean(lecture.has_cover)"
        @click="openLecture(lecture)"
      />
    </div>
  </main>
</template>

<style scoped>
.recom-lecture-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  padding: 20px clamp(20px, 3vw, 40px) clamp(20px, 3vw, 40px);
  color: var(--text-primary);
}
h1 {
  flex: none;
  margin: 0 0 16px;
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
}
.lecture-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 180px));
  align-content: start;
  gap: 24px;
}
.shelf-message {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.shelf-message.error {
  color: var(--tag-red);
}
@media (max-width: 480px) {
  .recom-lecture-view {
    padding: 14px 16px 20px;
  }
  .lecture-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
}
</style>
