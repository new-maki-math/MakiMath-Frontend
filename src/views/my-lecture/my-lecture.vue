<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Bookmark,
  BookmarkSolid,
  Trash,
  NavArrowUp,
  NavArrowDown,
  Plus,
  List,
  Printer,
  Compass,
  ArrowRight
} from '@iconoir/vue';
import {
  openDB,
  getNotebooks,
  createNotebook,
  getNotebookItems,
  removeNotebookItem,
  clearNotebook,
  reorderNotebookItems,
  DEFAULT_NOTEBOOK_ID
} from '../../utils/my-lecture-db.js';
import { getCourseSectionContent } from '../../api';
import { extractItemSlice, assembleVirtualDoc } from '../../utils/my-lecture-slice.js';
import { notify } from '../../components/MNotice.vue';
import TypstDoc from '../../components/TypstDoc.vue';
import MButton from '../../components/MButton.vue';
import MTag from '../../components/MTag.vue';
import MModal from '../../components/MModal.vue';
import MInput from '../../components/MInput.vue';
import MDrawer from '../../components/MDrawer.vue';
import MLoadingMask from '../../components/MLoadingMask.vue';

const router = useRouter();

// 笔记本与条目状态
const notebooks = ref([]);
const activeNotebookId = ref(DEFAULT_NOTEBOOK_ID);
const rawItems = ref([]);
const activeFilter = ref('all'); // 'all' | 'card' | 'outline' | 'section'
const isLoading = ref(true);
const isAssembling = ref(false);

// 拼装虚拟文档
const virtualDoc = ref(null);
const isMounted = ref(false);

// 模态框与抽屉状态
const isNewNotebookModalOpen = ref(false);
const newNotebookTitle = ref('');
const isClearConfirmModalOpen = ref(false);
const isMobileDrawerOpen = ref(false);

// 缓存已拉取的小节内容，避免对同一小节重复网络请求
const sectionContentCache = new Map();

// 条目卡片所显示的 TAG：直接使用小节标题（若本身为整节则标为小节）
const getItemTag = (item) => {
  if (item.scope === 'section') {
    return '小节';
  }
  return item.sectionTitle || '小节';
};

// 当前笔记本对象
const currentNotebook = computed(() => {
  return notebooks.value.find((nb) => nb.id === activeNotebookId.value) || {
    id: DEFAULT_NOTEBOOK_ID,
    title: '我的默认讲义',
    description: '系统默认自定义知识考点与真题合集'
  };
});

// 根据选项卡过滤后的条目（全部 | 小节 | 卡片）
const filteredItems = computed(() => {
  if (activeFilter.value === 'all') return rawItems.value;
  if (activeFilter.value === 'section') {
    return rawItems.value.filter((it) => it.scope === 'section' || it.scope === 'outline');
  }
  if (activeFilter.value === 'card') {
    return rawItems.value.filter((it) => it.scope === 'card');
  }
  return rawItems.value;
});

// 统计各类型数量（全部、小节、卡片）
const stats = computed(() => {
  const all = rawItems.value.length;
  const sections = rawItems.value.filter((it) => it.scope === 'section' || it.scope === 'outline').length;
  const cards = rawItems.value.filter((it) => it.scope === 'card').length;
  return { all, sections, cards };
});

// 切换选项卡并同步更新右侧内容
const handleSelectFilter = (key) => {
  if (activeFilter.value === key) return;
  activeFilter.value = key;
  assembleDocument();
};

// 加载笔记本列表
const loadNotebooks = async () => {
  try {
    notebooks.value = await getNotebooks();
  } catch (err) {
    console.error('[MyLecture] 加载笔记本列表失败:', err);
  }
};

// 加载当前笔记本条目并触发拼装
const loadItemsAndAssemble = async () => {
  isLoading.value = true;
  isAssembling.value = true;
  try {
    rawItems.value = await getNotebookItems(activeNotebookId.value);
    await assembleDocument();
  } catch (err) {
    console.error('[MyLecture] 读取讲义条目失败:', err);
    notify.error('读取自定义讲义失败');
  } finally {
    isLoading.value = false;
    isAssembling.value = false;
  }
};

