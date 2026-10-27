<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Search, Xmark, ArrowRight } from '@iconoir/vue';
import { renderToString } from 'typlet';
import { fetchSearchRecommendations } from '../api';
import {
  useLectureSearch,
  getSectionTags,
  getBrightTagVariant
} from '../utils';

const props = defineProps({
  // 外观形态：'hero' (欢迎页中央大搜索舱) | 'topbar' (顶栏紧凑搜索框)
  variant: {
    type: String,
    default: 'topbar' // 'hero' | 'topbar'
  },
  autoFocus: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select', 'navigate', 'focus', 'blur']);

const route = useRoute();
const router = useRouter();

// DOM 引用
const containerRef = ref(null);
const inputRef = ref(null);
const listRef = ref(null);

// 搜索状态
const isOpen = ref(false);

// 占位提示轮播（仅 hero 模式启用）
const placeholders = [
  '搜索考研高数核心定理，如: 泰勒公式...',
  '搜索课程或章节，如: 极限与连续...',
  '键入 Typst 公式代码，如: $f(x) = \\int_0^x e^{-t^2} dt$...',
  '搜索线性代数，如: 特征值与相似对角化...'
];
const currentPlaceholder = ref(placeholders[0]);
let placeholderTimer = null;
let phIndex = 0;

const startPlaceholderLoop = () => {
  if (props.variant !== 'hero') return;
  placeholderTimer = setInterval(() => {
    phIndex = (phIndex + 1) % placeholders.length;
    currentPlaceholder.value = placeholders[phIndex];
  }, 3600);
};

// 推荐默认节点数据（由后端 API 动态随机获取 6 个小节）
const defaultLectures = ref([]);

const {
  query,
  isSearching,
  searchError,
  activeIndex,
  displayResults,
  clear: clearQuery,
  executeSearch,
  handleKeyNavigation
} = useLectureSearch({
  defaultItems: () => defaultLectures.value,
  limit: 15,
  listRef
});

// 路由变化时重置搜索状态并失焦
watch(
  () => route.path,
  () => {
    isOpen.value = false;
    activeIndex.value = -1;
    inputRef.value?.blur();
  }
);

// 检测 Typst 公式输入并即时编译
const typstPreviewHtml = computed(() => {
  const q = query.value.trim();
  if (!q) return null;
  if (q.startsWith('$') || q.includes('\\') || q.includes('^') || q.includes('_') || q.includes('=')) {
    try {
      const cleanTypst = q.replace(/^\$+|\$+$/g, '').trim();
      if (!cleanTypst) return null;
      return renderToString(cleanTypst, { displayMode: true });
    } catch {
      return null;
    }
  }
  return null;
});

// 唤醒与关闭逻辑
const openSearch = () => {
  isOpen.value = true;
  emit('focus');
};

const closeSearch = () => {
  isOpen.value = false;
  activeIndex.value = -1;
  emit('blur');
};

const handleInputFocus = () => {
  openSearch();
};

const handleInputBlur = () => {
  // 延迟失焦确保点击选项生效
  setTimeout(() => {
    if (props.variant === 'hero') {
      isOpen.value = false;
    }
  }, 180);
};

// 确认选择或跳转
const handleSelect = (item) => {
  if (!item) return;
  closeSearch();
  inputRef.value?.blur();
  emit('select', item);

  // 后端已返回 /course/:courseId/doc/:sectionId；缺失时按 courseId 兜底，避免跳错课程
  const targetPath = item.type === 'knowledge'
    ? `/knowledge/${item.id}`
    : item.type === 'lecture'
      ? `/course/${item.id}`
      : item.path;
  if (!targetPath) return;
  emit('navigate', targetPath);
  router.push(targetPath);
};

// 清空输入
const handleClear = () => {
  clearQuery();
  inputRef.value?.focus();
};

// 键盘事件响应
const handleKeyDown = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    closeSearch();
    inputRef.value?.blur();
    return;
  }

  if (e.key === 'Escape') {
    closeSearch();
    inputRef.value?.blur();
    return;
  }

  handleKeyNavigation(e, handleSelect);
};

