<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    required: true
  },
  tabs: {
    type: Array,
    required: true
  }
});

defineEmits(['update:modelValue']);

const normalizedTabs = computed(() => {
  return props.tabs.map((tab) => {
    if (typeof tab === 'object' && tab !== null) {
      return {
        label: tab.label ?? String(tab.value),
        value: tab.value ?? tab.label
      };
    }
    return { label: String(tab), value: tab };
  });
});

const activeIndex = computed(() => {
  const idx = normalizedTabs.value.findIndex((t) => t.value === props.modelValue);
  return idx >= 0 ? idx : 0;
});

const lineWidth = computed(() => {
  const count = normalizedTabs.value.length;
  return count > 0 ? `${100 / count}%` : '50%';
});

const lineTransform = computed(() => {
  return `translateX(${activeIndex.value * 100}%)`;
});
</script>

<template>
  <div class="auth-tabs">
    <button
      v-for="tab in normalizedTabs"
      :key="tab.value"
      type="button"
      class="auth-tab"
      :class="{ active: modelValue === tab.value }"
      @click="$emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
    <div
      class="auth-tab-line"
      :style="{ width: lineWidth, transform: lineTransform }"
    />
  </div>
</template>

<style scoped>
.auth-tabs {
  position: relative;
  display: flex;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 24px;
}

.auth-tab {
  flex: 1;
  height: 38px;
  background: transparent;
  border: none;
  font-size: var(--font-size);
  font-weight: var(--font-weight-regular);
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 140ms ease;
  user-select: none;
}

.auth-tab:hover:not(.active) {
  color: var(--text-secondary);
}

.auth-tab.active {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.auth-tab-line {
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 50%;
  height: 2px;
  background-color: var(--accent-primary);
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
