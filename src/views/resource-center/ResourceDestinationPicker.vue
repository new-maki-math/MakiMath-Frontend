<script setup>
import { onUnmounted, ref, watch } from 'vue';

import { resourceApi } from '../../api/resources.js';
import MFileTypeIcon from '../../components/display/MFileTypeIcon.vue';
import MPagination from '../../components/display/MPagination.vue';
import MDataView from '../../components/feedback/MDataView.vue';
import MButton from '../../components/form/MButton.vue';
import { ArrowLeft, NavArrowRight } from '../../components/icons/icons.js';

const props = defineProps({
  open: Boolean,
  disabled: Boolean,
  forbiddenId: {
    type: [Number, String],
    default: null
  }
});
const emit = defineEmits(['select', 'loading']);
const parentId = ref(null);
const current = ref(null);
const breadcrumbs = ref([]);
const folders = ref([]);
const offset = ref(0);
const total = ref(0);
const busy = ref(false);
const error = ref('');
let sequence = 0;
let controller;

async function load() {
  emit('loading', true);
  emit('select', undefined);
  const currentSequence = ++sequence;
  controller?.abort();
  controller = new AbortController();
  folders.value = [];
  busy.value = true;
  error.value = '';
  const params = {
    sort: 'name',
    order: 'asc',
    limit: 50,
    offset: offset.value
  };
  if (parentId.value !== null) {
    params.parent_id = parentId.value;
  }
  try {
    const result = await resourceApi.list(params, {
      signal: controller.signal
    });
    if (currentSequence !== sequence) {
      return;
    }
    if (
      !Array.isArray(result?.items) ||
      !Array.isArray(result.breadcrumbs) ||
      !Number.isSafeInteger(result.pagination?.total)
    ) {
      throw new Error('目录数据格式错误');
    }
    current.value = result.current;
    breadcrumbs.value = result.breadcrumbs;
    total.value = result.pagination.total;
    folders.value = result.items.filter(
      (item) => item.kind === 'folder' && item.id !== props.forbiddenId
    );
    emit('select', parentId.value);
  } catch (failure) {
    if (currentSequence === sequence && failure.name !== 'AbortError') {
      error.value = failure.message || '目录加载失败';
    }
  } finally {
    if (currentSequence === sequence) {
      busy.value = false;
      emit('loading', false);
    }
  }
}
function navigate(id) {
  if (busy.value || props.disabled) {
    return;
  }
  if (id === null) {
    current.value = null;
    breadcrumbs.value = [];
  } else {
    const index = breadcrumbs.value.findIndex((crumb) => crumb.id === id);
    const folder = folders.value.find((entry) => entry.id === id);
    if (index !== -1) {
      breadcrumbs.value = breadcrumbs.value.slice(0, index + 1);
      current.value = breadcrumbs.value[index];
    } else if (folder) {
      current.value = folder;
      breadcrumbs.value = [
        ...breadcrumbs.value,
        {
          id: folder.id,
          name: folder.name
        }
      ];
    }
  }
  parentId.value = id;
  offset.value = 0;
}
function goUp() {
  const parent = breadcrumbs.value.at(-2);
  navigate(parent?.id ?? null);
}
watch(
  () => props.open,
  (open) => {
    if (open) {
      parentId.value = null;
      current.value = null;
      breadcrumbs.value = [];
      offset.value = 0;
      load();
    } else {
      sequence++;
      controller?.abort();
    }
  },
  {
    immediate: true
  }
);
watch([parentId, offset], () => {
  if (props.open) {
    load();
  }
});
onUnmounted(() => {
  sequence++;
  controller?.abort();
});
</script>

