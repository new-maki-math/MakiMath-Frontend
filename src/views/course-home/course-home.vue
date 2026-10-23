<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCourseById, getCourseChapters } from '../../api';
import { NavArrowRight } from '@iconoir/vue';

const route = useRoute();
const router = useRouter();

const courseId = computed(() => route.params.courseId || 'kaoyan');
const course = ref(null);
const chapters = ref([]);
const openChapters = ref(new Set());
const isLoading = ref(true);

const totalSectionsCount = computed(() => {
  return chapters.value.reduce((acc, c) => acc + (c.sections?.length || 0), 0);
});

// 构建供路线图组件直接消费的目录树
const courseTree = computed(() => {
  if (!course.value && chapters.value.length === 0) return null;
  return {
    id: course.value?.dbId || course.value?.id || courseId.value,
    title: course.value?.title || '当前课程',
    chapters: chapters.value
  };
});

const toggleChapter = (chapterId) => {
  if (openChapters.value.has(chapterId)) {
    openChapters.value.delete(chapterId);
  } else {
    openChapters.value.add(chapterId);
  }
};

const expandAll = () => {
  openChapters.value = new Set(chapters.value.map(c => c.id));
};

const collapseAll = () => {
  openChapters.value.clear();
};

const openLecture = (sectionId) => {
  router.push(`/course/${course.value?.id || courseId.value}/doc/${sectionId}`);
};

const enterDoc = () => {
  // 无小节时不跳转
  const firstSecId = chapters.value[0]?.sections?.[0]?.id;
  if (!firstSecId) return;
  openLecture(firstSecId);
};

