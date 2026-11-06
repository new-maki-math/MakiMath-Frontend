<script setup>
import { ArrowLeft, ArrowRight, Copy, EditPencil, FolderPlus, Trash, Upload } from '@iconoir/vue';
import { computed, inject, onUnmounted, ref, watch } from 'vue';

import { resourceApi } from '../../api/resources.js';
import MButton from '../../components/MButton.vue';
import MDataView from '../../components/MDataView.vue';
import MEmpty from '../../components/MEmpty.vue';
import MFileTypeIcon from '../../components/MFileTypeIcon.vue';
import { authStatus, currentUser } from '../../utils/auth.js';
import ResourceManageDialog from './ResourceManageDialog.vue';
import ResourcePdfDialog from './ResourcePdfDialog.vue';
import ResourceUploadDialog from './ResourceUploadDialog.vue';
import { useResourceBrowser } from './useResourceBrowser.js';

const layout = inject('layoutState');
const {
  parentId,
  sort,
  order,
  offset,
  data,
  loading,
  error,
  isManager,
  pageSize,
  load,
  navigate,
  changeSort,
  goUp
} = useResourceBrowser(layout);
const managementAction = ref('');
const uploadOpen = ref(false);
const managementItem = ref(null);
const selectedPdf = ref(null);
const quota = ref(null);
const quotaError = ref(false);
let quotaSequence = 0;
let quotaController;
const actions = [
  {
    key: 'edit',
    label: '编辑',
    icon: EditPencil
  },
  {
    key: 'copy',
    label: '复制',
    icon: Copy
  },
  {
    key: 'move',
    label: '移动',
    icon: ArrowRight
  },
  {
    key: 'remove',
    label: '永久删除',
    icon: Trash
  }
];
const total = computed(() => data.value?.pagination?.total || 0);
const title = computed(() => data.value?.current?.name || '全部资源');
const formatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
function formatDate(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? formatter.format(time) : '—';
}
function showAction(action, item = null) {
  if (!isManager.value || item?.is_system) {
    return;
  }
  if (action === 'upload') {
    uploadOpen.value = true;
    return;
  }
  managementItem.value = item;
  managementAction.value = action;
}
function openItem(item) {
  if (item.kind === 'folder') {
    navigate(item.id);
    return;
  }
  if (item.kind !== 'pdf') {
    return;
  }
  selectedPdf.value = item;
}
async function refreshQuota() {
  const sequence = ++quotaSequence;
  quotaController?.abort();
  quota.value = null;
  quotaError.value = false;
  quotaController = new AbortController();
  try {
    const result = await resourceApi.quota({
      signal: quotaController.signal
    });
    if (sequence === quotaSequence) {
      if (
        typeof result?.unlimited !== 'boolean' ||
        (!result.unlimited &&
          (!Number.isFinite(result.used_bytes) || !Number.isFinite(result.limit_bytes)))
      ) {
        throw new Error('额度数据格式错误');
      }
      quota.value = result;
    }
  } catch (failure) {
    if (sequence === quotaSequence && failure.name !== 'AbortError') {
      quota.value = null;
      quotaError.value = true;
    }
  }
}
watch(
  [authStatus, () => currentUser.value?.id, () => currentUser.value?.role],
  () => {
    selectedPdf.value = null;
    managementAction.value = '';
    uploadOpen.value = false;
    managementItem.value = null;
    refreshQuota();
  },
  {
    immediate: true
  }
);
onUnmounted(() => {
  quotaSequence++;
  quotaController?.abort();
});
</script>

