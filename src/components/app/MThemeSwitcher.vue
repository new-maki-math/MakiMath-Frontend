<script setup>
import { computed } from 'vue';

import MSelect from '../form/MSelect.vue';
import { HalfMoon, SeasonAutumn, SeasonSpring, SeasonWinter, SunLight } from '../icons/icons.js';

const props = defineProps({
  modelValue: {
    type: String,
    default: 'dark'
  }
});
const emit = defineEmits(['update:modelValue']);
const themes = [
  ['dark', '深色', HalfMoon],
  ['light', '浅色', SunLight],
  ['spring', '春', SeasonSpring],
  ['summer', '夏', SunLight],
  ['autumn', '秋', SeasonAutumn],
  ['winter', '冬', SeasonWinter]
].map(([value, label, icon]) => ({
  value,
  label,
  icon
}));
const selectedTheme = computed(
  () => themes.find((theme) => theme.value === props.modelValue) || themes[0]
);
</script>

<template>
  <MSelect
    class="theme-switcher"
    :model-value="modelValue"
    :options="themes"
    icon-only
    :title="`主题：${selectedTheme.label}`"
    aria-label="选择主题"
    variant="ghost"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #icon>
      <component
        :is="selectedTheme.icon"
        width="20"
        height="20"
      />
    </template>
  </MSelect>
</template>

<style scoped>
.theme-switcher :deep(.select-trigger.is-icon-only) {
  width: 28px;
  min-width: 28px;
  height: 28px;
}
@media (max-width: 767px) {
  .theme-switcher :deep(.select-trigger.is-icon-only) {
    width: 40px;
    min-width: 40px;
    height: 40px;
  }
}
</style>
