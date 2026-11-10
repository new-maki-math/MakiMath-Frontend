<script setup>
import { computed } from 'vue';

import MBackdrop from '../overlay/MBackdrop.vue';
import MSpinner from './MSpinner.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  text: {
    type: String,
    default: '加载中…'
  },
  progress: {
    type: Number,
    default: undefined
  },
  fixed: {
    type: Boolean,
    default: false
  },
  zIndex: {
    type: [Number, String],
    default: 50
  }
});

const progressPercent = computed(() => {
  if (props.progress === undefined || props.progress === null) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(props.progress)));
});
</script>

<template>
  <MBackdrop
    :open="visible"
    :fixed="fixed"
    :z-index="zIndex"
    :close-on-click="false"
    class="loading-backdrop"
  >
    <div class="loading-content">
      <MSpinner :size="28" />

      <div
        v-if="text"
        class="loading-text font-mono"
      >
        {{ text }}
      </div>

      <div
        v-if="progressPercent !== null"
        class="loading-bar-wrap"
      >
        <div class="loading-bar-track">
          <div
            class="loading-bar-fill"
            :style="{
              width: progressPercent + '%'
            }"
          ></div>
        </div>
        <span class="loading-bar-num font-mono">{{ progressPercent }}%</span>
      </div>
    </div>
  </MBackdrop>
</template>

<style scoped>
:global(.loading-backdrop) {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: color-mix(in srgb, var(--bg-app) 68%, transparent) !important;
  user-select: none;
  cursor: wait;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-width: 160px;
}

.loading-text {
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
  text-align: center;
  line-height: 1.4;
  letter-spacing: 0.02em;
}

.loading-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 150px;
}

.loading-bar-track {
  flex: 1;
  height: 3px;
  background: var(--border-hover);
  border-radius: 2px;
  overflow: hidden;
}

.loading-bar-fill {
  height: 100%;
  background: var(--accent-primary, #38bdf8);
  transition: width 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.loading-bar-num {
  font-size: 11.5px;
  color: var(--text-muted, #808080);
  min-width: 30px;
  text-align: right;
}
</style>
