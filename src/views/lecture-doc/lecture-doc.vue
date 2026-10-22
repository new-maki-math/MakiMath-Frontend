<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChapterNav from './ChapterNav.vue';
import OutlineNav from './OutlineNav.vue';
import DocFooterNav from './DocFooterNav.vue';
import { getChaptersForCourse, getNodeContent } from './data';
import { List } from '@iconoir/vue';
import MSelectionToolbar from '../../components/MSelectionToolbar.vue';

const route = useRoute();
const router = useRouter();

const readingViewportRef = ref(null);
const isChapterDrawerOpen = ref(false);
const activeOutlineId = ref('');

// 抽屉状态控制
const openDrawer = () => {
  isChapterDrawerOpen.value = true;
};

const closeDrawer = () => {
  isChapterDrawerOpen.value = false;
};

const toggleDrawer = () => {
  isChapterDrawerOpen.value = !isChapterDrawerOpen.value;
};

// 选择模式状态
const isSelectionMode = ref(false);

const isInputFocused = () => {
  const activeEl = document.activeElement;
  if (!activeEl) return false;
  const tag = activeEl.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || activeEl.isContentEditable;
};

// 键盘快捷键监听
const handleKeyDown = (e) => {
  // 输入框聚焦时跳过快捷键
  if (isInputFocused()) return;

  // 切换选择模式
  if (e.code === 'Backquote' || e.key === '`' || e.key === '~') {
    e.preventDefault();
    isSelectionMode.value = !isSelectionMode.value;
    if (!isSelectionMode.value) {
      window.getSelection()?.removeAllRanges();
    }
    return;
  }

  // 退出选择模式或关闭抽屉
  if (e.key === 'Escape') {
    if (isSelectionMode.value) {
      window.getSelection()?.removeAllRanges();
      isSelectionMode.value = false;
    } else if (isChapterDrawerOpen.value) {
      closeDrawer();
    }
    return;
  }

  // 切换抽屉显隐
  if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
    e.preventDefault();
    toggleDrawer();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// 当前路由参数
const currentCourseId = computed(() => {
  return route.params.courseId || 'kaoyan';
});

const currentSectionId = computed(() => {
  return route.params.sectionId ? String(route.params.sectionId).trim() : '';
});

// 讲义正文与目录数据
const courseChapters = ref([]);
const currentContent = ref({
  id: '',
  title: '讲义加载中...',
  lead: '',
  outlines: [],
  doc: null
});
const isLoading = ref(true);

// 监听路由参数加载讲义
watch(
  [currentCourseId, currentSectionId],
  async ([courseId, sectionId]) => {
    isSelectionMode.value = false;
    isLoading.value = true;
    try {
      // 加载章节目录树
      const chaps = await getChaptersForCourse(courseId);
      courseChapters.value = chaps;

      // 加载讲义正文与大纲
      const secId = sectionId || (chaps[0]?.sections?.[0]?.id ? String(chaps[0].sections[0].id) : '');
      if (!secId) {
        // 无有效小节时设为空状态
        currentContent.value = { id: '', title: '暂无讲义', lead: '', outlines: [], doc: null };
        return;
      }
      currentContent.value = await getNodeContent(courseId, secId);

      // 切换时重置滚动位置
      if (readingViewportRef.value) {
        readingViewportRef.value.scrollTop = 0;
      }
    } catch (err) {
      console.error('[DocView] 加载讲义数据失败:', err);
    } finally {
      isLoading.value = false;
    }
  },
  { immediate: true }
);

// 当前小节与所属章节
const currentSection = computed(() => {
  const targetId = currentSectionId.value;
  for (const chap of courseChapters.value) {
    const sec = chap.sections?.find(s => String(s.id) === targetId || (s.slug && String(s.slug) === targetId));
    if (sec) {
      return {
        ...sec,
        chapterId: String(chap.id),
        chapterTag: chap.tag,
        chapterTitle: chap.title
      };
    }
  }
  const firstChap = courseChapters.value[0];
  const firstSec = firstChap?.sections?.[0];
  return {
    id: firstSec ? String(firstSec.id) : targetId,
    title: currentContent.value?.title || firstSec?.title || '讲义阅读',
    chapterId: firstChap ? String(firstChap.id) : '',
    chapterTag: firstChap?.tag || '',
    chapterTitle: firstChap?.title || ''
  };
});

// 右侧大纲列表
const pageOutlines = computed(() => {
  return currentContent.value?.outlines || [];
});

// 全局扁平讲义小节列表
const allSections = computed(() => {
  const list = [];
  for (const chap of courseChapters.value) {
    if (Array.isArray(chap.sections)) {
      for (const sec of chap.sections) {
        list.push({
          ...sec,
          chapterId: String(chap.id),
          chapterTag: chap.tag,
          chapterTitle: chap.title
        });
      }
    }
  }
  return list;
});

// 当前小节在全局大纲中的索引
const currentSectionIndex = computed(() => {
  const curId = String(currentSection.value.id);
  return allSections.value.findIndex(s => String(s.id) === curId || (s.slug && String(s.slug) === curId));
});

// 上一小节
const prevSection = computed(() => {
  const idx = currentSectionIndex.value;
  return idx > 0 ? allSections.value[idx - 1] : null;
});

// 下一小节
const nextSection = computed(() => {
  const idx = currentSectionIndex.value;
  return (idx >= 0 && idx < allSections.value.length - 1)
    ? allSections.value[idx + 1]
    : null;
});

// 切换章节
const handleSelectSection = (section) => {
  closeDrawer();
  const targetId = String(section.id);
  if (targetId === currentSectionId.value) return;
  router.push({
    name: 'lecture-doc',
    params: {
      courseId: route.params.courseId || 'kaoyan',
      sectionId: targetId
    }
  });
};

// 滚动至大纲锚点
const scrollToOutline = (id) => {
  activeOutlineId.value = id;
  const targetEl = document.getElementById(id);
  if (targetEl && readingViewportRef.value) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
</script>

<template>
  <div class="lecture-doc-view" :class="{ 'is-selection-mode': isSelectionMode }">
    <!-- 目录呼出按钮 -->
    <button
      v-if="!isChapterDrawerOpen"
      class="drawer-open-btn"
      title="查看章节目录 (Cmd/Ctrl + B)"
      @click="openDrawer"
    >
      <List width="14" height="14" />
      <span>目录</span>
    </button>

    <!-- 遮罩组件 -->
    <MBackdrop
      :open="isChapterDrawerOpen"
      @close="closeDrawer"
    />

    <!-- 左侧浮动抽屉 -->
    <MCollapse
      horizontal
      drawer
      :open="isChapterDrawerOpen"
      class="chapter-drawer-wrap"
      aria-label="课程章节目录导航"
    >
      <ChapterNav
        :chapters="courseChapters"
        :current-section-id="currentSection.id"
        @toggle-collapse="closeDrawer"
        @select-section="handleSelectSection"
      />
    </MCollapse>

    <!-- 讲义正文阅读视口 -->
    <main ref="readingViewportRef" class="reading-viewport">
      <!-- 讲义核心正文容器 -->
      <div class="reading-content-wrap">
        <article class="markdown-article">
          <!-- 讲义大标题 -->
          <header class="doc-header">
            <div class="doc-kicker font-mono">
              {{ currentSection.chapterTag }} · {{ currentSection.chapterTitle }}
            </div>
            <h1 class="doc-main-title">{{ currentSection.title }}</h1>
            <p v-if="currentContent.lead || currentSection.desc" class="doc-lead">
              {{ currentContent.lead || currentSection.desc }}
            </p>
          </header>

          <!-- 讲义正文 -->
          <TypstDoc
            v-if="currentContent.doc"
            :doc="currentContent.doc"
          />
        </article>

        <!-- 底部翻页导航栏 -->
        <DocFooterNav
          :prev-section="prevSection"
          :next-section="nextSection"
          @select-section="handleSelectSection"
        />
      </div>
    </main>

    <!-- 右侧大纲导航组件 -->
    <OutlineNav
      :outlines="pageOutlines"
      :active-id="activeOutlineId"
      :scroll-container="readingViewportRef"
      @select-outline="scrollToOutline"
      @active-change="id => activeOutlineId = id"
    />

    <!-- 选择模式提示浮层 -->
    <Transition name="fade-fast">
      <div v-if="isSelectionMode" class="selection-mode-pill" role="status">
        <MTag variant="lime" size="md">`</MTag>
        <span class="selection-mode-text">选择模式已开启 · 左键可自由划选正文与公式</span>
        <span class="selection-mode-hint">(按 ` 或 Esc 退出)</span>
      </div>
    </Transition>

    <!-- 文本划选标记工具栏 -->
    <MSelectionToolbar
      container=".markdown-article"
      :disabled="!isSelectionMode"
    />
  </div>
</template>

<style scoped>
.lecture-doc-view {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: var(--bg-app);
  overflow: hidden;
  position: relative;
}

/* 侧滑抽屉样式 */
.chapter-drawer-wrap {
  width: 280px;
  max-width: 85vw;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.45);
}