// 拼装文档核心逻辑（支持按选项卡动态筛选并联动右侧渲染）
const assembleDocument = async () => {
  const targetItems = filteredItems.value;
  if (!targetItems || targetItems.length === 0) {
    virtualDoc.value = null;
    return;
  }

  const slices = [];

  for (const item of targetItems) {
    const cId = item.courseId || '1';
    const sId = item.sectionId;
    const cacheKey = `${cId}:${sId}`;

    let sectionData = sectionContentCache.get(cacheKey);
    if (!sectionData) {
      try {
        sectionData = await getCourseSectionContent(cId, sId);
        sectionContentCache.set(cacheKey, sectionData);
      } catch (err) {
        console.warn(`[MyLecture] 获取小节 ${cacheKey} 失败:`, err);
        continue;
      }
    }

    if (sectionData && sectionData.doc) {
      const nodes = extractItemSlice(sectionData.doc, item);
      slices.push({ item, nodes });
    }
  }

  virtualDoc.value = assembleVirtualDoc(slices);
};

// 切换笔记本
const handleSwitchNotebook = (nbId) => {
  if (nbId === activeNotebookId.value) return;
  activeNotebookId.value = nbId;
  loadItemsAndAssemble();
};

// 新建笔记本
const handleCreateNotebook = async () => {
  const title = newNotebookTitle.value.trim();
  if (!title) {
    notify.warn('请输入讲义册名称');
    return;
  }
  try {
    const nb = await createNotebook(title);
    newNotebookTitle.value = '';
    isNewNotebookModalOpen.value = false;
    await loadNotebooks();
    handleSwitchNotebook(nb.id);
    notify.success(`已创建讲义册《${nb.title}》`);
  } catch (err) {
    notify.error('创建讲义册失败');
  }
};

// 移除单个条目
const handleRemoveItem = async (itemId, title) => {
  try {
    await removeNotebookItem(itemId);
    rawItems.value = rawItems.value.filter((it) => it.id !== itemId);
    await assembleDocument();
    notify.info(`已移出《${title || '条目'}》`);
  } catch (err) {
    notify.error('移出条目失败');
  }
};

// 清空当前讲义册
const handleClearAll = async () => {
  try {
    await clearNotebook(activeNotebookId.value);
    rawItems.value = [];
    virtualDoc.value = null;
    isClearConfirmModalOpen.value = false;
    notify.info('已清空当前讲义册');
  } catch (err) {
    notify.error('清空失败');
  }
};

// 调整顺序：上移
const handleMoveUp = async (index) => {
  if (index <= 0) return;
  const list = [...rawItems.value];
  const temp = list[index - 1];
  list[index - 1] = list[index];
  list[index] = temp;
  rawItems.value = list;

  await reorderNotebookItems(activeNotebookId.value, list.map((it) => it.id));
  await assembleDocument();
};

// 调整顺序：下移
const handleMoveDown = async (index) => {
  if (index >= rawItems.value.length - 1) return;
  const list = [...rawItems.value];
  const temp = list[index + 1];
  list[index + 1] = list[index];
  list[index] = temp;
  rawItems.value = list;

  await reorderNotebookItems(activeNotebookId.value, list.map((it) => it.id));
  await assembleDocument();
};

// 打印 / 导出讲义
const handlePrint = () => {
  if (rawItems.value.length === 0) {
    notify.warn('当前讲义暂无内容可供导出');
    return;
  }
  window.print();
};

// 跳转官方讲义库挑选
const handleBrowseOfficial = () => {
  router.push('/course/1');
};

