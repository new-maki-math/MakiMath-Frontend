<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { lectureApi } from '../../api/lectures.js';
import MButton from '../../components/MButton.vue';
import MDataView from '../../components/MDataView.vue';
import MEmpty from '../../components/MEmpty.vue';
import MLectureCover from '../../components/MLectureCover.vue';
import { notify } from '../../components/MNotice.vue';
import MTabs from '../../components/MTabs.vue';
import { lectureLocation } from '../../utils/lecture-route.js';

const router = useRouter();
const lectures = ref([]);
const selectedType = ref('lecture');
const bookTypes = [
  {
    label: '讲义',
    value: 'lecture'
  },
  {
    label: '题目册',
    value: 'question-book'
  }
];
const visibleBooks = computed(() =>
  lectures.value.filter(
    (item) => item.kind === (selectedType.value === 'lecture' ? 'lecture' : 'workbook')
  )
);
const loading = ref(true);
const error = ref('');
let loadSequence = 0;

async function load() {
  const sequence = ++loadSequence;
  loading.value = true;
  error.value = '';
  try {
    const items = await lectureApi.list();
    if (
      !Array.isArray(items) ||
      items.some((item) => !['lecture', 'workbook'].includes(item.kind))
    ) {
      throw new Error('图书列表格式错误');
    }
    if (sequence === loadSequence) {
      lectures.value = items;
    }
  } catch {
    if (sequence === loadSequence) {
      lectures.value = [];
      error.value = '图书加载失败';
    }
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }
}

function openLecture(lecture) {
  if (lecture.kind === 'workbook') {
    notify('题目册阅读暂未开放', 'info');
    return;
  }
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
    <MTabs
      v-model="selectedType"
      :tabs="bookTypes"
      class="book-tabs"
    />
    <MDataView
      :loading="loading"
      text="正在加载图书…"
      :animate="!!visibleBooks.length && !error"
    >
      <p
        v-if="error"
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
      <MEmpty v-else-if="!visibleBooks.length" />
      <div
        v-else
        class="lecture-grid"
      >
        <MLectureCover
          v-for="lecture in visibleBooks"
          :key="lecture.id"
          :title="lecture.title || '未命名图书'"
          :subtitle="lecture.subtitle || ''"
          :cover-revision-id="lecture.revision_id"
          :cover-hash="lecture.cover_hash || ''"
          :has-cover="Boolean(lecture.has_cover)"
          @click="openLecture(lecture)"
        />
      </div>
    </MDataView>
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
.book-tabs {
  flex: none;
  width: 240px;
  max-width: 100%;
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
