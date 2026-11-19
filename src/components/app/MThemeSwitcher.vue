<script setup>
import { computed } from 'vue';

import { t } from '../../i18n.js';
import MSelect from '../form/MSelect.vue';
import { HalfMoon, SeasonAutumn, SeasonSpring, SeasonWinter, SunLight } from '../../theme/icons.js';

const props = defineProps({
  modelValue: {
    type: String,
    default: 'dark'
  }
});
const emit = defineEmits(['update:modelValue']);
const themes = computed(() => [
  ['dark', '深色', HalfMoon],
  ['light', '浅色', SunLight],
  ['spring', '春', SeasonSpring],
  ['summer', '夏', SunLight],
  ['autumn', '秋', SeasonAutumn],
  ['winter', '冬', SeasonWinter]
].map(([value, label, icon]) => ({
  value,
  label: t(label),
  icon
})));
const selectedTheme = computed(
  () => themes.value.find((theme) => theme.value === props.modelValue) || themes.value[0]
);
</script>

<template>
  <MSelect
    class="theme-switcher"
    :model-value="modelValue"
    :options="themes"
    icon-only
    :title="t('主题：{name}', { name: selectedTheme.label })"
    :aria-label="t('选择主题')"
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
