<script setup>
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChapterNav from './ChapterNav.vue';
import OutlineNav from './OutlineNav.vue';
import DocFooterNav from './DocFooterNav.vue';
import { fetchCourseTree, toChapters, getCourseSectionContent } from '../../api';
import { List, MenuScale, EditPencil, ArrowUp, NavArrowLeft, NavArrowRight, Bookmark, BookmarkSolid } from '@iconoir/vue';
import MSelectionToolbar from '../../components/MSelectionToolbar.vue';
import LectureViewerEmbed from '../../components/LectureViewerEmbed.vue';
import {
  getNotebookItems,
  addOrUpgradeNotebookItem,
  removeNotebookItem,
  DEFAULT_NOTEBOOK_ID
} from '../../utils/my-lecture-db.js';
import { getSubordinateCardIds } from '../../utils/my-lecture-slice.js';
import { notify } from '../../components/MNotice.vue';

const route = useRoute();
const router = useRouter();

const readingViewportRef = ref(null);
const isChapterDrawerOpen = ref(false);
const isOutlineDrawerOpen = ref(false);
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

const toggleSelectionMode = () => {
  if (currentContent.value?.doc?.children?.some((node) => node.type === 'typst-source')) {
    notify.warn('当前讲义暂不支持正文划选');
    return;
  }
  isSelectionMode.value = !isSelectionMode.value;
  if (!isSelectionMode.value) {
    window.getSelection()?.removeAllRanges();
  }
};

