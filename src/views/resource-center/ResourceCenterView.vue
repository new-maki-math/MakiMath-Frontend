<script setup>
import { Archive, Folder, Page } from '@iconoir/vue';
import { computed, ref } from 'vue';

import MButton from '../../components/MButton.vue';

const sections = [
  {
    title: 'PDF 资源',
    items: [
      {
        title: '考研数学',
        description: '考研数学复习资料',
        children: [
          {
            title: '高等数学',
            description: '高等数学复习资料',
            children: [
              {
                title: '微积分',
                description: '微积分相关资料',
                children: [
                  {
                    title: '积分公式整理',
                    description: '常用积分公式与计算方法'
                  }
                ]
              },
              {
                title: '高等数学常用公式',
                description: '极限、微分与积分的常用公式整理'
              }
            ]
          },
          {
            title: '线性代数知识梳理',
            description: '矩阵、向量和线性方程组复习资料'
          }
        ]
      },
      {
        title: '概率论复习提纲',
        description: '随机变量、数字特征与常见分布'
      }
    ]
  },
  {
    title: '已归档资源',
    items: [
      {
        title: '过往复习资料',
        description: '已归档的数学复习资料',
        children: [
          {
            title: '数学基础复习资料',
            description: '过往版本的基础知识整理'
          },
          {
            title: '高等数学练习汇编',
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
    description: '查看已归档的 PDF 资料',
    archived: true,
    children: sections[1].items
  }
];
const folderPath = ref([]);
const currentItems = computed(() =>
  folderPath.value.length ? folderPath.value[folderPath.value.length - 1].children : rootItems
);

function openFolder(folder) {
  folderPath.value = [...folderPath.value, folder];
}

function goToLevel(index) {
  folderPath.value = folderPath.value.slice(0, index);
}
</script>

<template>
  <main class="resource-center">
    <header class="resource-heading">
      <div>
        <h1>资源中心</h1>
        <p class="page-note">PDF 资料与归档资源</p>
      </div>
      <span class="sample-note">示例展示 · 数据暂未接入</span>
    </header>

    <nav
      class="folder-path"
      aria-label="资源路径"
    >
      <span
        v-if="!folderPath.length"
        class="path-current"
        aria-current="page"
        >全部资源</span
      >
      <MButton
        v-else
        variant="ghost"
        size="sm"
        @click="goToLevel(0)"
        >全部资源</MButton
      >
      <template
        v-for="(folder, index) in folderPath"
        :key="index"
      >
        <span aria-hidden="true">/</span>
        <span
          v-if="index === folderPath.length - 1"
          class="path-current"
          aria-current="page"
          >{{ folder.title }}</span
        >
        <MButton
          v-else
          variant="ghost"
          size="sm"
          @click="goToLevel(index + 1)"
          >{{ folder.title }}</MButton
        >
      </template>
    </nav>

    <section class="resource-section">
      <header class="section-heading">
        <h2>{{ folderPath.length ? folderPath[folderPath.length - 1].title : '全部资源' }}</h2>
        <span>{{ currentItems.length }} 项</span>
      </header>
      <div class="resource-list">
        <div
          class="list-heading"
          aria-hidden="true"
        >
          <span>名称</span><span>类型</span>
        </div>
        <component
          :is="item.children ? 'button' : 'div'"
          v-for="item in currentItems"
          :key="item.title"
          :type="item.children ? 'button' : undefined"
          class="resource-row"
          :class="{
            'is-folder': item.children
          }"
          @click="item.children && openFolder(item)"
        >
          <span class="item-main">
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
            <span class="item-copy">
              <span class="item-title">{{ item.title }}</span>
              <span class="item-description">{{ item.description }}</span>
            </span>
          </span>
          <span class="item-type">{{
            item.archived ? '归档' : item.children ? '文件夹' : 'PDF'
          }}</span>
        </component>
      </div>
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
.resource-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 32px;
}
h1 {
  margin: 0;
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
}
.page-note {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.sample-note {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.folder-path {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 0 24px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.path-current {
  padding: 0 8px;
  color: var(--text-primary);
}
.section-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.section-heading h2 {
  margin: 0;
  font-size: var(--font-size);
  font-weight: var(--font-weight-semibold);
}
.section-heading > span {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.resource-list {
  border-top: 1px solid var(--border-subtle);
}
.list-heading,
.resource-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 100px;
  gap: 20px;
  align-items: center;
}
.list-heading {
  padding: 10px 16px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
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
.resource-row.is-folder {
  cursor: pointer;
}
.resource-row.is-folder:hover {
  background: var(--bg-hover);
}
.item-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
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
.item-type {
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
@media (max-width: 480px) {
  .resource-center {
    padding: 14px 16px 24px;
  }
  .list-heading,
  .resource-row {
    grid-template-columns: minmax(0, 1fr) 52px;
    gap: 8px;
    padding-left: 8px;
    padding-right: 8px;
  }
}
</style>