// 全局快捷键响应 Ctrl+K
const handleGlobalKey = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    const isStart = route.path === '/start';
    // hero 模式仅响应 start 页面；topbar 模式响应除 start 外的页面
    if (props.variant === 'hero' && !isStart) return;
    if (props.variant === 'topbar' && isStart) return;

    e.preventDefault();
    if (isOpen.value && document.activeElement === inputRef.value) {
      closeSearch();
      inputRef.value?.blur();
    } else {
      inputRef.value?.focus();
      openSearch();
    }
  }
};

// 点击外部关闭弹层
const handleClickOutside = (e) => {
  if (containerRef.value && !containerRef.value.contains(e.target)) {
    closeSearch();
  }
};

onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('keydown', handleGlobalKey);
  startPlaceholderLoop();

  if (props.autoFocus) {
    inputRef.value?.focus();
  }

  try {
    const recs = await fetchSearchRecommendations(6);
    if (Array.isArray(recs) && recs.length > 0) {
      defaultLectures.value = recs;
    }
  } catch (err) {
    console.warn('[SearchBar] 获取搜索推荐失败:', err);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('keydown', handleGlobalKey);
  if (placeholderTimer) clearInterval(placeholderTimer);
});

// 暴露焦点方法
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  clear: handleClear
});
</script>

<template>
  <div
    ref="containerRef"
    class="search-bar-unified"
    :class="[
      `is-${variant}`,
      { 'is-focused': isOpen }
    ]"
    @click="inputRef?.focus()"
  >
    <!-- 全屏半透明遮罩 (topbar 紧凑模式专用) -->
    <MBackdrop
      v-if="variant === 'topbar'"
      teleport="body"
      :open="isOpen"
      :z-index="80"
      @close="closeSearch"
    />

    <!-- 输入框主体 -->
    <div class="search-input-inner">
      <Search
        :width="variant === 'hero' ? 19 : 16"
        :height="variant === 'hero' ? 19 : 16"
        class="search-icon"
      />

      <div class="input-wrapper">
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          name="makimath_search"
          autocomplete="off"
          spellcheck="false"
          class="native-search-input"
          :placeholder="variant === 'topbar' ? '查找节点、公式定义或输入命令...' : ''"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
          @keydown="handleKeyDown"
        />

        <!-- 仅 hero 模式展现的垂直滚动翻转占位符 -->
        <div v-if="variant === 'hero' && !query" class="hero-placeholder-layer">
          <transition name="placeholder-roll" mode="out-in">
            <span :key="currentPlaceholder" class="placeholder-text">
              {{ currentPlaceholder }}
            </span>
          </transition>
        </div>
      </div>

      <!-- 清空按钮 -->
      <button
        v-if="query"
        type="button"
        class="search-clear-btn"
        title="清除内容"
        @click.stop="handleClear"
      >
        <Xmark :width="variant === 'hero' ? 16 : 14" :height="variant === 'hero' ? 16 : 14" />
      </button>

      <!-- 键盘快捷键徽标 -->
      <div v-else class="kbd-wrap font-mono">
        <kbd class="kbd-badge">Ctrl+K</kbd>
      </div>
    </div>

    <!-- 检索结果浮层卡片 -->
    <transition name="dropdown-anim">
      <div v-if="isOpen" class="search-dropdown-card">
        <!-- Typst 公式实时编译结果 -->
        <transition name="preview-slide">
          <div v-if="typstPreviewHtml" class="typst-preview-box">
            <div class="preview-header font-mono">
              <span class="preview-tag">TYPST LIVE COMPILED</span>
              <span class="preview-hint">毫秒级公式即时排版预览</span>
            </div>
            <div class="preview-body" v-html="typstPreviewHtml"></div>
          </div>
        </transition>

        <!-- 结果列表头部统计 -->
        <div class="dropdown-header">
          <span>{{ query ? '匹配知识点与讲义' : '推荐讲义' }}</span>
          <span class="count-tag font-mono">{{ displayResults.length }} 节点</span>
        </div>

        <!-- 滚动列表 -->
        <div ref="listRef" v-if="displayResults.length" class="dropdown-list">
          <div
            v-for="(item, idx) in displayResults"
            :key="`${item.type}:${item.id}`"
            class="result-row"
            :class="{ 'is-active': activeIndex === idx }"
            @mousedown.prevent="handleSelect(item)"
            @mouseenter="activeIndex = idx"
          >
            <!-- 标签列：课程名称 + 小节标签（使用 MTag 原生无边框大号样式） -->
            <div class="result-tag-col">
              <MTag :variant="getBrightTagVariant(item.type)" size="md" :mono="false">
                {{ item.type === 'knowledge' ? '知识点' : '讲义' }}
              </MTag>
              <MTag
                v-for="(st, stIdx) in getSectionTags(item.tag)"
                :key="stIdx"
                :variant="getBrightTagVariant(st)"
                size="md"
                :mono="false"
              >
                {{ st }}
              </MTag>
            </div>

            <!-- 主内容列 -->
            <div class="result-content-col">
              <span class="result-title">{{ item.title }}</span>
              <span v-if="item.type !== 'knowledge' && (item.descr || item.summary)" class="result-excerpt font-mono">
                {{ item.descr || item.summary }}
              </span>
            </div>

            <ArrowRight width="14" height="14" class="result-arrow" />
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else-if="searchError" class="empty-state">
          <span>{{ searchError }}</span>
          <button type="button" @mousedown.prevent.stop="executeSearch(query)">重试</button>
        </div>
        <div v-else-if="isSearching" class="empty-state">正在搜索</div>
        <div v-else class="empty-state">
          <span>{{ query ? `未找到与「${query}」相关的内容` : '暂无推荐讲义' }}</span>
        </div>

        <!-- 底部快捷键指南 -->
        <div class="dropdown-footer font-mono">
          <span><kbd>↑</kbd><kbd>↓</kbd> 导航</span>
          <span><kbd>Enter</kbd> 确认跳转</span>
          <span><kbd>Esc</kbd> 退出</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.search-bar-unified {
  position: relative;
  width: 100%;
  user-select: none;
}

