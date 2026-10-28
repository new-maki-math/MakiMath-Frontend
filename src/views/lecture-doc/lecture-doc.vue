<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { List } from '@iconoir/vue';
import { getCourseSectionContent, toChapters } from '../../api/courses.js';
import { fetchShelfLectureTree } from '../../utils/shelf-lecture.js';
import { lectureLocation, lectureNavigationOrigin } from '../../utils/lecture-route.js';
import { authStatus, currentUser } from '../../utils/auth.js';
import ChapterNav from './ChapterNav.vue';
import DocFooterNav from './DocFooterNav.vue';
import TypstDoc from '../../components/Renderer/TypstDoc.vue';

const route = useRoute();
const router = useRouter();
const source = computed(() => route.name === 'local-lecture-doc' ? 'local' : 'online');
const slug = computed(() => route.params.lectureSlug);
const sectionId = computed(() => String(route.params.sectionId || ''));
const revisionId = computed(() => route.query.revision_id ?? '');
const chapters = ref([]);
const content = ref(null);
const loading = ref(true);
const error = ref('');
const retryKey = ref(0);
const drawerOpen = ref(false);
let sequence = 0;

const sections = computed(() => chapters.value.flatMap((chapter) => chapter.sections.map((section) => ({ ...section, chapterTag: chapter.tag, chapterTitle: chapter.title }))));
const currentIndex = computed(() => sections.value.findIndex((section) => String(section.id) === String(content.value?.id)));
const previous = computed(() => currentIndex.value > 0 ? sections.value[currentIndex.value - 1] : null);
const next = computed(() => currentIndex.value >= 0 ? sections.value[currentIndex.value + 1] || null : null);

function selectSection(section) {
  if (!section?.id) return;
  drawerOpen.value = false;
  router.push(lectureLocation({ source: source.value, slug: slug.value, sectionId: String(section.id), revisionId: revisionId.value, origin: lectureNavigationOrigin() }));
}

watch([slug, sectionId, source, revisionId, retryKey, () => source.value === 'online' ? authStatus.value : null, () => source.value === 'online' ? currentUser.value?.id : null], async ([lectureSlug, selectedId]) => {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  content.value = null;
  chapters.value = [];
  try {
    const tree = await fetchShelfLectureTree(lectureSlug, source.value, revisionId.value);
    if (current !== sequence) return;
    const items = toChapters(tree);
    const available = items.flatMap((chapter) => chapter.sections);
    const section = selectedId ? available.find((item) => String(item.id) === selectedId) : available[0];
    if (selectedId && !section) { const failure = new Error('讲义小节不存在或已更新'); failure.status = 404; throw failure; }
    chapters.value = items;
    if (section) {
      const loaded = await getCourseSectionContent(lectureSlug, section.id, tree);
      if (current === sequence) content.value = loaded;
    }
  } catch (failure) {
    if (current === sequence) error.value = failure.status === 404 ? '讲义或小节不存在、无权访问或已更新，请返回列表刷新' : failure.message || '讲义加载失败，请重试';
  } finally {
    if (current === sequence) loading.value = false;
  }
}, { immediate: true });
onUnmounted(() => { sequence++; });
</script>

<template>
  <div class="lecture-doc-view">
    <button class="drawer-open-btn" type="button" @click="drawerOpen = true"><List width="14" height="14" /><span>目录</span></button>
    <MDrawer :open="drawerOpen" placement="left" title="CHAPTERS // 目录" width="300px" @close="drawerOpen = false">
      <ChapterNav :chapters="chapters" :current-section-id="String(content?.id || '')" @select-section="selectSection" />
    </MDrawer>
    <main class="reading-viewport">
      <div class="reading-content-wrap">
        <p v-if="loading" class="reading-note">正在加载讲义…</p>
        <div v-else-if="error" class="reading-note"><p>{{ error }}</p><MButton size="sm" @click="retryKey++">重试</MButton></div>
        <template v-else-if="content">
          <header class="doc-header"><h1>{{ content.title }}</h1><p v-if="content.lead">{{ content.lead }}</p></header>
          <TypstDoc v-if="content.source" :source="content.source" />
          <p v-else class="reading-note">暂无源码</p>
        </template>
        <p v-else class="reading-note">暂无讲义小节</p>
        <DocFooterNav v-if="!loading && !error" :prev-section="previous" :next-section="next" @select-section="selectSection" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.lecture-doc-view { display: flex; flex: 1; position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.drawer-open-btn { position: absolute; top: 16px; left: 16px; z-index: 1; display: inline-flex; align-items: center; gap: 6px; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); background: var(--bg-surface); color: var(--text-secondary); cursor: pointer; }
.drawer-open-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.drawer-open-btn:focus-visible { outline: 2px solid var(--accent-primary); }
.reading-viewport { flex: 1; min-width: 0; overflow-y: auto; }
.reading-content-wrap { box-sizing: border-box; max-width: 920px; margin: 0 auto; padding: 32px clamp(20px, 5vw, 48px) 64px; }
.doc-header { margin-bottom: 24px; }
.doc-header h1 { color: var(--text-primary); font-size: var(--font-size-largest); }
.doc-header p, .reading-note { color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.6; }
@media (max-width: 768px) { .reading-content-wrap { padding-top: 64px; } }
</style>
