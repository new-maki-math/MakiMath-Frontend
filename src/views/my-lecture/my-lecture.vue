<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { lectureApi } from '../../api/lectures.js';
import { authStatus, currentUser, initAuth } from '../../utils/auth.js';
import { listLocalLectures } from '../../utils/local-lectures.js';
import MButton from '../../components/MButton.vue';
import MLectureCover from '../../components/MLectureCover.vue';
import MHorizontalShelf from '../../components/MHorizontalShelf.vue';
import LectureVersionStack from './LectureVersionStack.vue';
import { notify } from '../../components/MNotice.vue';
import { validateLocalLectureSlug } from '../../utils/local-lectures.js';
import { lectureLocation } from '../../utils/lecture-route.js';

const router = useRouter();
const localLectures = ref([]);
const onlineLectures = ref([]);
const localLoading = ref(true);
const onlineLoading = ref(false);
const localError = ref('');
const onlineError = ref('');
let localSequence = 0;
let onlineSequence = 0;

async function loadLocal() {
  const sequence = ++localSequence;
  localLoading.value = true;
  localError.value = '';
  try {
    const items = await listLocalLectures();
    if (sequence === localSequence) localLectures.value = items;
  } catch {
    if (sequence === localSequence) localError.value = '本地讲义加载失败';
  } finally {
    if (sequence === localSequence) localLoading.value = false;
  }
}

async function loadOnline() {
  const sequence = ++onlineSequence;
  onlineLectures.value = [];
  onlineError.value = '';
  if (authStatus.value !== 'authenticated') {
    onlineLoading.value = false;
    return;
  }
  onlineLoading.value = true;
  try {
    const items = await lectureApi.owned();
    if (!Array.isArray(items)) throw new Error('我创作的讲义列表格式错误');
    if (sequence !== onlineSequence) return;
    onlineLectures.value = items.map((item) => {
      if (!Array.isArray(item.versions)) return { ...item, title: '讲义版本加载失败', versions: [], versionsError: true };
      const draftCount = item.versions.filter((entry) => entry.kind === 'working_draft').length;
      const versions = item.versions.map((entry) => ({
        ...entry,
        invalidDraft: (entry.kind === 'working_draft' && (entry.status !== 'draft' || draftCount > 1)) || (entry.kind === 'snapshot' && entry.status === 'draft') || (entry.is_public && (entry.kind !== 'snapshot' || entry.status !== 'approved')) || !['working_draft', 'snapshot'].includes(entry.kind)
      }));
      const draft = versions.find((entry) => entry.kind === 'working_draft' && !entry.invalidDraft);
      const first = draft || versions.find((entry) => !entry.invalidDraft);
      return { ...item, title: first?.title || '未命名讲义', subtitle: draft?.descr || '', coverVersion: draft || null, versions };
    });
  } catch {
    if (sequence === onlineSequence) onlineError.value = '我创作的讲义加载失败';
  } finally {
    if (sequence === onlineSequence) onlineLoading.value = false;
  }
}

function openVersion(lecture, version) {
  if (!lecture.slug || !version.revision_id || version.invalidDraft) { notify('讲义或版本标识缺失，无法打开', 'warn'); return; }
  router.push(lectureLocation({ slug: lecture.slug, revisionId: version.is_public ? undefined : String(version.revision_id), origin: 'my-lecture' }));
}


function openLecture(source, lecture) {
  if (source === 'local') {
    try { validateLocalLectureSlug(lecture.slug); }
    catch (error) { notify('本地讲义标识无效，请在讲义工作台修改', 'warn'); return; }
    if (localLectures.value.filter((item) => item.slug === lecture.slug).length !== 1) { notify('本地讲义标识重复，请在讲义工作台修改', 'warn'); return; }
    router.push(lectureLocation({ source: 'local', slug: lecture.slug, origin: 'my-lecture' }));
    return;
  }
  if (!lecture.slug) { notify('我创作的讲义缺少标识，无法打开', 'warn'); return; }
  router.push(lectureLocation({ slug: lecture.slug, origin: 'my-lecture' }));
}

watch([authStatus, () => currentUser.value?.id], loadOnline, { immediate: true });
onMounted(() => { loadLocal(); initAuth(); });
onUnmounted(() => { localSequence++; onlineSequence++; });
</script>

<template>
  <main class="my-lecture">
    <section class="shelf-section">
      <h1>本地讲义</h1>
      <p v-if="localLoading" class="shelf-message">正在加载本地讲义…</p>
      <p v-else-if="localError" class="shelf-message error">{{ localError }} <MButton size="sm" variant="ghost" @click="loadLocal">重试</MButton></p>
      <p v-else-if="!localLectures.length" class="shelf-message">暂无本地讲义</p>
      <MHorizontalShelf v-else>
        <MLectureCover v-for="lecture in localLectures" :key="lecture.id" :title="lecture.revision?.title || '未命名讲义'" :subtitle="lecture.revision?.subtitle || ''" :image="lecture.cover || ''" @click="openLecture('local', lecture)" />
      </MHorizontalShelf>
    </section>
    <section class="shelf-section">
      <h2>我创作的讲义</h2>
      <p v-if="authStatus === 'initializing' || (onlineLoading && !onlineLectures.length)" class="shelf-message">正在加载我创作的讲义…</p>
      <p v-else-if="authStatus === 'error'" class="shelf-message error">登录状态确认失败 <MButton size="sm" variant="ghost" @click="initAuth">重试</MButton></p>
      <p v-else-if="authStatus !== 'authenticated'" class="shelf-message">登录后查看我创作的讲义</p>
      <p v-else-if="onlineError" class="shelf-message error">{{ onlineError }} <MButton size="sm" variant="ghost" @click="loadOnline">重试</MButton></p>
      <p v-else-if="!onlineLectures.length" class="shelf-message">暂无我创作的讲义</p>
      <MHorizontalShelf v-else>
        <LectureVersionStack v-for="lecture in onlineLectures" :key="lecture.id" :lecture="lecture" @open="openVersion" @retry="loadOnline" />
      </MHorizontalShelf>
    </section>
  </main>
</template>

<style scoped>
.my-lecture { display: flex; flex: 1; flex-direction: column; gap: clamp(20px, 3vh, 36px); box-sizing: border-box; min-width: 0; min-height: 0; overflow: hidden; padding: 20px clamp(20px, 3vw, 40px) clamp(20px, 3vw, 40px); color: var(--text-primary); }
.shelf-section { display: flex; flex: 1 1 0; flex-direction: column; min-width: 0; min-height: 0; }
h1, h2 { flex: none; margin: 0 0 16px; font-size: var(--font-size-larger); font-weight: var(--font-weight-semibold); }
.shelf-message { margin: 0; color: var(--text-muted); font-size: var(--font-size-smaller); }
.shelf-message.error { color: var(--tag-red); }
@media (max-width: 480px) { .my-lecture { padding: 14px 16px 20px; } }
</style>
