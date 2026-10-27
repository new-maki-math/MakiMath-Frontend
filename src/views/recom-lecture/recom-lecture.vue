<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { fetchSearchRecommendations } from '../../api/courses.js';
import MButton from '../../components/MButton.vue';

const router = useRouter();
const lectures = ref([]);
const loading = ref(true);
const error = ref('');

const load = async () => {
  loading.value = true;
  error.value = '';
  try {
    lectures.value = await fetchSearchRecommendations(100);
  } catch {
    error.value = '推荐讲义加载失败';
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div class="recom-lecture-view">
    <div class="coming-soon-box font-mono">
      <span class="coming-soon-tag">RECOMMENDED // 讲义推荐</span>
      <p v-if="loading" class="coming-soon-desc">正在加载推荐讲义</p>
      <template v-else-if="error">
        <p class="coming-soon-desc">{{ error }}</p>
        <MButton size="sm" @click="load">重试</MButton>
      </template>
      <p v-else-if="lectures.length === 0" class="coming-soon-desc">暂无推荐讲义</p>
      <div v-else class="recommended-list">
        <MButton v-for="lecture in lectures" :key="lecture.id" variant="secondary" @click="router.push(`/course/${lecture.id}`)">
          {{ lecture.title }}
        </MButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recom-lecture-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 140px);
  width: 100%;
  padding: 24px 16px;
  box-sizing: border-box;
}

.coming-soon-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
  user-select: none;
}

.coming-soon-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-xs, 2px);
  background-color: var(--accent-muted, rgba(56, 189, 248, 0.12));
  color: var(--accent-primary, #38bdf8);
  font-size: var(--font-size-smallest, 12px);
  letter-spacing: 1.5px;
}

.coming-soon-title {
  font-size: clamp(28px, 6vw, 44px);
  font-weight: var(--font-weight-bold, 700);
  color: var(--text-primary, #ffffff);
  letter-spacing: 4px;
  line-height: 1.2;
}

.coming-soon-desc {
  font-size: var(--font-size, 14px);
  color: var(--text-muted, #808080);
  letter-spacing: 0.5px;
}

.recommended-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}
</style>
