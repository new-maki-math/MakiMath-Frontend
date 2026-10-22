<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { Search, Xmark } from '@iconoir/vue';

const route = useRoute();
const inputRef = ref(null);
const searchContainerRef = ref(null);
const query = ref('');
const isOpen = ref(false);
const activeIndex = ref(-1);

// 路由变化时重置搜索状态并失焦
watch(
  () => route.path,
  () => {
    isOpen.value = false;
    activeIndex.value = -1;
    inputRef.value?.blur();
  }
);

// 示例搜索数据
const sampleData = [
  { id: '1', title: '中国剩余定理 (Chinese Remainder Theorem)', type: '定理', variant: 'purple', course: '初等数论', code: 'CRT_01' },
  { id: '2', title: '良序原理与第一/第二数学归纳法', type: '公理', variant: 'cyan', course: '数学基础', code: 'AXIOM_WO' },
  { id: '3', title: '单射、满射与双射构造定理', type: '性质', variant: 'green', course: '数学基础', code: 'PROP_BIJ' },
  { id: '4', title: '实数连续性之确界存在定理', type: '定理', variant: 'purple', course: '分析引论', code: 'THM_SUP' },
  { id: '5', title: '特征值、特征向量与正交对角化', type: '方法', variant: 'amber', course: '线性代数', code: 'EIGEN_DIAG' },
  { id: '6', title: '费马小定理与欧拉函数应用', type: '讲义', variant: 'blue', course: '精选路线', code: 'ROUTE_EULER' },
  { id: '7', title: '等价关系与商集的良定义性', type: '定义', variant: 'cyan', course: '数学基础', code: 'DEF_EQUIV' }
];

// 根据关键词过滤结果
const filteredResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    // 无输入时提供推荐项
    return sampleData.slice(0, 4);
  }
  return sampleData.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.type.toLowerCase().includes(q) ||
    item.course.toLowerCase().includes(q) ||
    item.code.toLowerCase().includes(q)
  );
});

const openSearch = () => {
  isOpen.value = true;
};

const closeSearch = () => {
  isOpen.value = false;
  activeIndex.value = -1;
};

const clearQuery = () => {
  query.value = '';
  activeIndex.value = -1;
  inputRef.value?.focus();
};

const handleSelect = (item) => {
  query.value = item.title;
  closeSearch();
  inputRef.value?.blur();
};

// 键盘导航控制
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

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredResults.value.length) {
      activeIndex.value = (activeIndex.value + 1) % filteredResults.value.length;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (filteredResults.value.length) {
      activeIndex.value = (activeIndex.value - 1 + filteredResults.value.length) % filteredResults.value.length;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeIndex.value >= 0 && activeIndex.value < filteredResults.value.length) {
      handleSelect(filteredResults.value[activeIndex.value]);
    }
  } else if (e.key === 'Escape') {
    closeSearch();
    inputRef.value?.blur();
  }
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

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('keydown', handleGlobalKey);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('keydown', handleGlobalKey);
});
</script>

<template>
  <div ref="searchContainerRef" class="search-container">
    <!-- 全局背景半透明压暗遮罩组件 (点击外部遮罩退出搜索) -->
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

    <!-- 下拉弹出搜索结果列表 (独立绝对定位浮层，确保输入框位置绝对稳定不发生偏移错位) -->
    <div class="search-dropdown-wrapper" :class="{ 'is-open': isOpen }">
      <MCollapse :open="isOpen">
        <div class="search-dropdown-card">
          <div class="dropdown-header">
            <span>{{ query ? '搜索结果' : '常用与推荐节点' }}</span>
            <span class="count">{{ filteredResults.length }} 项结果</span>
          </div>

          <div v-if="filteredResults.length" class="dropdown-list">
            <div
              v-for="(item, idx) in filteredResults"
              :key="item.id"
              class="result-item"
              :class="{ 'is-active': activeIndex === idx }"
              @click="handleSelect(item)"
              @mouseenter="activeIndex = idx"
            >
              <div class="item-tag-wrap">
                <MTag :variant="item.variant" size="md" :mono="false">{{ item.type }}</MTag>
              </div>
              <div class="item-main">
                <span class="item-title">{{ item.title }}</span>
                <div class="item-sub">
                  <span class="item-course">{{ item.course }}</span>
                  <span class="item-sep">//</span>
                  <span class="item-code">{{ item.code }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="dropdown-empty">
            <span class="empty-icon">[!]</span>
            <span>未找到与 "{{ query }}" 相关的数学节点</span>
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
  gap: 8px;
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
