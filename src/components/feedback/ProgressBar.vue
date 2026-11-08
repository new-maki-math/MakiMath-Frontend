<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue';

const progress = ref(0);
const opacity = ref(0);
const status = ref('normal');
const isTransitioning = ref(true);

let trickleTimer = null;
let finishTimer = null;
let resetTimer = null;

const clearAllTimers = () => {
  if (trickleTimer) {
    clearInterval(trickleTimer);
  }
  if (finishTimer) {
    clearTimeout(finishTimer);
  }
  if (resetTimer) {
    clearTimeout(resetTimer);
  }
  trickleTimer = null;
  finishTimer = null;
  resetTimer = null;
};

// 启动进度条
const start = () => {
  clearAllTimers();
  status.value = 'normal';

  // 淡出中重置进度
  if (opacity.value === 0) {
    isTransitioning.value = false;
    progress.value = 0;
  }

  nextTick(() => {
    // 开启过渡
    isTransitioning.value = true;
    opacity.value = 1;
    // 推进初始进度
    progress.value = 22;

    // 流式递增
    trickleTimer = setInterval(() => {
      if (progress.value < 88) {
        const remaining = 90 - progress.value;
        const delta = Math.max(0.5, remaining * 0.08 + Math.random() * 1.5);
        progress.value = Math.min(88, progress.value + delta);
      }
    }, 140);
  });
};

// 完成进度
const finish = () => {
  if (trickleTimer) {
    clearInterval(trickleTimer);
  }
  trickleTimer = null;

  isTransitioning.value = true;
  progress.value = 100;

  // 完成后淡出
  finishTimer = setTimeout(() => {
    opacity.value = 0;

    // 淡出结束重置进度
    resetTimer = setTimeout(() => {
      isTransitioning.value = false;
      progress.value = 0;
      status.value = 'normal';
    }, 250);
  }, 160);
};

// 失败状态
const fail = () => {
  if (trickleTimer) {
    clearInterval(trickleTimer);
  }
  trickleTimer = null;

  status.value = 'error';
  isTransitioning.value = true;
  progress.value = 100;

  finishTimer = setTimeout(() => {
    opacity.value = 0;
    resetTimer = setTimeout(() => {
      isTransitioning.value = false;
      progress.value = 0;
      status.value = 'normal';
    }, 300);
  }, 220);
};

onBeforeUnmount(clearAllTimers);

defineExpose({
  start,
  finish,
  fail,
  progress,
  opacity
});
</script>

<template>
  <div
    class="top-progress-track"
    :style="{
      opacity
    }"
    role="progressbar"
    :aria-valuenow="Math.round(progress)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      class="top-progress-bar"
      :class="{
        'is-error': status === 'error',
        'no-transition': !isTransitioning
      }"
      :style="{
        width: `${progress}%`
      }"
    />
  </div>
</template>

<style scoped>
.top-progress-track {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: transparent;
  z-index: 9999;
  pointer-events: none;
  /* 轨道透明度过渡 */
  transition: opacity 240ms cubic-bezier(0.4, 0, 0.2, 1);
}

.top-progress-bar {
  height: 100%;
  background-color: var(--accent-primary);
  /* 进度条宽度过渡 */
  transition:
    width 260ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 200ms ease;
  will-change: width, opacity;
}

.top-progress-bar.no-transition {
  transition: none !important;
}

.top-progress-bar.is-error {
  background-color: #f85149;
}
</style>
