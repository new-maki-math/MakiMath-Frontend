<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';

import { questionApi } from '../../api/questions.js';
import MInput from '../form/MInput.vue';
import MModal from '../overlay/MModal.vue';

const props = defineProps({
  open: Boolean
});
const emit = defineEmits(['close', 'select']);
const query = ref('');
const input = ref(null);
const results = ref([]);
const active = ref(0);
const loading = ref(false);
const error = ref('');
let sequence = 0;
let timer;
let frame;
let controller;
async function search() {
  const current = ++sequence;
  controller?.abort();
  controller = new AbortController();
  results.value = [];
  error.value = '';
  const text = query.value.trim();
  if (!text) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const result = await questionApi.entries(
      {
        q: text,
        limit: 100,
        offset: 0
      },
      {
        signal: controller.signal
      }
    );
    if (current !== sequence) {
      return;
    }
    if (!Array.isArray(result?.items)) {
      throw new Error('搜索结果格式错误');
    }
    results.value = [...new Map(result.items.map((item) => [item.slug, item])).values()];
    active.value = 0;
  } catch (failure) {
    if (current === sequence && failure.name !== 'AbortError') {
      error.value = '题目搜索失败';
    }
  } finally {
    if (current === sequence) {
      loading.value = false;
    }
  }
}
watch(
  query,
  () => {
    clearTimeout(timer);
    sequence++;
    controller?.abort();
    results.value = [];
    error.value = '';
    loading.value = Boolean(query.value.trim());
    if (loading.value) {
      timer = setTimeout(search, 200);
    }
  },
  {
    flush: 'sync'
  }
);
watch(
  () => props.open,
  (open) => {
    query.value = '';
    results.value = [];
    error.value = '';
    clearTimeout(timer);
    sequence++;
    controller?.abort();
    cancelAnimationFrame(frame);
    if (open) {
      frame = requestAnimationFrame(() => input.value?.focus());
    }
  }
);
onBeforeUnmount(() => {
  sequence++;
  controller?.abort();
  clearTimeout(timer);
  cancelAnimationFrame(frame);
});
function keydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (results.value.length) {
      active.value =
        (active.value + (event.key === 'ArrowDown' ? 1 : -1) + results.value.length) %
        results.value.length;
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (results.value[active.value]) {
      emit('select', results.value[active.value].slug);
    }
  }
}
</script>

<template>
  <MModal
    :open="open"
    title="选择题目"
    width="480px"
    hide-footer
    show-close
    @close="emit('close')"
  >
    <div
      class="picker"
      @keydown="keydown"
    >
      <MInput
        ref="input"
        v-model="query"
        label="搜索题目"
        placeholder="输入题干、标识或来源题号"
      />
      <div
        class="results"
        role="listbox"
        aria-label="题目搜索结果"
      >
        <p
          v-if="loading"
          class="hint"
        >
          正在搜索…
        </p>
        <p
          v-else-if="error"
          class="hint"
        >
          {{ error }}
          <button
            type="button"
            @click="search"
          >
            重试
          </button>
        </p>
        <p
          v-else-if="!query.trim()"
          class="hint"
        >
          输入关键词搜索题库
        </p>
        <p
          v-else-if="!results.length"
          class="hint"
        >
          没有找到题目
        </p>
        <button
          v-for="(item, index) in results"
          :key="item.slug"
          type="button"
          role="option"
          :aria-selected="index === active"
          class="result"
          :class="{
            active: index === active
          }"
          @mouseenter="active = index"
          @click="emit('select', item.slug)"
        >
          <span>{{ item.source_number || item.slug }} · {{ item.stem_summary }}</span
          ><span class="slug">{{ item.slug }}</span>
        </button>
      </div>
    </div>
  </MModal>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.results {
  max-height: 300px;
  overflow-y: auto;
}
.hint {
  margin: 0;
  padding: 12px 0;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.hint button {
  color: var(--accent-primary);
}
.result {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  text-align: left;
}
.result.active,
.result:hover {
  background: var(--bg-hover);
}
.slug {
  flex: none;
  color: var(--text-muted);
}
</style>