/* 展开目录按钮 */
.drawer-open-btn {
  position: absolute;
  top: 18px;
  left: 20px;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease, transform 140ms ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: geometricPrecision;
}

.drawer-open-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.drawer-open-btn:active {
  transform: scale(0.97);
}

/* 阅读视口容器 */
.reading-viewport {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
}

/* 正文内容容器 */
.reading-content-wrap {
  flex: 1;
  padding: 48px 220px 96px 56px;
  max-width: 1040px;
  margin: 0 auto;
  width: 100%;
}

.markdown-article {
  display: flex;
  flex-direction: column;
  gap: 36px;
  color: var(--text-primary);
  line-height: 1.7;
}

/* 讲义标题栏 */
.doc-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 24px;
}

.doc-kicker {
  font-size: var(--font-size-smallest);
  color: var(--accent-primary);
  letter-spacing: 0.5px;
}

.doc-main-title {
  font-size: var(--font-size-largest);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  line-height: 1.3;
}

.doc-lead {
  font-size: var(--font-size);
  color: var(--text-secondary);
  line-height: 1.6;
}

/* 选择模式文本放行 */
.lecture-doc-view.is-selection-mode .markdown-article,
.lecture-doc-view.is-selection-mode .markdown-article *,
.lecture-doc-view.is-selection-mode :deep(.typst-doc),
.lecture-doc-view.is-selection-mode :deep(.typst-doc *) {
  user-select: text !important;
  -webkit-user-select: text !important;
}

/* 翻页控件禁止划选 */
.lecture-doc-view :deep(.doc-footer-nav),
.lecture-doc-view :deep(.doc-footer-nav *),
.lecture-doc-view .drawer-open-btn,
.lecture-doc-view .selection-mode-pill {
  user-select: none !important;
  -webkit-user-select: none !important;
}

.lecture-doc-view.is-selection-mode .markdown-article,
.lecture-doc-view.is-selection-mode :deep(.typst-doc) {
  cursor: text;
}

/* 选择模式提示胶囊 */
.selection-mode-pill {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  color: var(--text-primary);
  font-size: var(--font-size);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.2px;
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

.selection-mode-text {
  color: var(--text-primary);
  line-height: 1;
}

.selection-mode-hint {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  line-height: 1;
}

/* 淡入淡出动画 */
.fade-fast-enter-active,
.fade-fast-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
</style>