// 滚动定位到指定条目
const scrollToItem = (index) => {
  if (isMobileDrawerOpen.value) {
    isMobileDrawerOpen.value = false;
  }
  const banners = document.querySelectorAll('.td-slice-meta-banner');
  if (banners[index]) {
    banners[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

onMounted(async () => {
  isMounted.value = true;
  await openDB();
  await loadNotebooks();
  await loadItemsAndAssemble();
});
</script>

<template>
  <div class="my-lecture-page">
    <!-- 传送至 ViewportHeader 左侧扩展区 (讲义册选择与新建) -->
    <Teleport v-if="isMounted" to="#viewport-header-extra">
      <div class="my-lecture-header-left">
        <div class="notebook-select-wrap">
          <select
            class="notebook-selector font-mono"
            :value="activeNotebookId"
            @change="handleSwitchNotebook($event.target.value)"
          >
            <option
              v-for="nb in notebooks"
              :key="nb.id"
              :value="nb.id"
            >
              {{ nb.title }}
            </option>
          </select>
          <button
            type="button"
            class="new-nb-btn font-mono"
            title="新建讲义册"
            @click="isNewNotebookModalOpen = true"
          >
            <Plus width="12" height="12" />
            <span>新建册</span>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 传送至 ViewportHeader 右侧操作栏 (移动端清单抽屉、打印/导出、清空) -->
    <Teleport v-if="isMounted" to="#viewport-header-actions">
      <div class="my-lecture-header-actions">
        <!-- 移动端管理抽屉入口 -->
        <button
          type="button"
          class="mobile-drawer-btn font-mono"
          @click="isMobileDrawerOpen = true"
        >
          <List width="13" height="13" />
          <span>条目清单 ({{ rawItems.length }})</span>
        </button>

        <MButton
          variant="secondary"
          size="sm"
          :mono="true"
          title="打印或另存为 PDF"
          :disabled="rawItems.length === 0"
          @click="handlePrint"
        >
          <template #icon>
            <Printer width="13" height="13" />
          </template>
          <span>打印 / 导出</span>
        </MButton>

        <MButton
          v-if="rawItems.length > 0"
          variant="danger"
          size="sm"
          :mono="true"
          title="清空当前讲义"
          @click="isClearConfirmModalOpen = true"
        >
          <template #icon>
            <Trash width="13" height="13" />
          </template>
          <span>清空</span>
        </MButton>
      </div>
    </Teleport>

    <!-- 主体分栏工作台：左侧条目管理 + 右侧虚拟文档渲染 -->
    <div class="workspace-body">
      <!-- 左侧：装订与目录面板 (仅桌面端常驻展示) -->
      <aside class="sidebar-panel">
        <div class="sidebar-head">
          <div class="sidebar-title font-mono">
            <span>BINDER // 装订目录</span>
            <span class="item-count font-mono">{{ rawItems.length }} 项</span>
          </div>

          <!-- 过滤器 Tab 栏（选项卡） -->
          <div class="filter-tabs font-mono">
            <button
              type="button"
              class="tab-btn"
              :class="{ 'is-active': activeFilter === 'all' }"
              @click="handleSelectFilter('all')"
            >
              全部 ({{ stats.all }})
            </button>
            <button
              type="button"
              class="tab-btn"
              :class="{ 'is-active': activeFilter === 'section' }"
              @click="handleSelectFilter('section')"
            >
              小节 ({{ stats.sections }})
            </button>
            <button
              type="button"
              class="tab-btn"
              :class="{ 'is-active': activeFilter === 'card' }"
              @click="handleSelectFilter('card')"
            >
              卡片 ({{ stats.cards }})
            </button>
          </div>
        </div>

        <!-- 目录列表区域 -->
        <div class="sidebar-items-scroll">
          <div v-if="filteredItems.length === 0" class="empty-filter-state font-mono">
            <span>当前筛选条件下暂无条目</span>
          </div>

          <div
            v-for="(item, idx) in filteredItems"
            :key="item.id"
            class="binder-item-card"
            @click="scrollToItem(idx)"
          >
            <div class="item-card-row">
              <div class="item-card-main">
                <span class="item-tag font-mono">
                  {{ getItemTag(item) }}
                </span>
                <span class="item-card-title" :title="item.title">
                  {{ item.title }}
                </span>
              </div>

              <div class="item-card-actions">
                <button
                  type="button"
                  class="action-btn"
                  title="上移"
                  :disabled="idx === 0"
                  @click.stop="handleMoveUp(idx)"
                >
                  <NavArrowUp width="12" height="12" />
                </button>
                <button
                  type="button"
                  class="action-btn"
                  title="下移"
                  :disabled="idx === filteredItems.length - 1"
                  @click.stop="handleMoveDown(idx)"
                >
                  <NavArrowDown width="12" height="12" />
                </button>
                <button
                  type="button"
                  class="action-btn is-del"
                  title="移出讲义"
                  @click.stop="handleRemoveItem(item.id, item.title)"
                >
                  <Trash width="12" height="12" />
                </button>
              </div>
            </div>

            <div class="item-card-source font-mono">
              《{{ item.courseTitle }}》
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧：无缝装订虚拟文档渲染区 -->
      <main class="document-viewport">
        <!-- 暂无收藏为空状态 -->
        <div v-if="!isLoading && (!virtualDoc || virtualDoc.children.length === 0)" class="empty-viewport font-mono">
          <div class="empty-card">
            <span class="empty-tag">NOTEBOOK EMPTY // 讲义册为空</span>
            <h2 class="empty-title">尚未挑选任何考点或真题</h2>
            <p class="empty-desc">
              在阅读官方讲义时，点击任意考点大纲节或真题/知识盒卡片右上角的
              <span class="highlight-action">[+ 讲义]</span>，即可按需拼装属于你的专属讲义。
            </p>
            <div class="empty-actions">
              <MButton
                variant="primary"
                size="md"
                :mono="true"
                @click="handleBrowseOfficial"
              >
                <template #icon>
                  <Compass width="15" height="15" />
                </template>
                <span>前往讲义库开始挑选 // BROWSE</span>
              </MButton>
            </div>
          </div>
        </div>

        <!-- 正式拼装讲义文档展示 -->
        <div v-else class="assembled-doc-wrap">
          <article class="markdown-article">
            <!-- 讲义卷首题注 -->
            <header class="assembled-header">
              <div class="assembled-kicker font-mono">
                <span>MAKIMATH ASSEMBLED COMPILATION</span>
                <span>/</span>
                <span>{{ currentNotebook.title }}</span>
              </div>
              <h1 class="assembled-title">{{ currentNotebook.title }}</h1>
              <p class="assembled-meta font-mono">
                共装订收录 {{ stats.all }} 项知识单元（含 {{ stats.cards }} 道典型真题/核心定义，{{ stats.outlines }} 个重点考点大纲）
              </p>
            </header>

            <!-- 核心渲染组件：TypstDoc -->
            <TypstDoc
              v-if="virtualDoc"
              :doc="virtualDoc"
            />
          </article>
        </div>

        <!-- 仅针对内容区域的内容拼装加载遮罩 -->
        <MLoadingMask :visible="isLoading" text="正在拼装自定义讲义..." />
      </main>
    </div>

    <!-- 移动端管理抽屉 -->
    <MDrawer
      :open="isMobileDrawerOpen"
      placement="left"
      title="BINDER // 条目管理"
      width="300px"
      @close="isMobileDrawerOpen = false"
    >
      <div class="mobile-drawer-body">
        <div class="mobile-items-list">
          <div
            v-for="(item, idx) in filteredItems"
            :key="item.id"
            class="mobile-item-card"
            @click="scrollToItem(idx)"
          >
            <div class="item-card-row">
              <div class="item-card-main">
                <span class="item-tag font-mono">
                  {{ getItemTag(item) }}
                </span>
                <span class="item-card-title">{{ item.title }}</span>
              </div>
              <button
                type="button"
                class="action-btn is-del"
                title="移出讲义"
                @click.stop="handleRemoveItem(item.id, item.title)"
              >
                <Trash width="12" height="12" />
              </button>
            </div>
            <div class="item-card-source font-mono">
              《{{ item.courseTitle }}》
            </div>
          </div>
        </div>
      </div>
    </MDrawer>

    <!-- 新建讲义册弹窗 -->
    <MModal
      :open="isNewNotebookModalOpen"
      title="新建自定义讲义册"
      confirm-text="创建讲义册"
      cancel-text="取消"
      @close="isNewNotebookModalOpen = false"
      @confirm="handleCreateNotebook"
    >
      <div class="modal-body-content">
        <label class="modal-label font-mono">讲义册标题 (NOTEBOOK TITLE)</label>
        <MInput
          v-model="newNotebookTitle"
          placeholder="例如：高等数学历年真题分类集"
          :auto-focus="true"
        />
      </div>
    </MModal>

    <!-- 清空讲义册确认弹窗 -->
    <MModal
      :open="isClearConfirmModalOpen"
      title="清空当前讲义确认"
      confirm-text="确认清空"
      cancel-text="取消"
      confirm-variant="danger"
      @close="isClearConfirmModalOpen = false"
      @confirm="handleClearAll"
    >
      <p class="confirm-text">
        确定要清空讲义册《<strong>{{ currentNotebook.title }}</strong>》内的全部 {{ rawItems.length }} 个收录节点吗？此操作仅在本地生效且无法撤销。
      </p>
    </MModal>
  </div>
</template>

<style scoped>
.my-lecture-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: var(--bg-app, #121212);
  color: var(--text-primary, #e0e0e0);
  overflow: hidden;
  box-sizing: border-box;
}

/* 顶部合并控制项 (挂载至 ViewportHeader) */
.my-lecture-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.notebook-select-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.notebook-selector {
  height: 26px;
  padding: 0 8px;
  background-color: var(--bg-surface, #1e1e1e);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: var(--radius-xs, 2px);
  color: var(--text-primary, #e0e0e0);
  font-size: 11.5px;
  max-width: 180px;
  outline: none;
  cursor: pointer;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notebook-selector:focus {
  border-color: var(--accent-primary, #38bdf8);
}

.new-nb-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 7px;
  background: transparent;
  border: 1px dashed var(--border-subtle, rgba(255, 255, 255, 0.15));
  border-radius: var(--radius-xs, 2px);
  color: var(--text-muted, #808080);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 120ms ease;
}

.new-nb-btn:hover {
  background-color: var(--bg-hover, #2c2c2c);
  color: var(--text-primary, #ffffff);
  border-color: var(--border-hover, rgba(255, 255, 255, 0.3));
}

.my-lecture-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-drawer-btn {
  display: none;
}

/* 工作台主体 */
.workspace-body {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
}

/* 左侧装订目录面板 */
.sidebar-panel {
  width: 320px;
  min-width: 320px;
  background-color: var(--bg-sidebar, #181818);
  border-right: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  user-select: none;
}

.sidebar-head {
  padding: 16px 14px 12px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.sidebar-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.8px;
  color: var(--text-muted, #808080);
  margin-bottom: 12px;
}

.item-count {
  padding: 1px 6px;
  background-color: var(--bg-elevated, #282828);
  border-radius: 2px;
  color: var(--accent-primary, #38bdf8);
  font-size: 10.5px;
}

/* 过滤 Tab */
.filter-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--bg-app, #121212);
  padding: 3px;
  border-radius: var(--radius-xs, 2px);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.tab-btn {
  flex: 1;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--text-muted, #808080);
  font-size: 11px;
  cursor: pointer;
  border-radius: 2px;
  transition: all 120ms ease;
  white-space: nowrap;
}

.tab-btn:hover {
  color: var(--text-primary, #ffffff);
}

.tab-btn.is-active {
  background-color: var(--bg-elevated, #282828);
  color: var(--accent-primary, #38bdf8);
  font-weight: 500;
}

/* 列表滚动区 */
.sidebar-items-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-filter-state {
  padding: 32px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted, #707070);
}

/* 条目卡片 (微圆角、纯色填充、深灰分阶) */
.binder-item-card {
  padding: 8px 10px;
  background-color: var(--bg-surface, #202020);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-xs, 2px);
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.binder-item-card:hover {
  background-color: var(--bg-hover, #282828);
  border-color: var(--border-hover, rgba(255, 255, 255, 0.16));
}

.item-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.item-card-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.item-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 10.5px;
  font-weight: 600;
  border-radius: var(--radius-xs, 2px);
  background-color: var(--bg-elevated, #2a2a2a);
  color: var(--accent-primary, #38bdf8);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-card-title {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

/* 右侧操作按钮：平时隐藏，鼠标悬浮在卡片上时显示 */
.item-card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
  flex-shrink: 0;
}

.binder-item-card:hover .item-card-actions {
  opacity: 1;
  pointer-events: auto;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  color: var(--text-muted, #808080);
  border-radius: var(--radius-xs, 2px);
  cursor: pointer;
  transition: color 100ms ease, background-color 100ms ease;
}

.action-btn:hover:not(:disabled) {
  background-color: var(--bg-elevated, #333333);
  color: var(--text-primary, #ffffff);
}

.action-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.action-btn.is-del:hover {
  color: #ef4444;
}

.item-card-source {
  font-size: 11px;
  color: var(--text-muted, #707070);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 右侧文档展示视口 */
.document-viewport {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  background-color: var(--bg-app, #121212);
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 空状态卡片 */
.empty-viewport {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.empty-card {
  max-width: 480px;
  padding: 32px 28px;
  background-color: var(--bg-surface, #1e1e1e);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-xs, 2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
}

.empty-tag {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--accent-primary, #38bdf8);
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #ffffff);
  margin: 0;
}

.empty-desc {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-muted, #808080);
  margin: 0;
}

.highlight-action {
  color: var(--accent-primary, #38bdf8);
  font-weight: 600;
}

.empty-actions {
  margin-top: 10px;
}

/* 拼装文档主体容器 */
.assembled-doc-wrap {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: 36px 32px 80px;
  box-sizing: border-box;
}

.assembled-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
}

.assembled-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted, #808080);
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.assembled-title {
  font-size: clamp(24px, 4vw, 32px);
  font-weight: 700;
  color: var(--text-primary, #ffffff);
  margin: 0 0 10px 0;
  letter-spacing: -0.3px;
}

.assembled-meta {
  font-size: 12.5px;
  color: var(--text-muted, #808080);
  margin: 0;
}

/* 模态框样式 */
.modal-body-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.modal-label {
  font-size: 11.5px;
  color: var(--text-muted, #808080);
  letter-spacing: 0.5px;
}

.confirm-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary, #cccccc);
  margin: 0;
}

/* 移动端抽屉内样式 */
.mobile-drawer-body {
  padding: 12px;
}

.mobile-items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-item-card {
  padding: 10px 12px;
  background-color: var(--bg-surface, #202020);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-xs, 2px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 移动端响应式断点 (<768px) */
@media (max-width: 768px) {
  .sidebar-panel {
    display: none;
  }

  .notebook-selector {
    max-width: 110px;
  }

  .new-nb-btn span {
    display: none;
  }

  .mobile-drawer-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 7px;
    background-color: var(--bg-elevated, #282828);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-xs, 2px);
    color: var(--text-secondary, #cccccc);
    font-size: 11px;
    cursor: pointer;
  }

  .assembled-doc-wrap {
    padding: 20px 14px 60px;
  }
}

/* 打印模式优化 */
@media print {
  .my-lecture-header-left,
  .my-lecture-header-actions,
  .sidebar-panel,
  .mobile-drawer-btn {
    display: none !important;
  }

  .my-lecture-page,
  .workspace-body,
  .document-viewport,
  .assembled-doc-wrap {
    background: #ffffff !important;
    color: #000000 !important;
    height: auto !important;
    overflow: visible !important;
    padding: 0 !important;
    max-width: 100% !important;
  }

  .assembled-title {
    color: #000000 !important;
  }

  .td-slice-meta-banner {
    border-left-color: #000000 !important;
    background: transparent !important;
    color: #333333 !important;
  }
}
</style>
