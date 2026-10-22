<script setup>
// 全局通用数据表格组件
defineProps({
  columns: {
    type: Array,
    default: () => []
  },
  data: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: [String, Function],
    default: 'id'
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  loading: {
    type: Boolean,
    default: false
  }
});

// 获取行唯一键值
const getRowKey = (row, index, rowKey) => {
  if (typeof rowKey === 'function') {
    return rowKey(row, index);
  }
  return row[rowKey] ?? index;
};
</script>

<template>
  <div class="m-table-card font-mono">
    <table class="m-table">
      <thead>
        <tr>
          <slot name="header">
            <th
              v-for="col in columns"
              :key="col.key || col.prop"
              :style="{ width: col.width, minWidth: col.minWidth, textAlign: col.align || 'left' }"
            >
              {{ col.label || col.title }}
            </th>
          </slot>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading" class="m-table-empty-row">
          <td :colspan="columns.length || 1" class="m-table-empty-cell">
            加载数据中...
          </td>
        </tr>
        <tr v-else-if="!data || data.length === 0" class="m-table-empty-row">
          <td :colspan="columns.length || 1" class="m-table-empty-cell">
            {{ emptyText }}
          </td>
        </tr>
        <template v-else>
          <slot name="rows" :data="data">
            <tr
              v-for="(row, idx) in data"
              :key="getRowKey(row, idx, rowKey)"
              class="m-table-row"
            >
              <slot name="row" :row="row" :index="idx">
                <td
                  v-for="col in columns"
                  :key="col.key || col.prop"
                  :style="{ textAlign: col.align || 'left' }"
                >
                  <slot :name="col.key || col.prop" :row="row" :index="idx">
                    {{ row[col.prop || col.key] ?? '-' }}
                  </slot>
                </td>
              </slot>
            </tr>
          </slot>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.m-table-card {
  width: 100%;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.m-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-smaller);
}

.m-table :deep(th) {
  text-align: left;
  padding: 10px 14px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
  font-weight: var(--font-weight-medium);
  background-color: var(--bg-surface-elevated, var(--bg-surface));
  white-space: nowrap;
}

.m-table :deep(td) {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  white-space: nowrap;
}

.m-table :deep(tbody tr:hover) {
  background-color: var(--bg-hover);
}

.m-table-empty-row:hover {
  background-color: transparent !important;
}

.m-table-empty-cell {
  text-align: center;
  padding: 32px 14px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
</style>