const scrollToTop = () => {
  if (readingViewportRef.value) {
    readingViewportRef.value.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const handleSelectMobileOutline = (id) => {
  isOutlineDrawerOpen.value = false;
  scrollToOutline(id);
};

// 移动端右下角快捷胶囊横向展开与滚动避让
const cornerFabRef = ref(null);
const isCornerExpanded = ref(false);
const isCornerHiddenByScroll = ref(false);

const handleCornerAction = (action) => {
  if (typeof action === 'function') action();
  isCornerExpanded.value = false;
};

// 点击外部空白区域自动收起胶囊
const handleGlobalPointer = (e) => {
  if (isCornerExpanded.value && cornerFabRef.value) {
    if (!cornerFabRef.value.contains(e.target)) {
      isCornerExpanded.value = false;
    }
  }
};

let lastScrollTop = 0;
let scrollTicking = false;

const handleViewportScroll = () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    if (!readingViewportRef.value) {
      scrollTicking = false;
      return;
    }
    const st = readingViewportRef.value.scrollTop;
    const maxScroll = readingViewportRef.value.scrollHeight - readingViewportRef.value.clientHeight;

    // 贴顶或贴底时必须展示
    if (st <= 40 || st >= maxScroll - 40) {
      isCornerHiddenByScroll.value = false;
    } else if (st > lastScrollTop + 16 && st > 80) {
      // 下滑阅读时：自动收起并下沉避让，保证正文纯净视野
      isCornerExpanded.value = false;
      isCornerHiddenByScroll.value = true;
    } else if (st < lastScrollTop - 12) {
      // 上滑回翻时：重新浮现右下角胶囊
      isCornerHiddenByScroll.value = false;
    }
    lastScrollTop = st;
    scrollTicking = false;
  });
};

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
    toggleSelectionMode();
    return;
  }

  // 退出选择模式或关闭抽屉
  if (e.key === 'Escape') {
    if (isSelectionMode.value) {
      window.getSelection()?.removeAllRanges();
      isSelectionMode.value = false;
    } else if (isCornerExpanded.value) {
      isCornerExpanded.value = false;
    } else if (isChapterDrawerOpen.value) {
      closeDrawer();
    } else if (isOutlineDrawerOpen.value) {
      isOutlineDrawerOpen.value = false;
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
  document.addEventListener('pointerdown', handleGlobalPointer);
  if (readingViewportRef.value) {
    readingViewportRef.value.addEventListener('scroll', handleViewportScroll, { passive: true });
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('pointerdown', handleGlobalPointer);
  if (readingViewportRef.value) {
    readingViewportRef.value.removeEventListener('scroll', handleViewportScroll);
  }
});

// 当前路由参数
const currentCourseId = computed(() => {
  return route.params.courseId;
});

const currentSectionId = computed(() => {
  return route.params.sectionId ? String(route.params.sectionId).trim() : '';
});

// 讲义正文与目录数据
const courseChapters = ref([]);
const courseTitle = ref('');
const contentIdentity = ref(null);
const currentContent = ref({
  id: '',
  title: '讲义加载中...',
  lead: '',
  updatedAt: null,
  outlines: [],
  doc: null,
  animation: null
});
const isLoading = ref(true);
const loadError = ref('');
const reloadKey = ref(0);
let loadId = 0;
onUnmounted(() => { loadId++; });

// 监听路由参数加载讲义
watch(
  [currentCourseId, currentSectionId, reloadKey],
  async ([courseId, sectionId]) => {
    const id = ++loadId;
    isSelectionMode.value = false;
    isLoading.value = true;
    loadError.value = '';
    contentIdentity.value = null;
    currentContent.value = { id: '', title: '', lead: '', outlines: [], doc: null, animation: null };
    courseChapters.value = [];
    courseTitle.value = '';
    try {
      // 通过统一课程目录树接口加载数据
      // 内部通过解析器将别名解析为对应数字编号
      const tree = await fetchCourseTree(courseId);
      if (id !== loadId) return;
      if (tree.id == null) throw new Error('课程标识缺失');
      courseTitle.value = tree.title || '';
      const chaps = toChapters(tree);
      courseChapters.value = chaps;

      // 加载讲义正文与大纲
      const sections = chaps.flatMap((chapter) => chapter.sections || []);
      const section = sectionId
        ? sections.find((item) => String(item.id) === sectionId || item.slug === sectionId)
        : sections[0];
      if (sectionId && !section) {
        const error = new Error('讲义不存在');
        error.status = 404;
        throw error;
      }
      const secId = section?.id || '';
      if (!secId) {
        // 无有效小节时设为空状态
        currentContent.value = { id: '', title: '暂无讲义', lead: '', outlines: [], doc: null, animation: null };
        return;
      }
      // 使用数字标识以保证缓存与预设映射命中
      const content = await getCourseSectionContent(tree.id, secId);
      if (id !== loadId) return;
      currentContent.value = content;
      contentIdentity.value = { courseId: String(tree.id), sectionId: String(secId) };

      // 切换时重置滚动位置
      if (readingViewportRef.value) {
        readingViewportRef.value.scrollTop = 0;
      }
    } catch (err) {
      if (id === loadId) loadError.value = err.status === 404 ? '讲义不存在' : '讲义加载失败，请重试';
    } finally {
      if (id === loadId) isLoading.value = false;
    }
  },
  { immediate: true }
);

// 当前小节与所属章节
const currentSection = computed(() => {
  const targetId = String(currentContent.value.id || currentSectionId.value);
  for (const chap of courseChapters.value) {
    const sec = chap.sections?.find(s => String(s.id) === targetId || (s.slug && String(s.slug) === targetId));
    if (sec) {
      return {
        ...sec,
        chapterId: String(chap.id),
        chapterTag: chap.tag,
        chapterTitle: chap.title,
        updatedAt: sec.updatedAt
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
    chapterTitle: firstChap?.title || '',
    updatedAt: currentContent.value?.updatedAt || firstSec?.updatedAt || null
  };
});

// 格式化上次修改时间
const lastModifiedText = computed(() => {
  const iso = currentContent.value?.updatedAt || currentSection.value?.updatedAt;
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = p(d.getMonth() + 1);
  const day = p(d.getDate());
  const h = p(d.getHours());
  const min = p(d.getMinutes());
  return `${y}-${m}-${day} ${h}:${min}`;
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
      courseId: currentCourseId.value || '',
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

// ============================================================
// 我的讲义：多粒度收藏与从属合并上下文
// ============================================================
const currentNotebookItems = ref([]);

const reloadNotebookItems = async () => {
  try {
    currentNotebookItems.value = await getNotebookItems(DEFAULT_NOTEBOOK_ID);
  } catch (err) {
    console.error('[DocView] 读取我的讲义失败:', err);
  }
};

onMounted(() => {
  reloadNotebookItems();
});

watch(() => currentSectionId.value, () => {
  reloadNotebookItems();
});

// 是否整节已收录
const isSectionCollected = computed(() => {
  const cId = contentIdentity.value?.courseId;
  const sId = contentIdentity.value?.sectionId;
  if (!cId || !sId) return false;
  return currentNotebookItems.value.some(
    (it) => it.courseId === cId && it.sectionId === sId && it.scope === 'section'
  );
});

// 检查某个大纲考点是否已精确收录
const isOutlineCollected = (outlineId) => {
  const cId = contentIdentity.value?.courseId;
  const sId = contentIdentity.value?.sectionId;
  if (!cId || !sId) return false;
  return currentNotebookItems.value.some(
    (it) => it.courseId === cId && it.sectionId === sId && it.scope === 'outline' && it.scopeId === outlineId
  );
};

// 检查某个大纲考点是否已被整小节吸收
const isOutlineAbsorbed = (outlineId) => {
  return isSectionCollected.value;
};

// 检查某个卡片是否已精确收录
const isCardCollected = (cardId) => {
  const cId = contentIdentity.value?.courseId;
  const sId = contentIdentity.value?.sectionId;
  if (!cId || !sId) return false;
  return currentNotebookItems.value.some(
    (it) => it.courseId === cId && it.sectionId === sId && it.scope === 'card' && it.scopeId === cardId
  );
};

// 检查某个卡片是否已被父大纲考点或整节吸收
const isCardAbsorbed = (cardId) => {
  if (isSectionCollected.value) return true;
  const cId = contentIdentity.value?.courseId;
  const sId = contentIdentity.value?.sectionId;
  if (!cId || !sId) return false;
  const doc = currentContent.value?.doc;

  const collectedOutlineIds = currentNotebookItems.value
    .filter((it) => it.courseId === cId && it.sectionId === sId && it.scope === 'outline')
    .map((it) => it.scopeId);

  if (collectedOutlineIds.length === 0) return false;

  for (const outlineId of collectedOutlineIds) {
    const subCards = getSubordinateCardIds(doc, outlineId);
    if (subCards.includes(cardId)) {
      return true;
    }
  }
  return false;
};

// 收藏 / 移出整小节 (一键收录并自动吸收该小节下的全部碎片)
const handleToggleSectionCollect = async () => {
  const cId = contentIdentity.value?.courseId;
  const sId = contentIdentity.value?.sectionId;
  if (!cId || !sId) return;
  const existing = currentNotebookItems.value.find(
    (it) => it.courseId === cId && it.sectionId === sId && it.scope === 'section'
  );

  if (existing) {
    await removeNotebookItem(existing.id);
    notify.info(`已将小节《${currentSection.value.title}》移出讲义`);
    await reloadNotebookItems();
    return;
  }

  const res = await addOrUpgradeNotebookItem({
    courseId: cId,
    courseTitle: courseTitle.value,
    sectionId: sId,
    sectionTitle: currentSection.value.title,
    scope: 'section',
    scopeId: 'all',
    title: currentSection.value.title,
    badge: '整节',
    breadcrumb: [currentSection.value.chapterTitle, currentSection.value.title].filter(Boolean)
  });

  if (res.success) {
    notify.success(res.message);
    await reloadNotebookItems();
  } else {
    notify.info(res.message);
  }
};

// 收藏 / 移出大纲考点节 (自动合并下属真题卡片)
const handleCollectOutline = async (outlineItem) => {
  const cId = contentIdentity.value?.courseId;
  const sId = contentIdentity.value?.sectionId;
  if (!cId || !sId) return;
  const existing = currentNotebookItems.value.find(
    (it) => it.courseId === cId && it.sectionId === sId && it.scope === 'outline' && it.scopeId === outlineItem.id
  );

  if (existing) {
    await removeNotebookItem(existing.id);
    notify.info(`已将考点《${outlineItem.title}》移出讲义`);
    await reloadNotebookItems();
    return;
  }

  const subCardIds = getSubordinateCardIds(currentContent.value?.doc, outlineItem.id);

  const res = await addOrUpgradeNotebookItem({
    courseId: cId,
    courseTitle: courseTitle.value,
    sectionId: sId,
    sectionTitle: currentSection.value.title,
    scope: 'outline',
    scopeId: outlineItem.id,
    title: outlineItem.title,
    badge: '考点',
    outlineAnchor: outlineItem.id,
    subordinateCardIds: subCardIds,
    breadcrumb: [currentSection.value.chapterTitle, currentSection.value.title, outlineItem.title].filter(Boolean)
  });

  if (res.success) {
    notify.success(res.message);
    await reloadNotebookItems();
  } else {
    notify.info(res.message);
  }
};

// 收藏 / 移出独立卡片 (真题 / 知识盒)
const handleCollectCard = async (cardNode) => {
  const cId = contentIdentity.value?.courseId;
  const sId = contentIdentity.value?.sectionId;
  if (!cId || !sId) return;
  const existing = currentNotebookItems.value.find(
    (it) => it.courseId === cId && it.sectionId === sId && it.scope === 'card' && it.scopeId === cardNode.cardId
  );

  if (existing) {
    await removeNotebookItem(existing.id);
    notify.info(`已将《${cardNode.cardTitle || '卡片'}》移出讲义`);
    await reloadNotebookItems();
    return;
  }

  const res = await addOrUpgradeNotebookItem({
    courseId: cId,
    courseTitle: courseTitle.value,
    sectionId: sId,
    sectionTitle: currentSection.value.title,
    scope: 'card',
    scopeId: cardNode.cardId,
    title: cardNode.cardTitle || '知识卡片',
    badge: cardNode.cardBadge || '卡片',
    outlineAnchor: cardNode.outlineAnchor || '',
    breadcrumb: [currentSection.value.chapterTitle, currentSection.value.title, cardNode.cardTitle].filter(Boolean)
  });

  if (res.success) {
    notify.success(res.message);
    await reloadNotebookItems();
  } else {
    notify.info(res.message);
  }
};

// 提供给递归组件 TypstDoc 与侧边栏 OutlineNav
provide('lectureCollectContext', {
  isSectionCollected: () => isSectionCollected.value,
  isOutlineCollected,
  isOutlineAbsorbed,
  isCardCollected,
  isCardAbsorbed,
  onCollectCard: handleCollectCard,
  onCollectOutline: handleCollectOutline
});
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

    <!-- 左侧浮动章节目录抽屉 -->
    <MDrawer
      :open="isChapterDrawerOpen"
      placement="left"
      title="CHAPTERS // 目录"
      width="300px"
      @close="closeDrawer"
    >
      <ChapterNav
        :chapters="courseChapters"
        :current-section-id="currentSection.id"
        @select-section="handleSelectSection"
      />
    </MDrawer>

    <!-- 移动端大纲抽屉 (右侧弹出) -->
    <MDrawer
      :open="isOutlineDrawerOpen"
      placement="right"
      title="OUTLINE // 本讲大纲"
      width="280px"
      @close="isOutlineDrawerOpen = false"
    >
      <div class="mobile-outline-panel">
        <div v-if="pageOutlines.length === 0" class="mobile-outline-empty font-mono">
          本讲暂无大纲锚点
        </div>
        <div
          v-for="(item, idx) in pageOutlines"
          :key="item.id || idx"
          class="mobile-outline-row"
        >
          <button
            type="button"
            class="mobile-outline-item"
            :class="{ active: activeOutlineId === item.id }"
            @click="handleSelectMobileOutline(item.id)"
          >
            <span class="mobile-outline-dot" />
            <span class="mobile-outline-text" :title="item.title">{{ item.title }}</span>
          </button>
          <button
            type="button"
            class="mobile-outline-collect-btn font-mono"
            :class="{ 'is-collected': isOutlineCollected(item.id), 'is-absorbed': isOutlineAbsorbed(item.id) }"
            :title="isOutlineAbsorbed(item.id) ? '已随整小节收入讲义' : isOutlineCollected(item.id) ? '已收入我的讲义' : '收入此考点'"
            @click.stop="handleCollectOutline(item)"
          >
            <component :is="isOutlineCollected(item.id) ? BookmarkSolid : Bookmark" width="13" height="13" />
          </button>
        </div>
      </div>
    </MDrawer>

    <!-- 讲义正文阅读视口 -->
    <main ref="readingViewportRef" class="reading-viewport">
      <!-- 讲义核心正文容器 -->
      <div class="reading-content-wrap">
        <div v-if="isLoading" class="font-mono">正在加载讲义</div>
        <div v-else-if="loadError" class="font-mono">
          <p>{{ loadError }}</p>
          <MButton variant="secondary" @click="reloadKey++">重试</MButton>
        </div>
        <article v-else class="markdown-article">
          <!-- 讲义大标题与元信息 -->
          <header class="doc-header">
            <div class="doc-kicker font-mono">
              <span v-if="currentSection.chapterTag" class="doc-kicker-tag">{{ currentSection.chapterTag }}</span>
              <span v-if="currentSection.chapterTag && currentSection.chapterTitle" class="doc-kicker-sep">/</span>
              <span v-if="currentSection.chapterTitle" class="doc-kicker-title">{{ currentSection.chapterTitle }}</span>
            </div>
            <div class="doc-title-row">
              <h1 class="doc-main-title">{{ currentSection.title }}</h1>
              <button
                type="button"
                class="collect-section-btn font-mono"
                :class="{ 'is-collected': isSectionCollected }"
                :title="isSectionCollected ? '整小节已收入我的讲义 (点击移除)' : '将整小节收入我的讲义'"
                @click="handleToggleSectionCollect"
              >
                <component :is="isSectionCollected ? BookmarkSolid : Bookmark" width="13" height="13" />
                <span>{{ isSectionCollected ? '小节已收录' : '+ 收入整小节' }}</span>
              </button>
            </div>
            <p v-if="currentContent.lead || currentSection.desc" class="doc-lead">
              {{ currentContent.lead || currentSection.desc }}
            </p>
            <div v-if="lastModifiedText" class="doc-section-meta font-mono">
              <span class="doc-last-modified">上次修改：{{ lastModifiedText }}</span>
            </div>
          </header>

          <!-- 配套交互动画（若存在且已开启，位于 Typst Doc 顶部展示） -->
          <LectureViewerEmbed
            v-if="currentContent.animation"
            :key="currentContent.animation.id || currentContent.id"
            :animation="currentContent.animation"
            :title="currentContent.animation.title || currentSection.title"
          />

          <!-- 讲义正文 -->
          <TypstDoc
            v-if="currentContent.doc"
            :doc="currentContent.doc"
          />

          <!-- 底部修改时间说明 -->
          <footer v-if="lastModifiedText" class="doc-meta-footer">
            <span class="doc-last-modified font-mono">上次修改：{{ lastModifiedText }}</span>
          </footer>
        </article>

        <!-- 底部翻页导航栏 -->
        <DocFooterNav
          v-if="!isLoading && !loadError"
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
        <span class="selection-mode-text">划选模式已开启 · 划选正文与公式</span>
        <button
          type="button"
          class="selection-mode-exit-btn"
          title="退出划选模式"
          @click="toggleSelectionMode"
        >
          退出
        </button>
      </div>
    </Transition>

    <!-- 文本划选标记工具栏 -->
    <MSelectionToolbar
      container=".markdown-article"
      :disabled="!isSelectionMode"
    />

    <!-- 移动端右下角横向展开/收起浮动快捷栏 -->
    <div
      ref="cornerFabRef"
      class="mobile-corner-fab-wrap"
      :class="{
        'is-expanded': isCornerExpanded,
        'is-hidden-by-scroll': isCornerHiddenByScroll
      }"
      role="region"
      aria-label="移动端快捷操作栏"
    >
      <!-- 横向展开行动按钮组 (自右向左展开，GPU 硬件加速无重排闪烁) -->
      <div class="mobile-corner-actions" :class="{ 'is-open': isCornerExpanded }">
        <button
          type="button"
          class="mobile-corner-btn"
          title="查看课程目录"
          @click="handleCornerAction(openDrawer)"
        >
          <List width="15" height="15" />
          <span>目录</span>
        </button>

        <button
          v-if="pageOutlines.length > 0"
          type="button"
          class="mobile-corner-btn"
          title="查看本讲大纲"
          @click="handleCornerAction(() => isOutlineDrawerOpen = true)"
        >
          <MenuScale width="15" height="15" />
          <span>大纲</span>
        </button>

        <button
          type="button"
          class="mobile-corner-btn"
          :class="{ 'is-active': isSelectionMode }"
          :title="isSelectionMode ? '退出划选模式' : '开启划选模式'"
          @click="toggleSelectionMode"
        >
          <EditPencil width="15" height="15" />
          <span>{{ isSelectionMode ? '退出' : '划选' }}</span>
        </button>

        <button
          type="button"
          class="mobile-corner-btn"
          :class="{ 'is-active': isSectionCollected }"
          :title="isSectionCollected ? '小节已收录 (点击移出)' : '将整小节收入我的讲义'"
          @click="handleToggleSectionCollect"
        >
          <component :is="isSectionCollected ? BookmarkSolid : Bookmark" width="15" height="15" />
          <span>{{ isSectionCollected ? '已收录' : '+讲义' }}</span>
        </button>

        <button
          type="button"
          class="mobile-corner-btn"
          title="返回顶部"
          @click="handleCornerAction(scrollToTop)"
        >
          <ArrowUp width="15" height="15" />
          <span>回顶</span>
        </button>
      </div>

      <!-- 右侧主触发/收起按钮 (CSS 180° 平滑旋转，无任何 DOM 重构跳帧) -->
      <button
        type="button"
        class="mobile-corner-trigger"
        :class="{ 'is-active': isCornerExpanded }"
        :title="isCornerExpanded ? '收起快捷栏' : '展开快捷栏'"
        @click="isCornerExpanded = !isCornerExpanded"
      >
        <NavArrowLeft width="18" height="18" class="trigger-arrow" />
      </button>
    </div>
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
  gap: 24px;
  color: var(--text-primary);
  line-height: 1.7;
}

/* 讲义标题栏 */
.doc-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 20px;
}

.doc-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-smaller);
  line-height: 1.4;
}

