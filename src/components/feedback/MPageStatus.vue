<script setup>
import { t } from '../../i18n.js';
import MButton from '../form/MButton.vue';
import MSpinner from './MSpinner.vue';

defineProps({
  text: {
    type: String,
    default: '加载中…'
  },
  error: {
    type: Error,
    default: null
  }
});

function reload() {
  window.location.reload();
}
</script>

<template>
  <div
    class="m-page-status"
    role="status"
  >
    <template v-if="error">
      <span>{{ t('加载失败') }}</span>
      <MButton
        size="sm"
        @click="reload"
        >{{ t('重试') }}</MButton
      >
    </template>
    <template v-else>
      <MSpinner :size="28" />
      <span>{{ t(text) }}</span>
    </template>
  </div>
</template>

<style scoped>
.m-page-status {
  display: grid;
  flex: 1;
  align-content: center;
  justify-items: center;
  min-width: 0;
  min-height: 96px;
  gap: 12px;
  padding: 16px;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
</style>
