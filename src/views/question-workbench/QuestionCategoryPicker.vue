<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';

import { questionApi } from '../../api/questions.js';
import { ArrowLeft, NavArrowRight } from '../../components/icons/icons.js';
import MButton from '../../components/form/MButton.vue';
import MDataView from '../../components/feedback/MDataView.vue';
import MEmpty from '../../components/feedback/MEmpty.vue';
import MFileTypeIcon from '../../components/display/MFileTypeIcon.vue';

const props = defineProps({
  open: Boolean,
  disabled: Boolean
});
const emit = defineEmits(['select']);
const categoryId = ref(null);
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
  emit('select', null);
  try {
    const result = await questionApi.entries(
      {
        category_id: categoryId.value,
        limit: 1,
        offset: 0
      },
      {
        signal: controller.signal
      }
    );
    if (current !== sequence) {
      return;
    }
    if (!Array.isArray(result?.children) || !Array.isArray(result?.breadcrumbs)) {
      throw new Error('分类数据格式错误');
    }
    data.value = result;
    emit('select', categoryId.value);
  } catch (failure) {
    if (current === sequence && failure.name !== 'AbortError') {
      error.value = '分类加载失败';
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
}
watch(
  () => props.open,
  (open) => {
    sequence++;
    controller?.abort();
    if (open) {
      categoryId.value = null;
      data.value = null;
      load();
    }
  },
  {
    immediate: true
  }
);
watch(categoryId, () => {
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
    <div class="current">
      <span>当前目标</span
      ><strong>{{
        categoryId === null ? '请选择分类' : data?.current_category?.name || '正在读取分类'
      }}</strong>
    </div>
    <span class="label">选择目标分类</span>
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
          text="正在加载分类…"
          :content-key="String(categoryId)"
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
              v-for="category in data.children"
              :key="category.id"
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
            <MEmpty v-if="!data.children.length" />
          </template>
        </MDataView>
      </div>
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
.current {
  display: flex;
  gap: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.current strong {
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
.row:hover {
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
.note {
  margin: 0;
  padding: 20px 12px;
  color: var(--text-secondary);
}
</style>
