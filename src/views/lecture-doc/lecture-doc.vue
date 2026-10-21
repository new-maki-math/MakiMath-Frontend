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

// 侧滑抽屉控制
const openDrawer = () => {
  isChapterDrawerOpen.value = true;
};

const closeDrawer = () => {
  isChapterDrawerOpen.value = false;
};

const toggleDrawer = () => {
  isChapterDrawerOpen.value = !isChapterDrawerOpen.value;
};

// 模式开关：按键 ` 切换选择模式（方案 B 开关模式）
const isSelectionMode = ref(false);

const isInputFocused = () => {
  const activeEl = document.activeElement;
  if (!activeEl) return false;
  const tag = activeEl.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || activeEl.isContentEditable;
};

// 键盘快捷键支持：按 ` 切换选择模式，按 Escape 退出选择模式或关闭抽屉，Ctrl/Cmd + B 切换抽屉
const handleKeyDown = (e) => {
  // 1. 如果当前焦点在输入框/搜索框内，不拦截输入
  if (isInputFocused()) return;

  // 2. 按键 ` (Backquote / ~) 切换选择模式开关
  if (e.code === 'Backquote' || e.key === '`' || e.key === '~') {
    e.preventDefault();
    isSelectionMode.value = !isSelectionMode.value;
    if (!isSelectionMode.value) {
      window.getSelection()?.removeAllRanges();
    }
    return;
  }

  // 3. 按 Escape 键：优先退出选择模式，其次收起目录抽屉
  if (e.key === 'Escape') {
    if (isSelectionMode.value) {
      window.getSelection()?.removeAllRanges();
      isSelectionMode.value = false;
    } else if (isChapterDrawerOpen.value) {
      closeDrawer();
    }
    return;
  }

  // 4. Ctrl/Cmd + B 切换抽屉
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

// 当前课程与小节 ID
const currentCourseId = computed(() => {
  return route.params.courseId || 'kaoyan';
});

const currentSectionId = computed(() => {
  // URL 可以不带 sectionId（/course/:id/doc 是合法路由）。这里留空，
  // 让下面的加载逻辑退到第一节；填一个旧版假 id 会去请求不存在的讲义。
  return route.params.sectionId || '';
});

// 从服务器异步拉取的章节目录树与节点正文
const courseChapters = ref([]);
const currentContent = ref({
  id: '',
  title: '讲义加载中...',
  lead: '',
  outlines: [],
  doc: null
});
const isLoading = ref(true);

// 监听路由参数变化，动态从服务器获取对应课程及小节数据
watch(
  [currentCourseId, currentSectionId],
  async ([courseId, sectionId]) => {
    isSelectionMode.value = false;
    isLoading.value = true;
    try {
      // 1. 获取完整章节目录树
      const chaps = await getChaptersForCourse(courseId);
      courseChapters.value = chaps;

      // 2. 获取该讲次/小节的真实正文与大纲模型；URL 没带 sectionId 就退到第一节
      const secId = sectionId || chaps[0]?.sections?.[0]?.id;
      if (!secId) {
        // 课程还没建小节，别去请求一个不存在的 id
        currentContent.value = { id: '', title: '暂无讲义', lead: '', outlines: [], doc: null };
        return;
      }
      currentContent.value = await getNodeContent(courseId, secId);

      // 切换讲义时平滑重置滚动位置
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

// 计算当前小节对象及所属大编
const currentSection = computed(() => {
  for (const chap of courseChapters.value) {
    const sec = chap.sections?.find(s => s.id === currentSectionId.value);
    if (sec) {
      return {
        ...sec,
        chapterId: chap.id,
        chapterTag: chap.tag,
        chapterTitle: chap.title
      };
    }
  }
  const firstChap = courseChapters.value[0];
  const firstSec = firstChap?.sections?.[0];
  return {
    id: firstSec?.id || currentSectionId.value,
    title: currentContent.value?.title || firstSec?.title || '讲义阅读',
    chapterId: firstChap?.id || '',
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
          chapterId: chap.id,
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
  return allSections.value.findIndex(s => s.id === currentSection.value.id);
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
  closeDrawer(); // 点击选择小节后自动平滑收起抽屉
  if (section.id === currentSectionId.value) return;
  router.push({
    name: 'lecture-doc',
    params: {
      courseId: route.params.courseId || 'kaoyan',
      sectionId: section.id
    }
  });
};

// 点击大纲平滑滚动至对应锚点
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
    <!-- 1. 悬浮在内容区左上角的目录呼出按钮 (常驻，抽屉开启时隐藏) -->
    <button
      v-if="!isChapterDrawerOpen"
      class="drawer-open-btn"
      title="查看章节目录 (Cmd/Ctrl + B)"
      @click="openDrawer"
    >
      <List width="14" height="14" />
      <span>目录</span>
    </button>

    <!-- 2. 全局半透明微暗遮罩组件 (点击外部关闭抽屉) -->
    <MBackdrop
      :open="isChapterDrawerOpen"
      @close="closeDrawer"
    />

    <!-- 3. 左侧浮动侧滑抽屉 (使用升级后的全局 MCollapse 抽屉模式，GPU 硬件加速) -->
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

    <!-- 4. 中间 Markdown 讲义正文主阅读视口 (全宽恒定，绝不发生逐帧挤压) -->
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

          <!-- 讲义正文：后端把 Typst 源文解析成结构化文档树，这里递归渲染 -->
          <TypstDoc
            v-if="currentContent.doc"
            :doc="currentContent.doc"
          />
        </article>

        <!-- 讲义底部上一讲 / 下一讲翻页导航栏 -->
        <DocFooterNav
          :prev-section="prevSection"
          :next-section="nextSection"
          @select-section="handleSelectSection"
        />
      </div>
    </main>

    <!-- 5. 右侧页面大纲导航组件 (无背景悬浮，左侧细竖线 + 连续滑动指示色条) -->
    <OutlineNav
      :outlines="pageOutlines"
      :active-id="activeOutlineId"
      :scroll-container="readingViewportRef"
      @select-outline="scrollToOutline"
      @active-change="id => activeOutlineId = id"
    />

    <!-- 6. 按键 ` 切换选择模式的提示浮层 (方案 B 开关模式，使用全局 MTag 黄绿正常状态色) -->
    <Transition name="fade-fast">
      <div v-if="isSelectionMode" class="selection-mode-pill" role="status">
        <MTag variant="lime" size="md">`</MTag>
        <span class="selection-mode-text">选择模式已开启 · 左键可自由划选正文与公式</span>
        <span class="selection-mode-hint">(按 ` 或 Esc 退出)</span>
      </div>
    </Transition>

    <!-- 7. 文本划选浮动标记工具栏 (仅限正文文章区域，下划线 / 背景高亮 / 预设阅读色盘) -->
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

/* 浮动侧滑抽屉外观定制 (动画与 GPU 加速由全局 MCollapse drawer 驱动) */
.chapter-drawer-wrap {
  width: 280px;
  max-width: 85vw;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.45);
}

/* 悬浮在内容区域左上角的展开目录按钮 */
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease, transform 140ms ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: geometricPrecision;
}

.drawer-open-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.15);
}

.drawer-open-btn:active {
  transform: scale(0.97);
}

/* 中间阅读流视口 (全宽恒定，0 挤压) */
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

/* 核心正文容器 (右侧留出 220px 空间给悬浮的竖向时间条) */
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

/* 讲义大标头 */
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

/* 开启选择模式：仅讲义正文文章区域（标题、段落、公式）放行文本划选 */
.lecture-doc-view.is-selection-mode .markdown-article,
.lecture-doc-view.is-selection-mode .markdown-article *,
.lecture-doc-view.is-selection-mode :deep(.typst-doc),
.lecture-doc-view.is-selection-mode :deep(.typst-doc *) {
  user-select: text !important;
  -webkit-user-select: text !important;
}

/* 底部上一讲/下一讲翻页控件与侧边悬浮 UI 永远禁止被选区捕捉，保障纯粹沉浸的点击翻页 */
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

/* 底部选择模式提示胶囊 (尺寸适中清晰，与全局 MTag 配合) */
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

/* 快速淡入淡出动画 (120ms，纯粹干脆) */
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