<template>
  <main class="resource-center">
    <section class="resource-section">
      <header class="section-heading">
        <MButton
          v-if="parentId !== null"
          variant="ghost"
          size="sm"
          icon-only
          title="上一级"
          aria-label="上一级"
          @click="goUp"
          ><ArrowLeft
            aria-hidden="true"
            width="16"
            height="16"
        /></MButton>
        <div class="section-title">
          <h2>{{ title }}</h2>
          <span v-if="data">{{ total }} 项</span>
        </div>
        <div class="heading-actions">
          <span
            v-if="quota && !quota.unlimited"
            class="quota"
            >{{
              `下载额度 ${(quota.used_bytes / 1024 / 1024).toFixed(1)} / ${(quota.limit_bytes / 1024 / 1024).toFixed(1)} MiB（最近 12 小时）`
            }}</span
          >
          <span
            v-else-if="quotaError"
            class="quota"
            >下载额度暂不可用</span
          >
          <template v-if="isManager">
            <MButton
              variant="ghost"
              size="sm"
              icon-only
              title="新建文件夹"
              aria-label="新建文件夹"
              @click="showAction('folder')"
              ><FolderPlus
                aria-hidden="true"
                width="18"
                height="18"
            /></MButton>
            <MButton
              variant="ghost"
              size="sm"
              icon-only
              title="上传 PDF"
              aria-label="上传 PDF"
              @click="showAction('upload')"
              ><Upload
                aria-hidden="true"
                width="18"
                height="18"
            /></MButton>
          </template>
        </div>
      </header>
      <MDataView
        :loading="loading"
        text="正在加载资源…"
        :content-key="`${parentId}:${sort}:${order}:${offset}`"
      >
        <p
          v-if="error"
          class="resource-error"
          role="alert"
        >
          {{ error }}
          <MButton
            size="sm"
            variant="ghost"
            @click="load"
            >重试</MButton
          >
        </p>
        <template v-else-if="data">
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
                  v-if="sort === 'name'"
                  aria-hidden="true"
                  >{{ order === 'asc' ? '↑' : '↓' }}</span
                ><span class="sr-only">{{
                  sort === 'name' ? (order === 'asc' ? '升序' : '降序') : ''
                }}</span>
              </button>
              <span>下载量</span>
              <button
                type="button"
                class="sort-button"
                @click="changeSort('updated_at')"
              >
                修改时间
                <span
                  v-if="sort === 'updated_at'"
                  aria-hidden="true"
                  >{{ order === 'asc' ? '↑' : '↓' }}</span
                ><span class="sr-only">{{
                  sort === 'updated_at' ? (order === 'asc' ? '升序' : '降序') : ''
                }}</span>
              </button>
            </div>
            <div
              v-for="item in data.items"
              :key="item.id"
              class="resource-row"
            >
              <button
                type="button"
                class="item-main"
                @click="openItem(item)"
              >
                <span class="item-icon">
                  <MFileTypeIcon :type="item.is_system ? 'archive' : item.kind" />
                </span>
                <span class="item-copy"
                  ><span class="item-title">{{ item.name }}</span
                  ><span
                    v-if="item.description"
                    class="item-description"
                    >{{ item.description }}</span
                  ></span
                >
              </button>
              <span class="item-downloads">{{
                item.kind === 'pdf' &&
                Number.isSafeInteger(item.download_count) &&
                item.download_count >= 0
                  ? item.download_count.toLocaleString()
                  : '—'
              }}</span>
              <time
                class="item-date"
                :datetime="item.updated_at"
                >{{ formatDate(item.updated_at) }}</time
              >
              <div
                v-if="isManager && !item.is_system"
                class="row-actions"
              >
                <MButton
                  v-if="item.kind === 'pdf'"
                  variant="ghost"
                  size="sm"
                  icon-only
                  title="替换 PDF"
                  :aria-label="`替换 ${item.name}`"
                  @click="showAction('replace', item)"
                  ><Upload
                    width="16"
                    height="16"
                    aria-hidden="true"
                /></MButton>
                <MButton
                  v-for="action in actions"
                  :key="action.key"
                  variant="ghost"
                  size="sm"
                  icon-only
                  :title="action.label"
                  :aria-label="`${action.label} ${item.name}`"
                  @click="showAction(action.key, item)"
                  ><component
                    :is="action.icon"
                    aria-hidden="true"
                    width="16"
                    height="16"
                /></MButton>
              </div>
            </div>
          </div>
          <MEmpty
            v-if="!data.items.length"
            description="暂无资源"
          />
          <div
            v-if="total > pageSize"
            class="pagination"
          >
            <MButton
              variant="ghost"
              size="sm"
              :disabled="offset === 0"
              @click="offset = Math.max(0, offset - pageSize)"
              >上一页</MButton
            >
            <span>{{ Math.floor(offset / pageSize) + 1 }} / {{ Math.ceil(total / pageSize) }}</span>
            <MButton
              variant="ghost"
              size="sm"
              :disabled="offset + pageSize >= total"
              @click="offset += pageSize"
              >下一页</MButton
            >
          </div>
        </template>
      </MDataView>
    </section>
    <ResourceManageDialog
      :action="managementAction"
      :item="managementItem"
      :parent-id="parentId"
      @close="managementAction = ''"
      @changed="load"
    />
    <ResourceUploadDialog
      :open="uploadOpen"
      :parent-id="parentId"
      @close="uploadOpen = false"
      @changed="load"
    />
    <ResourcePdfDialog
      :resource="selectedPdf"
      @close="selectedPdf = null"
      @quota-change="refreshQuota"
      @downloaded="load"
    />
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
.section-title > span,
.quota {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.heading-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.resource-list {
  border-top: 1px solid var(--border-subtle);
}
.list-heading,
.resource-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 80px 150px;
  gap: 20px;
  align-items: center;
}
.has-actions .list-heading,
.has-actions .resource-row {
  grid-template-columns: minmax(0, 1fr) 80px 150px 168px;
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
.resource-row:hover {
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
.item-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
}
.item-icon svg {
  width: 26px;
  height: 26px;
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
.item-description,
.item-downloads,
.item-date {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  line-height: 1.4;
}
.row-actions {
  display: flex;
  justify-content: flex-end;
  visibility: hidden;
}
.resource-row:hover .row-actions,
.resource-row:focus-within .row-actions {
  visibility: visible;
}
.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.resource-error {
  color: var(--tag-red);
}
@media (max-width: 700px) {
  .resource-center {
    padding: 14px 16px 24px;
  }
  .list-heading,
  .resource-row,
  .has-actions .list-heading,
  .has-actions .resource-row {
    grid-template-columns: minmax(0, 1fr) 55px 130px;
    gap: 8px;
    padding-left: 8px;
    padding-right: 8px;
  }
  .row-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
    visibility: visible;
  }
}
</style>