.doc-kicker-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--accent-muted);
  color: var(--accent-primary);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.5px;
}

.doc-kicker-sep {
  color: var(--border-subtle);
  font-size: var(--font-size-smallest);
  user-select: none;
}

.doc-kicker-title {
  color: var(--text-secondary);
  letter-spacing: 0.2px;
}

.doc-section-meta {
  display: flex;
  align-items: center;
  margin-top: 4px;
}

.doc-last-modified {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  letter-spacing: 0.2px;
}

.doc-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.collect-section-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs, 2px);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
}

.collect-section-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.collect-section-btn.is-collected {
  background-color: rgba(56, 189, 248, 0.14);
  color: var(--accent-primary);
  border-color: rgba(56, 189, 248, 0.35);
  font-weight: 500;
}

.doc-main-title {
  font-size: var(--font-size-largest);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  line-height: 1.3;
  margin: 0;
}

.doc-lead {
  font-size: var(--font-size);
  color: var(--text-secondary);
  line-height: 1.6;
}

.doc-meta-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 20px;
  border-top: 1px dashed var(--border-subtle);
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
  pointer-events: auto;
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

.selection-mode-exit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  background-color: var(--bg-hover);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-size: var(--font-size-smallest);
  cursor: pointer;
  transition: all 120ms ease;
}