/* ================== Hero 模式（欢迎页中央大搜索舱） ================== */
.search-bar-unified.is-hero {
  max-width: 640px;
  margin: 0 auto;
}

.search-bar-unified.is-hero .search-input-inner {
  height: 52px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm, 6px);
  padding: 0 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transition: border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease;
  cursor: text;
}

.search-bar-unified.is-hero:hover .search-input-inner {
  background-color: var(--bg-elevated);
  border-color: var(--border-hover);
}

.search-bar-unified.is-hero.is-focused .search-input-inner {
  background-color: var(--bg-elevated);
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--accent-primary), 0 8px 30px rgba(0, 0, 0, 0.25);
}

.search-bar-unified.is-hero .native-search-input {
  font-size: var(--font-size, 14px);
}

/* ================== Topbar 模式（顶栏紧凑搜索框） ================== */
.search-bar-unified.is-topbar {
  max-width: 500px;
}

.search-bar-unified.is-topbar .search-input-inner {
  height: 34px;
  background-color: var(--bg-surface, #1e1e1e);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-xs, 4px);
  padding: 0 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: border-color 160ms ease, background-color 160ms ease;
  cursor: text;
}

.search-bar-unified.is-topbar:hover .search-input-inner {
  background-color: var(--bg-elevated, #252525);
  border-color: var(--border-hover, rgba(255, 255, 255, 0.2));
}

.search-bar-unified.is-topbar.is-focused .search-input-inner {
  background-color: var(--bg-elevated, #252525);
  border-color: var(--accent-primary, #f59e0b);
  box-shadow: 0 0 0 1px var(--accent-primary, #f59e0b);
}

.search-bar-unified.is-topbar .native-search-input {
  font-size: 12.5px;
}

/* ================== 通用输入结构 ================== */
.search-input-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.search-icon {
  flex-shrink: 0;
  color: var(--accent-primary, #f59e0b);
}

.input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
  overflow: hidden;
}

.native-search-input {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-ui);
  position: relative;
  z-index: 2;
}

.native-search-input::-webkit-search-cancel-button {
  display: none;
}

/* 占位符轮播图层 */
.hero-placeholder-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 1;
}

.placeholder-text {
  font-size: var(--font-size-smaller, 13px);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
}

.placeholder-roll-enter-active,
.placeholder-roll-leave-active {
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease;
}

.placeholder-roll-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.placeholder-roll-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* 清除按钮与快捷键徽标 */
.search-clear-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: var(--radius-xs);
}

.search-clear-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-base);
}

