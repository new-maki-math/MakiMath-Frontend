<script setup>
// 全局通用数据分页组件
import { computed } from 'vue';
import { NavArrowLeft, NavArrowRight } from '@iconoir/vue';

const props = defineProps({
  page: {
    type: Number,
    default: 1
  },
  pageSize: {
    type: Number,
    default: 20
  },
  total: {
    type: Number,
    default: 0
  },
  pageSizeOptions: {
    type: Array,
    default: () => [10, 20, 50, 100]
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:page', 'update:pageSize', 'change']);

// 计算总页数
const totalPages = computed(() => {
  if (!props.total || props.total <= 0) return 1;
  return Math.ceil(props.total / props.pageSize);
});

// 生成带省略号的紧凑页码序列
const pageItems = computed(() => {
  const current = props.page;
  const count = totalPages.value;
  if (count <= 7) {
    const list = [];
    for (let i = 1; i <= count; i += 1) {
      list.push(i);
    }
    return list;
  }
  const pages = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(count - 1, current + 1);

  if (left > 2) {
    pages.push('ellipsis-left');
  }
  for (let i = left; i <= right; i += 1) {
    pages.push(i);
  }
  if (right < count - 1) {
    pages.push('ellipsis-right');
  }
  pages.push(count);
  return pages;
});

// 切换页码事件
const goToPage = (p) => {
  if (props.disabled || p < 1 || p > totalPages.value || p === props.page) return;
  emit('update:page', p);
  emit('change', { page: p, pageSize: props.pageSize });
};

// 切换每页展示数量
const handlePageSizeChange = (e) => {
  if (props.disabled) return;
  const newSize = Number(e.target.value) || 20;
  emit('update:pageSize', newSize);
  emit('update:page', 1);
  emit('change', { page: 1, pageSize: newSize });
};
</script>

<template>
  <div class="m-pagination font-mono" :class="{ 'is-disabled': disabled }">
    <div class="pagination-info">
      <span class="info-muted">共 {{ total }} 条</span>
    </div>

    <div class="pagination-controls">
      <button
        type="button"
        class="page-nav-btn"
        :disabled="disabled || page <= 1"
        title="上一页"
        @click="goToPage(page - 1)"
      >
        <NavArrowLeft width="14" height="14" />
      </button>

      <div class="page-numbers">
        <template v-for="item in pageItems" :key="item">
          <span v-if="typeof item === 'string'" class="page-ellipsis">...</span>
          <button
            v-else
            type="button"
            class="page-num-btn"
            :class="{ 'is-active': item === page }"
            :disabled="disabled"
            @click="goToPage(item)"
          >
            {{ item }}
          </button>
        </template>
      </div>

      <button
        type="button"
        class="page-nav-btn"
        :disabled="disabled || page >= totalPages"
        title="下一页"
        @click="goToPage(page + 1)"
      >
        <NavArrowRight width="14" height="14" />
      </button>

      <div class="page-size-wrap">
        <select
          class="page-size-select font-mono"
          :value="pageSize"
          :disabled="disabled"
          @change="handlePageSizeChange"
        >
          <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">
            {{ opt }} 条/页
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 分页栏整体布局 */
.m-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 0;
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
}

.m-pagination.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-muted {
  color: var(--text-muted);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 翻页导航与页码按钮样式 */
.page-nav-btn,
.page-num-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: var(--radius-xs);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-smaller);
  cursor: pointer;
  transition: all 120ms ease;
  user-select: none;
}

.page-nav-btn:hover:not(:disabled),
.page-num-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.page-num-btn.is-active {
  background-color: var(--accent-muted);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
  font-weight: var(--font-weight-semibold);
}

.page-nav-btn:disabled,
.page-num-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 28px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  user-select: none;
}

/* 每页条数下拉选择框 */
.page-size-wrap {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
}

.page-size-select {
  height: 28px;
  padding: 0 8px;
  border-radius: var(--radius-xs);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  cursor: pointer;
  outline: none;
  transition: border-color 120ms ease;
}

.page-size-select:hover:not(:disabled) {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.page-size-select:focus {
  border-color: var(--accent-primary);
}
</style>
