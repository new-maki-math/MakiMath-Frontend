<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { useLectureSearch } from '../../composables/useLectureSearch.js';
import MInput from '../MInput.vue';
import MModal from '../MModal.vue';

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['close', 'select']);
const input = ref(null);
const active = ref(0);
let focusFrame = 0;
const { query, results, isSearching, searchError, clear, executeSearch } = useLectureSearch({
  limit: 50
});
const points = computed(() =>
  results.value.filter(
    (item) =>
      item.type === 'knowledge' &&
      typeof item.slug === 'string' &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) &&
      item.slug.length <= 100
  )
);
watch(
  () => props.open,
  () => {
    clear();
    active.value = 0;
  }
);
watch(
  [() => props.open, input],
  ([open, field]) => {
    cancelAnimationFrame(focusFrame);
    if (!open || !field) {
      return;
    }
    focusFrame = requestAnimationFrame(() => {
      focusFrame = 0;
      if (props.open && input.value === field) {
        field.focus();
      }
    });
  },
  {
    flush: 'post'
  }
);
onBeforeUnmount(() => cancelAnimationFrame(focusFrame));
watch(points, () => {
  active.value = 0;
});
function select(item) {
  if (item) {
    emit('select', item.slug);
  }
}
function keydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (points.value.length) {
      active.value =
        (active.value + (event.key === 'ArrowDown' ? 1 : -1) + points.value.length) %
        points.value.length;
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    select(points.value[active.value]);
  }
}
</script>

<template>
  <MModal
    :open="open"
    title="插入知识点"
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
        label="搜索知识点"
        placeholder="输入知识点名称"
      />
      <div
        class="results"
        role="listbox"
        aria-label="知识点搜索结果"
      >
        <p
          v-if="isSearching"
          class="hint"
        >
          正在搜索…
        </p>
        <p
          v-else-if="searchError"
          class="hint"
        >
          {{ searchError }}
          <button
            type="button"
            @click="executeSearch(query)"
          >
            重试
          </button>
        </p>
        <p
          v-else-if="!query.trim()"
          class="hint"
        >
          输入关键词搜索公开知识点
        </p>
        <p
          v-else-if="!points.length"
          class="hint"
        >
          没有找到知识点
        </p>
        <button
          v-for="(item, index) in points"
          :key="item.id"
          type="button"
          role="option"
          :aria-selected="index === active"
          class="result"
          :class="{
            active: index === active
          }"
          @mouseenter="active = index"
          @click="select(item)"
        >
          <span>{{ item.title }}</span
          ><span class="result-id">{{ item.slug }}</span>
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
  cursor: pointer;
}
.result {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}
.result.active,
.result:hover {
  background: var(--bg-hover);
}
.result:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
}
.result-id {
  flex: none;
  color: var(--text-muted);
}
</style>
