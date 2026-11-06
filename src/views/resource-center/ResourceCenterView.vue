<script setup>
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Copy,
  EditPencil,
  Folder,
  Page,
  Trash,
  Upload
} from '@iconoir/vue';
import { computed, inject, onUnmounted, ref, watch } from 'vue';

import MButton from '../../components/MButton.vue';
import MDataView from '../../components/MDataView.vue';
import { authStatus, isSuperAdmin } from '../../utils/auth.js';

const sections = [
  {
    title: 'PDF 资源',
    items: [
      {
        title: '考研数学',
        updatedAt: '2026-10-25T08:00:00Z',
        description: '考研数学复习资料',
        children: [
          {
            title: '高等数学',
            updatedAt: '2026-10-24T08:00:00Z',
            description: '高等数学复习资料',
            children: [
              {
                title: '微积分',
                updatedAt: '2026-10-22T08:00:00Z',
                description: '微积分相关资料',
                children: [
                  {
                    title: '积分公式整理',
                    updatedAt: '2026-10-21T08:00:00Z',
                    description: '常用积分公式与计算方法'
                  }
                ]
              },
              {
                title: '高等数学常用公式',
                updatedAt: '2026-10-23T08:00:00Z',
                description: '极限、微分与积分的常用公式整理'
              }
            ]
          },
          {
            title: '线性代数知识梳理',
            updatedAt: '2026-10-20T08:00:00Z',
            description: '矩阵、向量和线性方程组复习资料'
          }
        ]
      },
      {
        title: '概率论复习提纲',
        updatedAt: '2026-10-26T08:00:00Z',
        description: '随机变量、数字特征与常见分布'
      }
    ]
  },
  {
    title: '已归档资源',
    updatedAt: '2026-09-01T08:00:00Z',
    items: [
      {
        title: '过往复习资料',
        updatedAt: '2026-09-01T08:00:00Z',
        description: '已归档的数学复习资料',
        children: [
          {
            title: '数学基础复习资料',
            updatedAt: '2026-08-13T08:00:00Z',
            description: '过往版本的基础知识整理'
          },
          {
            title: '高等数学练习汇编',
            updatedAt: '2026-08-20T08:00:00Z',
            description: '过往版本的章节练习资料'
          }
        ]
      }
    ]
  }
];
const rootItems = [
  ...sections[0].items,
  {
    title: '已归档资源',
    updatedAt: '2026-09-01T08:00:00Z',
    description: '查看已归档的 PDF 资料',
    archived: true,
    children: sections[1].items
  }
];
const folderPath = ref([]);
const layoutState = inject('layoutState');
const sortField = ref('name');
const sortDirection = ref('asc');
const isManager = computed(() => authStatus.value === 'authenticated' && isSuperAdmin.value);
const actions = [
  {
    label: '编辑',
    icon: EditPencil
  },
  {
    label: '复制',
    icon: Copy
  },
  {
    label: '移动',
    icon: ArrowRight
  },
  {
    label: '删除',
    icon: Trash
  }
];
const collator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base'
});
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
const currentItems = computed(() =>
  folderPath.value.length ? folderPath.value[folderPath.value.length - 1].children : rootItems
);
const sortedItems = computed(() => {
  const direction = sortDirection.value === 'asc' ? 1 : -1;
  return [...currentItems.value].sort((a, b) => {
    const archiveOrder = Number(Boolean(a.archived)) - Number(Boolean(b.archived));
    if (archiveOrder) {
      return archiveOrder;
    }
    const folderOrder = Number(Boolean(b.children)) - Number(Boolean(a.children));
    if (folderOrder) {
      return folderOrder;
    }
    if (sortField.value === 'updatedAt') {
      const aTime = Date.parse(a.updatedAt);
      const bTime = Date.parse(b.updatedAt);
      if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) {
        if (Number.isFinite(aTime)) {
          return -1;
        }
        if (Number.isFinite(bTime)) {
          return 1;
        }
      } else if (aTime !== bTime) {
        return (aTime - bTime) * direction;
      }
    }
    return collator.compare(a.title, b.title) * direction;
  });
});
function changeSort(field) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = field === 'name' ? 'asc' : 'desc';
  }
}
function formatUpdatedAt(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? dateFormatter.format(time) : '—';
}
function openFolder(folder) {
  folderPath.value = [...folderPath.value, folder];
}
function goToLevel(index) {
  folderPath.value = folderPath.value.slice(0, index);
}
watch(
  folderPath,
  (path) => {
    layoutState.resourceBreadcrumbs.value = [
      {
        label: '资源中心',
        action: () => goToLevel(0)
      },
      ...path.map((folder, index) => ({
        label: folder.title,
        action: () => goToLevel(index + 1)
      }))
    ];
  },
  {
    immediate: true
  }
);
onUnmounted(() => {
  layoutState.resourceBreadcrumbs.value = [];
});
</script>