const scrollToCatalog = () => {
  const el = document.getElementById('curriculum-toc');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const scrollToChapter = (chapterId) => {
  if (!chapterId) return;
  openChapters.value.add(chapterId);
  setTimeout(() => {
    const el = document.getElementById(`chapter-${chapterId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
};

const loadCourseData = async (slug) => {
  if (!slug) return;
  isLoading.value = true;
  try {
    course.value = await getCourseById(slug);
    const chaps = await getCourseChapters(slug);
    chapters.value = chaps;
    // 默认展开所有章节
    openChapters.value = new Set(chaps.map(c => c.id));
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadCourseData(courseId.value);
});

watch(courseId, (newId) => {
  loadCourseData(newId);
});
</script>

<template>
  <div class="view-container">
    <!-- 加载占位 -->
    <div v-if="isLoading" class="course-loading font-mono">
      LOADING COURSE DATA // {{ courseId }}...
    </div>

    <!-- 课程详情 -->
    <template v-else-if="course">
      <!-- 课程头部 -->
      <header class="course-header">
        <div class="header-tags">
          <MTag v-if="course.category" variant="purple" size="md">
            分类: {{ course.category }}
          </MTag>
          <MTag v-if="course.live" variant="green" size="md" :dot="true">
            STATUS: ONLINE
          </MTag>
          <MTag v-else variant="amber" size="md" :dot="true">
            STATUS: PLANNING
          </MTag>
        </div>

        <h1 class="course-title">{{ course.title }}</h1>
        <p class="course-desc">
          {{ course.desc || '暂无课程描述信息。' }}
        </p>

        <!-- 快捷操作栏 -->
        <div class="course-actions">
          <MButton
            v-if="course.live"
            variant="primary"
            :mono="true"
            @click="enterDoc"
          >
            阅读讲义 // READ LECTURE
          </MButton>
          <MButton
            v-else
            variant="ghost"
            :mono="true"
            disabled
          >
            筹划编排中 // COMING SOON
          </MButton>

          <MButton
            variant="secondary"
            :mono="true"
            @click="scrollToCatalog"
          >
            查看大纲目录 // OUTLINE
          </MButton>
        </div>
      </header>

      <!-- 概览卡片区 -->
      <section class="course-sections">
        <div class="grid-layout">
          <!-- 课程概览 -->
          <div class="spec-card">
            <div class="card-header">
              <span class="card-title font-mono">OVERVIEW // 课程概要</span>
              <MTag variant="muted" size="sm">{{ course.id }}</MTag>
            </div>
            <div class="spec-body">
              <div class="spec-item">
                <span class="spec-label">收录节点</span>
                <span class="spec-value font-mono">
                  {{ course.live ? `${totalSectionsCount || course.nodes || 0} 讲` : '待上线' }}
                </span>
              </div>
              <div class="spec-item">
                <span class="spec-label">所属分类</span>
                <span class="spec-value">{{ course.category }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">编排状态</span>
                <span class="spec-value">{{ course.live ? '已完成公理化校对' : '大纲筹备与内容撰写中' }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">排版引擎</span>
                <span class="spec-value font-mono">Typst Math Engine (v0.12)</span>
              </div>
            </div>
          </div>

          <!-- 学习指引 -->
          <div class="spec-card">
            <div class="card-header">
              <span class="card-title font-mono">PREREQUISITES // 学习指引</span>
            </div>
            <div class="spec-body">
              <p class="guide-text">
                本课程基于公理化网络构建，各章节与定义按严谨的偏序依赖图编排。
                建议顺着知识图谱的前置泡泡逐步推进，避免跳跃性阅读。
              </p>
              <div class="guide-note font-mono">
                TIP: 点击下方目录中的任一讲次即可直接进入全屏讲义阅读。
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 知识路线图 -->
      <section class="roadmap-section">
        <div class="roadmap-header">
          <div class="section-title-wrap">
            <span class="section-kicker font-mono">RELATIONSHIP GRAPH</span>
            <h2 class="section-heading">知识谱系与路线图</h2>
          </div>
          <div class="roadmap-meta font-mono">
            <span>OBSIDIAN-STYLE INTERACTIVE MAP</span>
          </div>
        </div>
        <div class="roadmap-container-box">
          <RoadmapGraph
            :tree="courseTree"
            :course-id="course?.dbId || course?.id || courseId"
            @select-chapter="scrollToChapter"
          />
        </div>
      </section>

      <!-- 讲义大纲目录 -->
      <section id="curriculum-toc" class="curriculum-section">
        <div class="curriculum-header">
          <div class="section-title-wrap">
            <span class="section-kicker font-mono">SYLLABUS & LECTURES</span>
            <h2 class="section-heading">讲义大纲与章节目录</h2>
          </div>
          <div class="curriculum-actions font-mono">
            <span class="curriculum-stats">
              {{ chapters.length }} 编 · {{ totalSectionsCount }} 讲
            </span>
            <div class="toggle-group">
              <button class="toggle-btn" @click="expandAll">全部展开</button>
              <span class="toggle-sep">/</span>
              <button class="toggle-btn" @click="collapseAll">全部折叠</button>
            </div>
          </div>
        </div>

        <!-- 目录列表 -->
        <div v-if="chapters.length > 0" class="chapters-wrapper">
          <div
            v-for="(chap, idx) in chapters"
            :key="chap.id"
            :id="`chapter-${chap.id}`"
            class="chapter-panel"
            :class="{ 'is-collapsed': !openChapters.has(chap.id) }"
          >
            <!-- 章节标题栏 -->
            <button
              class="chapter-header-btn"
              @click="toggleChapter(chap.id)"
            >
              <div class="chapter-meta">
                <MTag variant="cyan" size="sm">
                  {{ chap.tag || `第${idx + 1}章` }}
                </MTag>
                <span class="chapter-title">{{ chap.title }}</span>
                <MTag
                  v-if="chap.prereqText"
                  :variant="chap.isOrigin ? 'green' : 'muted'"
                  size="sm"
                  :dot="chap.isOrigin"
                >
                  {{ chap.prereqText }}
                </MTag>
              </div>

              <div class="chapter-aside">
                <span class="section-count font-mono">{{ chap.sections?.length || 0 }} 讲</span>
                <span class="arrow-icon" :class="{ 'is-rotated': openChapters.has(chap.id) }">
                  <NavArrowRight width="14" height="14" />
                </span>
              </div>
            </button>

            <!-- 小节列表 -->
            <MCollapse :open="openChapters.has(chap.id)">
              <div class="sections-container">
                <div
                  v-for="sec in chap.sections"
                  :key="sec.id"
                  class="section-entry"
                  @click="openLecture(sec.id)"
                >
                  <div class="entry-left">
                    <span class="entry-id font-mono">{{ sec.id }}</span>
                    <div class="entry-text">
                      <span class="entry-title" :title="sec.desc || sec.title">{{ sec.title }}</span>
                    </div>
                  </div>

                  <div class="entry-action font-mono">
                    <span class="read-link">进入讲义 →</span>
                  </div>
                </div>
              </div>
            </MCollapse>
          </div>
        </div>

        <!-- 空目录占位 -->
        <div v-else class="empty-curriculum font-mono">
          STATUS: COMING SOON // 该课程大纲筹备与内容撰写中
        </div>
      </section>
    </template>

    <!-- 未找到课程 -->
    <div v-else class="course-not-found font-mono">
      404 // 未找到课程信息: {{ courseId }}
    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: 32px 36px 64px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 1080px;
  margin: 0 auto;
  width: 100%;
}

.course-loading,
.course-not-found {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  padding: 40px 0;
}

/* 课程头部 */
.course-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 24px;
}

.header-tags {
  display: flex;
  align-items: center;
  gap: 8px;
}

.course-title {
  font-size: var(--font-size-largest);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  line-height: 1.3;
}

.course-desc {
  font-size: var(--font-size);
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 840px;
}

.course-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
  flex-wrap: wrap;
}

/* 概览卡片区 */
.course-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}

.spec-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.spec-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spec-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.spec-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.spec-label {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.spec-value {
  font-size: var(--font-size-smaller);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.guide-text {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  line-height: 1.6;
}

.guide-note {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  background-color: var(--bg-elevated);
  padding: 10px 12px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
}

/* 知识图谱区域 */
.roadmap-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.roadmap-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.roadmap-meta {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
}

.roadmap-container-box {
  width: 100%;
  height: 520px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
  isolation: isolate;
  z-index: 1;
  background-color: var(--bg-surface);
  position: relative;
  box-sizing: border-box;
}

/* 课程目录区域 */
.curriculum-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
  scroll-margin-top: 24px;
}

.curriculum-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.section-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-kicker {
  font-size: var(--font-size-smallest);
  color: var(--accent-primary);
  letter-spacing: 0.5px;
}

.section-heading {
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.curriculum-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
}

.toggle-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toggle-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
  cursor: pointer;
  padding: 0;
  transition: color 120ms ease;
}

.toggle-btn:hover {
  color: var(--text-primary);
}

.toggle-sep {
  color: var(--text-muted);
  opacity: 0.5;
}

/* 章节列表 */
.chapters-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chapter-panel {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
  transition: border-color 120ms ease;
}

.chapter-panel:hover {
  border-color: var(--border-hover);
}

.chapter-header-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background-color 120ms ease;
}

.chapter-header-btn:hover {
  background-color: var(--bg-hover);
}

.chapter-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chapter-title {
  font-size: var(--font-size);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.chapter-aside {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}

.arrow-icon {
  display: flex;
  align-items: center;
  transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
}

.arrow-icon.is-rotated {
  transform: rotate(90deg);
}

/* 小节列表 */
.sections-container {
  border-top: 1px solid var(--border-subtle);
  background-color: var(--bg-app);
  display: flex;
  flex-direction: column;
}

.section-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-subtle);
  transition: background-color 120ms ease;
}

.section-entry:last-child {
  border-bottom: none;
}

.section-entry:hover {
  background-color: var(--bg-hover);
}

.entry-left {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.entry-id {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  width: 44px;
  flex-shrink: 0;
}

.entry-text {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.entry-title {
  font-size: var(--font-size-smaller);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  transition: color 120ms ease;
}

.section-entry:hover .entry-title {
  color: var(--accent-primary);
}

.entry-action {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 120ms ease, transform 120ms ease, color 120ms ease;
  flex-shrink: 0;
}

.section-entry:hover .entry-action {
  opacity: 1;
  transform: translateX(0);
  color: var(--accent-primary);
}

.empty-curriculum {
  padding: 32px;
  background-color: var(--bg-surface);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  text-align: center;
}
</style>
