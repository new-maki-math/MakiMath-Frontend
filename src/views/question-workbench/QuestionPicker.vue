<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';

import { questionApi } from '../../api/questions.js';
import { ArrowLeft, NavArrowRight, Page } from '../../components/icons/icons.js';
import MButton from '../../components/form/MButton.vue';
import MDataView from '../../components/feedback/MDataView.vue';
import MEmpty from '../../components/feedback/MEmpty.vue';
import MFileTypeIcon from '../../components/display/MFileTypeIcon.vue';
import MPagination from '../../components/display/MPagination.vue';

const props = defineProps({
  open: Boolean,
  modelValue: {
    type: String,
    default: ''
  },
  disabled: Boolean
});
const emit = defineEmits(['update:modelValue']);
const categoryId = ref(null);
const offset = ref(0);
const data = ref(null);
const loading = ref(false);
const error = ref('');
let sequence = 0;
let controller;
async function load() {
  const current = ++sequence;
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  error.value = '';
  try {
    const result =
      categoryId.value === 'orphaned'
        ? await questionApi.orphaned(
            {
              limit: 50,
              offset: offset.value
            },
            {
              signal: controller.signal
            }
          )
        : await questionApi.entries(
            {
              category_id: categoryId.value,
              limit: 50,
              offset: offset.value
            },
            {
              signal: controller.signal
            }
          );
    if (categoryId.value === 'orphaned') {
      result.children = [];
      result.breadcrumbs = [
        {
          id: 'orphaned',
          name: '无来源题目'
        }
      ];
    }
    if (current !== sequence) {
      return;
    }
    if (
      !Array.isArray(result?.breadcrumbs) ||
      !Array.isArray(result?.children) ||
      !Array.isArray(result?.items) ||
      !Number.isSafeInteger(result?.pagination?.total)
    ) {
      throw new Error('题目列表格式错误');
    }
    data.value = result;
  } catch (failure) {
    if (current === sequence && failure.name !== 'AbortError') {
      error.value = '题目列表加载失败';
    }
  } finally {
    if (current === sequence) {
      loading.value = false;
    }
  }
}
function navigate(id) {
  if (loading.value || props.disabled || id === categoryId.value) {
    return;
  }
  categoryId.value = id;
  offset.value = 0;
}
watch(
  () => props.open,
  (open) => {
    sequence++;
    controller?.abort();
    if (open) {
      categoryId.value = null;
      offset.value = 0;
      data.value = null;
      load();
    }
  },
  {
    immediate: true
  }
);
watch([categoryId, offset], () => {
  if (props.open) {
    load();
  }
});
onBeforeUnmount(() => {
  sequence++;
  controller?.abort();
});
</script>

<template>
  <div class="picker">
    <div class="selected">
      <span>已选择</span><strong>{{ modelValue || '请选择题目' }}</strong>
    </div>
    <span class="label">选择题目</span>
    <div class="container">
      <div class="heading">
        <MButton
          v-if="categoryId !== null"
          variant="ghost"
          size="sm"
          icon-only
          title="上一级"
          aria-label="上一级"
          :disabled="disabled || loading"
          @click="navigate(data?.breadcrumbs?.at(-2)?.id ?? null)"
          ><ArrowLeft
            width="16"
            height="16"
        /></MButton>
        <nav
          class="path"
          aria-label="题目分类路径"
        >
          <button
            type="button"
            :disabled="disabled || loading || categoryId === null"
            @click="navigate(null)"
          >
            题库
          </button>
          <template
            v-for="crumb in data?.breadcrumbs || []"
            :key="crumb.id"
          >
            <NavArrowRight
              width="14"
              height="14"
            />
            <button
              type="button"
              :disabled="disabled || loading || crumb.id === categoryId"
              @click="navigate(crumb.id)"
            >
              {{ crumb.name }}
            </button>
          </template>
        </nav>
      </div>
      <div class="list">
        <MDataView
          :loading="loading"
          text="正在加载题目…"
          :content-key="`${categoryId}:${offset}`"
        >
          <p
            v-if="error"
            class="note"
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
          <template v-else-if="data">
            <button
              v-if="categoryId === null"
              class="row"
              type="button"
              :disabled="disabled"
              @click="navigate('orphaned')"
            >
              <MFileTypeIcon type="folder" /><span>无来源题目</span
              ><NavArrowRight
                width="16"
                height="16"
              />
            </button>
            <button
              v-for="category in data.children"
              :key="`category:${category.id}`"
              class="row"
              type="button"
              :disabled="disabled"
              @click="navigate(category.id)"
            >
              <MFileTypeIcon type="folder" /><span>{{ category.name }}</span
              ><NavArrowRight
                width="16"
                height="16"
              />
            </button>
            <button
              v-for="item in data.items"
              :key="`entry:${item.id}`"
              class="row"
              :class="{
                selected: modelValue === item.slug
              }"
              type="button"
              :disabled="disabled"
              :aria-pressed="modelValue === item.slug"
              @click="emit('update:modelValue', item.slug)"
            >
              <Page
                width="24"
                height="24"
              /><span
                >{{ item.source_number || item.slug
                }}<small v-if="item.stem_summary">{{ item.stem_summary }}</small></span
              >
            </button>
            <MEmpty v-if="categoryId !== null && !data.children.length && !data.items.length" />
          </template>
        </MDataView>
      </div>
      <MPagination
        v-if="data && data.pagination.total > 50"
        class="pages"
        compact
        :page="Math.floor(offset / 50) + 1"
        :page-size="50"
        :total="data.pagination.total"
        :disabled="disabled || loading"
        @update:page="offset = ($event - 1) * 50"
      />
    </div>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  gap: 8px;
}
.selected {
  display: flex;
  gap: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.selected strong {
  overflow: hidden;
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.label {
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.container {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}
.heading {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 40px;
  padding: 4px 12px;
}
.path {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.path button:not(:disabled):hover {
  color: var(--accent-primary);
}
.path button:disabled:last-child {
  color: var(--text-primary);
}
.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  text-align: left;
  color: var(--text-primary);
}
.row:hover,
.row.selected {
  background: var(--bg-hover);
}
.row > svg {
  flex: none;
}
.row > svg:first-child {
  width: 24px;
  height: 24px;
}
.row > span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row small {
  display: block;
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note {
  margin: 0;
  padding: 20px 12px;
  color: var(--text-secondary);
}
.pages {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
</style>