<template>
  <div class="destination-field">
    <div
      class="destination-current"
      :aria-busy="busy"
    >
      <span>当前目标</span>
      <strong>{{ error ? '目录加载失败' : current?.name || '资源中心' }}</strong>
    </div>
    <span class="destination-label">选择目标文件夹</span>
    <div class="destination-picker">
      <div class="destination-heading">
        <MButton
          v-if="parentId !== null"
          variant="ghost"
          size="sm"
          icon-only
          title="上一级"
          aria-label="上一级"
          :disabled="busy || disabled"
          :class="{
            'loading-action': busy && !disabled
          }"
          @click="goUp"
          ><ArrowLeft
            width="16"
            height="16"
            aria-hidden="true"
        /></MButton>
        <nav
          class="destination-path"
          aria-label="目标目录路径"
        >
          <button
            type="button"
            :disabled="busy || disabled || parentId === null"
            @click="navigate(null)"
          >
            资源中心
          </button>
          <template
            v-for="crumb in breadcrumbs"
            :key="crumb.id"
          >
            <NavArrowRight
              width="14"
              height="14"
              aria-hidden="true"
            />
            <button
              type="button"
              :disabled="busy || disabled || crumb.id === parentId"
              @click="navigate(crumb.id)"
            >
              {{ crumb.name }}
            </button>
          </template>
        </nav>
      </div>
      <div
        class="destination-list"
        aria-label="子文件夹列表"
      >
        <MDataView
          :loading="busy"
          text="正在读取目录…"
          :content-key="`${parentId}:${offset}`"
        >
          <p
            v-if="error"
            class="destination-note"
            role="alert"
          >
            {{ error }}
            <MButton
              variant="ghost"
              size="sm"
              @click="load"
              >重试</MButton
            >
          </p>
          <template v-else>
            <button
              v-for="folder in folders"
              :key="folder.id"
              type="button"
              class="destination-folder"
              :disabled="disabled"
              @click="navigate(folder.id)"
            >
              <MFileTypeIcon :type="folder.is_system ? 'archive' : 'folder'" />
              <span>{{ folder.name }}</span>
              <NavArrowRight
                class="folder-arrow"
                width="16"
                height="16"
                aria-hidden="true"
              />
            </button>
            <p
              v-if="!folders.length"
              class="destination-note"
            >
              {{ total > 50 ? '本页没有可选择的文件夹，可翻页查看' : '没有可选择的子文件夹' }}
            </p>
          </template>
        </MDataView>
      </div>
      <MPagination
        v-if="!error && total > 50"
        class="destination-pages"
        compact
        :page="Math.floor(offset / 50) + 1"
        :page-size="50"
        :total="total"
        :disabled="busy || disabled"
        @update:page="offset = ($event - 1) * 50"
      />
    </div>
  </div>
</template>

<style scoped>
.loading-action:disabled {
  opacity: 1;
}
.destination-field {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  gap: 8px;
}
.destination-picker {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow: hidden;
}
.destination-heading {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 40px;
  padding: 4px 12px;
}
.destination-label {
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.destination-path {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 8px 0;
  overflow-x: auto;
  color: var(--text-muted);
  white-space: nowrap;
  font-size: var(--font-size-smaller);
}
.destination-path button {
  flex: none;
  color: var(--text-secondary);
}
.destination-path button:not(:disabled):hover {
  color: var(--accent-primary);
}
.destination-path button:disabled:last-child {
  color: var(--text-primary);
}
.destination-path svg {
  flex: none;
}
.destination-current {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.destination-current strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.destination-folder > svg:first-child {
  flex: none;
  width: 24px;
  height: 24px;
}
.destination-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.destination-list :deep(.data-loading) {
  padding: 20px 12px;
}
.destination-folder {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  color: var(--text-primary);
  text-align: left;
}
.destination-folder:hover:not(:disabled) {
  background: var(--bg-hover);
}
.destination-folder span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.folder-arrow {
  flex: none;
  color: var(--text-muted);
}
.destination-note {
  margin: 0;
  padding: 20px 12px;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.destination-pages {
  flex: none;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
@media (max-width: 700px) {
  .destination-heading {
    padding: 4px 8px;
  }
  .destination-heading :deep(.is-icon-only) {
    width: 40px;
    height: 40px;
    flex: none;
  }
  .destination-path button {
    min-height: 40px;
  }
  .destination-folder {
    min-height: 48px;
  }
  .destination-pages :deep(.m-button) {
    min-height: 40px;
  }
}
</style>
