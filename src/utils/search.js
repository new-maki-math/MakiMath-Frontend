import { ref, computed, watch, nextTick } from 'vue';
import { searchLectures } from '../api';

// 计算课程名称对应的标签色彩
export function getCourseTagVariant(courseName = '') {
  const variants = ['blue', 'teal', 'purple', 'cyan', 'green', 'amber'];
  if (!courseName) return 'blue';
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = (hash << 5) - hash + courseName.charCodeAt(i);
    hash |= 0;
  }
  return variants[Math.abs(hash) % variants.length];
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

// 计算小节标签色彩变体
export function getSectionTagVariant(tag = '') {
  const t = String(tag).trim().toUpperCase();
  if (t.includes('THM') || t.includes('定理')) return 'purple';
  if (t.includes('DEF') || t.includes('定义')) return 'cyan';
  if (t.includes('AXIOM') || t.includes('公理')) return 'amber';
  if (t.includes('PROP') || t.includes('性质') || t.includes('推论')) return 'green';
  if (t.includes('LEMMA') || t.includes('引理')) return 'teal';
  if (t.includes('EX') || t.includes('例题') || t.includes('练习') || t.includes('应用')) return 'lime';
  return 'muted';
}

// 全局讲义搜索管理可复用函数
export function useLectureSearch(options = {}) {
  const defaultItems = options.defaultItems || [];
  const limit = options.limit || 20;
  const debounceDelay = options.debounceDelay || 160;

  const query = ref('');
  const results = ref([]);
  const isSearching = ref(false);
  const activeIndex = ref(-1);

  let debounceTimer = null;
  let currentReqId = 0;

  // 执行底层全文检索
  const executeSearch = async (val) => {
    const q = String(val ?? '').trim();
    if (!q) {
      results.value = [];
      isSearching.value = false;
      return;
    }

    const reqId = ++currentReqId;
    isSearching.value = true;

    try {
      const hits = await searchLectures(q, limit);
      // 避免慢请求覆盖新请求
      if (reqId === currentReqId) {
        results.value = hits;
      }
    } finally {
      if (reqId === currentReqId) {
        isSearching.value = false;
      }
    }
  };

  // 监听输入词防抖查询
  watch(query, (newVal) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      executeSearch(newVal);
    }, debounceDelay);
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
    activeIndex,
    displayResults,
    clear,
    executeSearch,
    handleKeyNavigation,
    scrollToActive,
  };
}
