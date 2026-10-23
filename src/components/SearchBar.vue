<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Search, Xmark } from '@iconoir/vue';
import { fetchSearchRecommendations } from '../api';
import { useLectureSearch, getCourseTagVariant, getSectionTags, getSectionTagVariant } from '../utils';

const route = useRoute();
const router = useRouter();
const inputRef = ref(null);
const searchContainerRef = ref(null);
const listRef = ref(null);
const isOpen = ref(false);

// 推荐默认小节数据
const defaultLectures = ref([]);

const {
  query,
  isSearching,
  activeIndex,
  displayResults,
  clear,
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

// 唤醒搜索框逻辑
const openSearch = (e) => {
  if (e && !e.isTrusted) return;
  isOpen.value = true;
};

const closeSearch = () => {
  isOpen.value = false;
  activeIndex.value = -1;
};

const clearQuery = () => {
  clear();
  inputRef.value?.focus();
};

const handleSelect = (item) => {
  query.value = item.title;
  closeSearch();
  inputRef.value?.blur();
  if (item.path) {
    router.push(item.path);
  }
};

// 键盘按键逻辑
const handleKeyDown = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    closeSearch();
    inputRef.value?.blur();
    return;
  }

  if (!isOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      openSearch();
    }
    return;
  }

  if (e.key === 'Escape') {
    closeSearch();
    inputRef.value?.blur();
    return;
  }

  handleKeyNavigation(e, handleSelect);
};

// 点击外部关闭弹层
const handleClickOutside = (e) => {
  if (searchContainerRef.value && !searchContainerRef.value.contains(e.target)) {
    closeSearch();
  }
};

// 全局快捷键唤起搜索
const handleGlobalKey = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    // start 页面由其中央输入框响应 Ctrl+K，顶部隐藏的搜索框不响应
    if (route.path === '/start') return;

    e.preventDefault();
    if (isOpen.value) {
      closeSearch();
      inputRef.value?.blur();
    } else {
      inputRef.value?.focus();
      openSearch();
    }
  }
};

onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('keydown', handleGlobalKey);
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
});
</script>

<template>
  <div ref="searchContainerRef" class="search-container">
    <!-- 全局背景半透明压暗遮罩组件 -->
    <MBackdrop
      teleport="body"
      :open="isOpen"
      :z-index="80"
      @close="closeSearch"
    />

    <div
      class="search-input-box"
      :class="{ 'is-focused': isOpen }"
      @click="openSearch"
    >
      <Search width="17" height="17" class="search-icon" />
      <input
        ref="inputRef"
        v-model="query"
        type="search"
        name="makimath_search_query"
        autocomplete="new-password"
        data-lpignore="true"
        data-form-type="other"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        class="search-native-input"
        placeholder="查找节点、公式定义或输入命令..."
        @focus="openSearch"
        @keydown="handleKeyDown"
      />
      <button
        v-if="query"
        class="search-clear-btn"
        title="清除内容"
        @click.stop="clearQuery"
      >
        <Xmark width="15" height="15" />
      </button>
      <kbd v-else class="shortcut">Ctrl+K</kbd>
    </div>

    <!-- 下拉弹出搜索结果列表 -->
    <div class="search-dropdown-wrapper" :class="{ 'is-open': isOpen }">
      <MCollapse :open="isOpen">
        <div class="search-dropdown-card">
          <div class="dropdown-header">
            <span>{{ query ? '检索结果' : '常用讲义小节' }}</span>
            <span class="count">{{ displayResults.length }} 项结果</span>
          </div>

          <div ref="listRef" v-if="displayResults.length" class="dropdown-list">
            <div
              v-for="(item, idx) in displayResults"
              :key="item.id"
              class="result-item"
              :class="{ 'is-active': activeIndex === idx }"
              @click="handleSelect(item)"
              @mouseenter="activeIndex = idx"
            >
              <!-- 标签列包含课程名称与小节标签 -->
              <div class="item-tag-wrap">
                <MTag :variant="getCourseTagVariant(item.courseTitle || item.course)" size="sm" :mono="false">
                  {{ item.courseTitle || item.course }}
                </MTag>
                <MTag
                  v-for="(st, stIdx) in getSectionTags(item.tag)"
                  :key="stIdx"
                  :variant="getSectionTagVariant(st)"
                  size="sm"
                  :mono="false"
                >
                  {{ st }}
                </MTag>
              </div>
              <div class="item-main">
                <!-- 标题为该小节名称 -->
                <span class="item-title">{{ item.title }}</span>
                <!-- 副标题为搜索关键词所在的语句节选 -->
                <div class="item-sub">
                  <span class="item-sentence-excerpt">{{ item.excerpt || item.summary || item.chapterTitle }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="dropdown-empty">
            <span class="empty-icon">[!]</span>
            <span>未找到与 "{{ query }}" 相关的讲义内容</span>
          </div>

          <div class="dropdown-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> 切换</span>
            <span><kbd>Enter</kbd> 确认</span>
            <span><kbd>Esc</kbd> 退出</span>
          </div>
        </div>
      </MCollapse>
    </div>
  </div>
</template>

<style scoped>
.search-container {
  position: relative;
  width: 100%;
}

.search-input-box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 12px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: text;
  transition: background-color 140ms ease, border-color 140ms ease;
}

.search-input-box:hover {
  background-color: var(--bg-elevated);
  border-color: var(--border-hover);
  color: var(--text-secondary);
}

.search-input-box.is-focused {
  background-color: var(--bg-elevated);
  border-color: var(--border-focus);
  color: var(--text-primary);
}

.search-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.search-native-input {
  flex: 1;
  font-size: var(--font-size);
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
}

.search-native-input::placeholder {
  color: var(--text-muted);
}

.shortcut {
  font-size: var(--font-size-smaller);
  padding: 3px 8px;
  background-color: var(--bg-topbar);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
  line-height: 1.2;
  flex-shrink: 0;
}

.search-clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.search-clear-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

/* 下拉结果定位容器 */
.search-dropdown-wrapper {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 100;
  pointer-events: none;
}

.search-dropdown-wrapper.is-open {
  pointer-events: auto;
}

/* 下拉结果卡片 */
.search-dropdown-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 8px;
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  letter-spacing: 0.6px;
  border-bottom: 1px solid var(--border-subtle);
}

.dropdown-header .count {
  color: var(--accent-primary);
  font-weight: var(--font-weight-semibold);
}

.dropdown-list {
  max-height: 360px;
  overflow-y: auto;
  padding: 6px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: background-color 120ms ease;
}

.result-item:hover,
.result-item.is-active {
  background-color: var(--bg-hover);
}

.item-tag-wrap {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.item-course-badge {
  font-size: var(--font-size-smallest);
  padding: 2px 7px;
  border-radius: var(--radius-xs);
  background-color: var(--accent-muted);
  border: 1px solid rgba(0, 122, 204, 0.25);
  color: var(--accent-primary);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.item-title {
  font-size: var(--font-size);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-sub {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  min-width: 0;
}

.item-sentence-excerpt {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-sep {
  color: var(--border-subtle);
}

.dropdown-empty {
  padding: 28px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.empty-icon {
  color: var(--tag-amber);
}

.dropdown-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 9px 14px;
  background-color: var(--bg-topbar);
  border-top: 1px solid var(--border-subtle);
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
}

.dropdown-footer kbd {
  display: inline-block;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  padding: 2.5px 7px;
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  font-size: var(--font-size-smallest);
  font-weight: var(--font-weight-medium);
  line-height: 1.1;
  margin-right: 5px;
}
</style>
