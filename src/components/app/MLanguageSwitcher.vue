<script setup>
import { computed } from 'vue';

import { languagePreference, setLanguage, t } from '../../i18n.js';
import MSelect from '../form/MSelect.vue';
import { Language } from '../icons/icons.js';

const options = computed(() => [
  { value: 'system', label: t('跟随系统') },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' }
]);
</script>

<template>
  <MSelect class="language-switcher" :model-value="languagePreference" :options="options" icon-only variant="ghost" :title="t('语言')" :aria-label="t('语言')" @update:model-value="setLanguage">
    <template #icon><Language width="20" height="20" /></template>
  </MSelect>
</template>

<style scoped>
.language-switcher :deep(.select-trigger.is-icon-only) {
  width: 28px;
  min-width: 28px;
  height: 28px;
}
@media (max-width: 767px) {
  .language-switcher :deep(.select-trigger.is-icon-only) {
    width: 40px;
    min-width: 40px;
    height: 40px;
  }
}
</style>