<template>
  <main class="resource-center">
    <section class="resource-section">
      <header class="section-heading">
        <MButton
          v-if="folderPath.length"
          variant="ghost"
          size="sm"
          icon-only
          title="上一级"
          aria-label="上一级"
          @click="goToLevel(folderPath.length - 1)"
        >
          <ArrowLeft
            aria-hidden="true"
            width="16"
            height="16"
          />
        </MButton>
        <div class="section-title">
          <h2>{{ folderPath.length ? folderPath[folderPath.length - 1].title : '全部资源' }}</h2>
          <span>{{ currentItems.length }} 项</span>
        </div>
        <MButton
          v-if="isManager"
          class="upload-action"
          variant="ghost"
          size="sm"
          icon-only
          disabled
          title="上传"
          aria-label="上传"
          ><Upload
            aria-hidden="true"
            width="18"
            height="18"
        /></MButton>
      </header>
      <MDataView :content-key="JSON.stringify(folderPath.map((folder) => folder.title))">
        <div
          class="resource-list"
          :class="{
            'has-actions': isManager
          }"
        >
          <div class="list-heading">
            <button
              type="button"
              class="sort-button"
              @click="changeSort('name')"
            >
              名称
              <span
                v-if="sortField === 'name'"
                aria-hidden="true"
                >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span
              ><span class="sr-only">{{
                sortField === 'name' ? (sortDirection === 'asc' ? '升序' : '降序') : ''
              }}</span>
            </button>
            <button
              type="button"
              class="sort-button"
              @click="changeSort('updatedAt')"
            >
              修改时间
              <span
                v-if="sortField === 'updatedAt'"
                aria-hidden="true"
                >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span
              ><span class="sr-only">{{
                sortField === 'updatedAt' ? (sortDirection === 'asc' ? '升序' : '降序') : ''
              }}</span>
            </button>
          </div>
          <div
            v-for="item in sortedItems"
            :key="item.title"
            class="resource-row"
          >
            <component
              :is="item.children ? 'button' : 'div'"
              :type="item.children ? 'button' : undefined"
              class="item-main"
              :class="{
                'is-folder': item.children
              }"
              @click="item.children && openFolder(item)"
            >
              <span
                class="item-icon"
                :class="{
                  'folder-icon': item.children
                }"
              >
                <Archive
                  v-if="item.archived"
                  aria-hidden="true"
                />
                <Folder
                  v-else-if="item.children"
                  aria-hidden="true"
                />
                <Page
                  v-else
                  aria-hidden="true"
                />
              </span>
              <span class="item-copy"
                ><span class="item-title">{{ item.title }}</span
                ><span class="item-description">{{ item.description }}</span></span
              >
            </component>
            <time
              class="item-date"
              :datetime="item.updatedAt || undefined"
              >{{ formatUpdatedAt(item.updatedAt) }}</time
            >
            <div
              v-if="isManager && !item.archived"
              class="row-actions"
            >
              <MButton
                v-for="action in actions"
                :key="action.label"
                variant="ghost"
                size="sm"
                icon-only
                disabled
                :title="action.label"
                :aria-label="`${action.label} ${item.title}`"
                ><component
                  :is="action.icon"
                  aria-hidden="true"
                  width="16"
                  height="16"
              /></MButton>
            </div>
          </div>
        </div>
      </MDataView>
    </section>
  </main>
</template>

<style scoped>
.resource-center {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 24px clamp(20px, 3vw, 40px) 40px;
  color: var(--text-primary);
}
.section-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.upload-action {
  margin-left: auto;
}
.section-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.section-title h2 {
  margin: 0;
  font-size: var(--font-size);
  font-weight: var(--font-weight-semibold);
}
.section-title > span {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.resource-list {
  border-top: 1px solid var(--border-subtle);
}
.list-heading,
.resource-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 20px;
  align-items: center;
}
.has-actions .list-heading,
.has-actions .resource-row {
  grid-template-columns: minmax(0, 1fr) 110px 112px;
}
.list-heading {
  padding: 10px 16px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.sort-button {
  justify-content: flex-start;
  color: var(--text-muted);
  font-size: inherit;
}
.sort-button:hover {
  color: var(--text-primary);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.resource-row {
  width: 100%;
  min-height: 68px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  color: inherit;
  font: inherit;
  text-align: left;
}
.resource-row:has(.is-folder:hover) {
  background: var(--bg-hover);
}
.item-main {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  gap: 14px;
  min-width: 0;
  text-align: left;
  line-height: normal;
}
.item-main.is-folder {
  cursor: pointer;
}
.item-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: var(--text-secondary);
}
.item-icon svg {
  width: 20px;
  height: 20px;
}
.item-icon.folder-icon {
  color: var(--accent-primary);
}
.item-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 5px;
}
.item-title {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  overflow-wrap: anywhere;
}
.item-description {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  line-height: 1.4;
}
.item-date {
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.row-actions {
  display: flex;
  grid-column: 3;
  grid-row: 1;
  justify-content: flex-end;
  visibility: hidden;
}
.resource-row:hover .row-actions,
.resource-row:focus-within .row-actions {
  visibility: visible;
}
@media (max-width: 480px) {
  .resource-center {
    padding: 14px 16px 24px;
  }
  .list-heading,
  .resource-row,
  .has-actions .list-heading,
  .has-actions .resource-row {
    grid-template-columns: minmax(0, 1fr) 92px;
    gap: 8px;
    padding-left: 8px;
    padding-right: 8px;
  }
  .row-actions {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: flex-start;
    visibility: visible;
  }
}
</style>
