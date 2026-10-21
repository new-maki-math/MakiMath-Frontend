<script setup>
import { computed, ref } from 'vue';
import { Xmark } from '@iconoir/vue';
import MTag from '../../components/MTag.vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  candidates: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '输入名称筛选'
  }
});

const emit = defineEmits(['update:modelValue']);

const query = ref('');

const selected = computed(() => props.modelValue || []);

const available = computed(() => {
  const q = query.value.trim().toLowerCase();
  const rest = props.candidates.filter((c) => !selected.value.includes(c.id));
  if (!q) return rest.slice(0, 60);
  return rest.filter((c) => String(c.label).toLowerCase().includes(q)).slice(0, 60);
});

const labelOf = (id) => {
  const hit = props.candidates.find((c) => c.id === id);
  return hit ? hit.label : `#${id}`;
};

const add = (id) => emit('update:modelValue', [...selected.value, id]);

const remove = (id) => emit('update:modelValue', selected.value.filter((v) => v !== id));
</script>

<template>
  <div class="prereq-picker">
    <div
      v-if="selected.length > 0"
      class="picker-selected"
    >
      <MTag
        v-for="id in selected"
        :key="id"
        variant="cyan"
        size="sm"
      >
        {{ labelOf(id) }}
        <button
          class="chip-remove"
          type="button"
          title="移除"
          @click="remove(id)"
        >
          <Xmark width="10" height="10" />
        </button>
      </MTag>
    </div>
    <p
      v-else
      class="picker-empty"
    >
      未设置前置项
    </p>

    <input
      v-model="query"
      class="picker-search"
      type="text"
      :placeholder="placeholder"
      spellcheck="false"
    />

    <div class="picker-list">
      <div
        v-if="available.length === 0"
        class="picker-hint font-mono"
      >
        {{ candidates.length === 0 ? '没有可选项' : '没有匹配项' }}
      </div>
      <button
        v-for="item in available"
        :key="item.id"
        class="picker-option"
        type="button"
        @click="add(item.id)"
      >
        <span class="option-label">{{ item.label }}</span>
        <span
          v-if="item.meta"
          class="option-meta font-mono"
        >{{ item.meta }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.prereq-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picker-selected {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-remove {
  margin-left: 2px;
  width: 13px;
  height: 13px;
  border-radius: var(--radius-xs);
  color: inherit;
  opacity: 0.6;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chip-remove:hover {
  opacity: 1;
}

.picker-empty {
  font-size: var(--font-size);
  color: var(--text-muted);
}

.picker-search {
  height: 34px;
  padding: 0 11px;
  /* 框体比页面背景（bg-app）浅一级 */
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size);
  user-select: text;
}

.picker-search:focus {
  border-color: var(--border-focus);
}

.picker-list {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background-color: var(--bg-surface);
}

.picker-option {
  width: 100%;
  height: 32px;
  padding: 0 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: var(--font-size);
  color: var(--text-secondary);
  text-align: left;
}

.picker-option:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.option-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-meta {
  flex-shrink: 0;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.picker-hint {
  padding: 10px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}
</style>
