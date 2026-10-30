import { ref, computed, watch, nextTick, onScopeDispose } from 'vue';
import { searchLectures } from '../api';

// 明亮鲜艳的标签色彩变体（排除 gray、muted 等暗色）
const BRIGHT_TAG_VARIANTS = [
  'green',  // 翡翠绿
  'lime',   // 鲜柠绿
  'orange', // 亮橙
  'red',    // 亮红
  'cyan',   // 亮青
  'blue',   // 亮蓝
  'teal'   // 青绿
];

// 内容哈希映射到固定的明亮色彩变体
export function getBrightTagVariant(text = '') {
  const str = String(text ?? '').trim();
  if (!str) return 'cyan';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return BRIGHT_TAG_VARIANTS[Math.abs(hash) % BRIGHT_TAG_VARIANTS.length];
}

// 解析小节附加标签列表
export function getSectionTags(tag) {
  if (!tag) return [];
  if (Array.isArray(tag)) return tag.map((t) => String(t).trim()).filter(Boolean);
  return String(tag)
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// 全局讲义搜索管理可复用函数
export function useLectureSearch(options = {}) {
  const defaultItems = options.defaultItems || [];
  const limit = options.limit || 20;
  const debounceDelay = options.debounceDelay || 160;

  const query = ref('');
  const results = ref([]);
  const isSearching = ref(false);
  const searchError = ref('');
  const activeIndex = ref(-1);

  let debounceTimer = null;
  let currentReqId = 0;

  // 执行底层全文检索
  const executeSearch = async (val) => {
    const q = String(val ?? '').trim();
    const reqId = ++currentReqId;
    if (!q) {
      results.value = [];
      isSearching.value = false;
      return;
    }

    isSearching.value = true;
    searchError.value = '';

    try {
      const hits = await searchLectures(q, limit);
      // 避免慢请求覆盖新请求
      if (reqId === currentReqId) {
        results.value = hits;
      }
    } catch (err) {
      if (reqId === currentReqId) searchError.value = '搜索失败，请重试';
    } finally {
      if (reqId === currentReqId) {
        isSearching.value = false;
      }
    }
  };

  // 监听输入词防抖查询
  watch(query, (newVal) => {
    clearTimeout(debounceTimer);
    currentReqId++;
    results.value = [];
    searchError.value = '';
    isSearching.value = false;
    if (!newVal.trim()) return;
    debounceTimer = setTimeout(() => {
      executeSearch(newVal);
    }, debounceDelay);
  }, { flush: 'sync' });

  onScopeDispose(() => {
    clearTimeout(debounceTimer);
    currentReqId++;
  });

  // 展示列表结果计算
  const displayResults = computed(() => {
    const q = query.value.trim();
    if (!q) {
      return typeof defaultItems === 'function' ? defaultItems() : defaultItems;
    }
    return results.value;
  });

  // 清空输入内容
  const clear = () => {
    clearTimeout(debounceTimer);
    currentReqId++;
    isSearching.value = false;
    query.value = '';
    results.value = [];
    activeIndex.value = -1;
  };

  // 滚动高亮项至视口可视区域
  const scrollToActive = (idx) => {
    if (idx < 0) return;
    nextTick(() => {
      let container = options.listRef?.value;
      if (container?.$el) container = container.$el;
      if (!container && typeof document !== 'undefined') {
        container = document.querySelector('.search-dropdown-card .dropdown-list, .hero-dropdown-card .dropdown-list');
      }
      if (!container) return;

      if (idx === 0) {
        container.scrollTop = 0;
        return;
      }

      const items = container.querySelectorAll('.result-item, .result-row');
      if (idx === items.length - 1 && items.length > 0) {
        container.scrollTop = container.scrollHeight;
        return;
      }

      const target = items[idx];
      if (!target) return;

      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();

      if (tRect.top < cRect.top) {
        container.scrollTop -= cRect.top - tRect.top;
      } else if (tRect.bottom > cRect.bottom) {
        container.scrollTop += tRect.bottom - cRect.bottom;
      }
    });
  };

  // 键盘导航统一处理
  const handleKeyNavigation = (e, onSelect) => {
    const list = displayResults.value;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (list.length) {
        activeIndex.value = (activeIndex.value + 1) % list.length;
        scrollToActive(activeIndex.value);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.length) {
        activeIndex.value = (activeIndex.value - 1 + list.length) % list.length;
        scrollToActive(activeIndex.value);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex.value >= 0 && activeIndex.value < list.length) {
        onSelect?.(list[activeIndex.value]);
      } else if (list.length > 0) {
        onSelect?.(list[0]);
      }
    }
  };

  return {
    query,
    results,
    isSearching,
    searchError,
    activeIndex,
    displayResults,
    clear,
    executeSearch,
    handleKeyNavigation,
    scrollToActive,
  };
}