.selection-mode-exit-btn:hover {
  background-color: var(--accent-muted);
  color: var(--accent-primary);
  border-color: var(--border-hover);
}

/* 移动端右下角横向展开快捷栏 (桌面端隐藏) */
.mobile-corner-fab-wrap {
  display: none !important;
}

/* 移动端适配 */
@media (max-width: 768px) {
  /* 隐藏桌面端左上角小目录按钮 */
  .drawer-open-btn {
    display: none;
  }

  .reading-content-wrap {
    padding: 18px 14px 100px 14px;
    max-width: 100%;
  }

  .markdown-article {
    gap: 18px;
  }

  .doc-header {
    gap: 10px;
    padding-bottom: 14px;
  }

  .doc-kicker {
    flex-wrap: wrap;
    gap: 6px;
  }

  .doc-main-title {
    font-size: 21px;
    line-height: 1.35;
    word-break: break-word;
  }

  .doc-lead {
    font-size: 13.5px;
    line-height: 1.6;
  }

  .doc-meta-footer {
    padding-top: 14px;
  }

  /* 提示胶囊向上避让 */
  .selection-mode-pill {
    bottom: 74px;
    max-width: calc(100vw - 28px);
    padding: 6px 12px;
    font-size: 13px;
    gap: 8px;
    justify-content: space-between;
  }

  .selection-mode-text {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 右下角横向展开快捷栏 */
  .mobile-corner-fab-wrap {
    position: fixed;
    bottom: calc(18px + env(safe-area-inset-bottom, 0px));
    right: 14px;
    z-index: 45;
    display: flex !important;
    align-items: center;
    justify-content: flex-end;
    pointer-events: none;
    transition: transform 220ms ease, opacity 180ms ease;
  }

  .mobile-corner-fab-wrap > * {
    pointer-events: auto;
  }

  .mobile-corner-fab-wrap.is-hidden-by-scroll {
    transform: translateY(calc(100% + 28px));
    opacity: 0;
    pointer-events: none;
  }

  /* 横向展开的操作项 (GPU 合成层加速，无 reflow 重排闪烁) */
  .mobile-corner-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 4px 2px 8px;
    background-color: rgba(26, 26, 26, 0.94);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--border-subtle);
    border-radius: 9999px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.55);
    margin-right: 6px;
    user-select: none;
    white-space: nowrap;
    transform-origin: right center;
    transform: scale(0.85) translateX(16px);
    opacity: 0;
    pointer-events: none;
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
    will-change: transform, opacity;
  }

  .mobile-corner-actions.is-open {
    transform: scale(1) translateX(0);
    opacity: 1;
    pointer-events: auto;
  }

  .mobile-corner-btn {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 44px;
    height: 38px;
    padding: 0 6px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
    flex-shrink: 0;
  }

  .mobile-corner-btn:active {
    transform: scale(0.95);
  }

  .mobile-corner-btn.is-active {
    background-color: var(--accent-muted);
    color: var(--accent-primary);
  }

  /* 右侧触发圆钮 (常驻且不位移，纯 CSS 旋转平滑过渡) */
  .mobile-corner-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    min-width: 42px;
    border: 1px solid var(--border-subtle);
    background-color: rgba(26, 26, 26, 0.94);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-radius: 50%;
    color: var(--text-secondary);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease, transform 120ms ease;
    user-select: none;
  }

  .mobile-corner-trigger:active {
    transform: scale(0.93);
  }

  .mobile-corner-trigger.is-active {
    background-color: var(--bg-hover);
    color: var(--accent-primary);
    border-color: var(--border-hover);
  }

  .trigger-arrow {
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform;
  }

  .mobile-corner-trigger.is-active .trigger-arrow {
    transform: rotate(180deg);
  }

  /* 移动端大纲面板内容 */
  .mobile-outline-panel {
    display: flex;
    flex-direction: column;
    padding: 10px 8px;
    gap: 4px;
  }

  .mobile-outline-empty {
    padding: 24px 12px;
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
  }

  .mobile-outline-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    width: 100%;
  }

  .mobile-outline-row .mobile-outline-item {
    flex: 1;
    min-width: 0;
  }

  .mobile-outline-collect-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius-xs, 2px);
    cursor: pointer;
    flex-shrink: 0;
  }

  .mobile-outline-collect-btn.is-collected {
    color: var(--accent-primary);
  }

  .mobile-outline-collect-btn.is-absorbed {
    color: var(--accent-primary);
    opacity: 0.6;
    cursor: default;
  }

  .mobile-outline-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    text-align: left;
    color: var(--text-secondary);
    font-size: 13.5px;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
  }

  .mobile-outline-item:hover,
  .mobile-outline-item:active {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .mobile-outline-item.active {
    background-color: var(--bg-hover);
    color: var(--accent-primary);
    font-weight: var(--font-weight-medium);
  }

  .mobile-outline-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--border-subtle);
    flex-shrink: 0;
  }

  .mobile-outline-item.active .mobile-outline-dot {
    background-color: var(--accent-primary);
  }

  .mobile-outline-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
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