.kbd-wrap {
  display: flex;
  align-items: center;
}

.kbd-badge {
  font-size: 10.5px;
  padding: 2px 6px;
  border-radius: var(--radius-xs, 3px);
  background-color: var(--bg-base, #121212);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  color: var(--text-muted, #888888);
}

/* ================== 下拉卡片 ================== */
.search-dropdown-card {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 95;
  max-height: 400px;
}

.is-topbar .search-dropdown-card {
  max-height: 380px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}

/* Typst 编译实时预览 */
.typst-preview-box {
  padding: 12px 16px;
  background-color: var(--bg-base);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-slide-enter-active,
.preview-slide-leave-active {
  transition: all 220ms cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 140px;
  overflow: hidden;
}

.preview-slide-enter-from,
.preview-slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  transform: translateY(-6px);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-tag {
  font-size: 11px;
  color: var(--accent-primary);
  font-weight: var(--font-weight-medium);
}

.preview-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.preview-body {
  padding: 6px 10px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.dropdown-header {
  padding: 9px 16px;
  font-size: 11.5px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
}

.count-tag {
  font-size: 11px;
}

/* 列表容器 */
.dropdown-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: 240px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 16px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background-color 150ms ease, border-left-color 150ms ease, padding-left 150ms ease;
}

.result-row:hover,
.result-row.is-active {
  background-color: var(--bg-elevated);
  border-left-color: var(--accent-primary);
  padding-left: 20px;
}

.result-tag-col {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.result-content-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.result-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-excerpt {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-arrow {
  color: var(--text-muted);
  opacity: 0.3;
  flex-shrink: 0;
  transition: transform 180ms ease, opacity 180ms ease, color 180ms ease;
}

.result-row:hover .result-arrow,
.result-row.is-active .result-arrow {
  color: var(--accent-primary);
  opacity: 1;
  transform: translateX(4px);
}

.empty-state {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}

.dropdown-footer {
  padding: 8px 16px;
  background-color: var(--bg-base);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 11px;
  color: var(--text-muted);
}

.dropdown-footer kbd {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  padding: 1px 4px;
  border-radius: var(--radius-xs);
  font-size: 10px;
  color: var(--text-primary);
}

/* 下拉菜单淡入动效 */
.dropdown-anim-enter-active,
.dropdown-anim-leave-active {
  transition: opacity 160ms ease, transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-anim-enter-from,
.dropdown-anim-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 640px) {
  .search-bar-unified.is-hero .search-input-inner {
    height: 46px;
    padding: 0 12px;
  }

  .kbd-wrap {
    display: none;
  }

  .dropdown-footer {
    display: none;
  }

  .search-dropdown-card {
    max-height: min(320px, 52vh);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  }

  .dropdown-list {
    max-height: min(240px, 42vh);
  }

  .result-row {
    padding: 8px 12px;
    gap: 8px;
  }

  .result-row:hover,
  .result-row.is-active {
    padding-left: 14px;
  }

  .result-tag-col {
    max-width: 84px;
  }
}
</style>
