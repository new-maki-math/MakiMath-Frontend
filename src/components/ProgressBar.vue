<script setup>
import { ref, nextTick } from 'vue';

const progress = ref(0);
const opacity = ref(0);
const status = ref('normal'); // 'normal' | 'error'
const isTransitioning = ref(true);

let trickleTimer = null;
let finishTimer = null;
let resetTimer = null;

const clearAllTimers = () => {
  if (trickleTimer) clearInterval(trickleTimer);
  if (finishTimer) clearTimeout(finishTimer);
  if (resetTimer) clearTimeout(resetTimer);
  trickleTimer = null;
  finishTimer = null;
  resetTimer = null;
};

// 启动进度条：柔和淡入，并从 0 持续平滑递增
const start = () => {
  clearAllTimers();
  status.value = 'normal';

  // 如果当前还在淡出中，先重置归零
  if (opacity.value === 0) {
    isTransitioning.value = false;
    progress.value = 0;
  }

  nextTick(() => {
    // 开启过渡并淡入
    isTransitioning.value = true;
    opacity.value = 1;
    // 起步平滑推至 22%
    progress.value = 22;

    // 智能流式递增（越往后步进越细，过渡无顿挫）
    trickleTimer = setInterval(() => {
      if (progress.value < 88) {
        const remaining = 90 - progress.value;
        const delta = Math.max(0.5, remaining * 0.08 + Math.random() * 1.5);
        progress.value = Math.min(88, progress.value + delta);
      }
    }, 140);
  });
};

// 完成加载：冲刺到 100% 后优雅淡出
const finish = () => {
  if (trickleTimer) clearInterval(trickleTimer);
  trickleTimer = null;

  isTransitioning.value = true;
  progress.value = 100;

  // 160ms 让进度条跑满 100%，随后开启 240ms 柔和淡出
  finishTimer = setTimeout(() => {
    opacity.value = 0;

    // 淡出完全结束后重置宽度归零
    resetTimer = setTimeout(() => {
      isTransitioning.value = false;
      progress.value = 0;
      status.value = 'normal';
    }, 250);
  }, 160);
};

// 失败状态
const fail = () => {
  if (trickleTimer) clearInterval(trickleTimer);
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
    :style="{ opacity }"
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
      :style="{ width: `${progress}%` }"
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
  /* 轨道透明度淡入淡出过渡 */
  transition: opacity 240ms cubic-bezier(0.4, 0, 0.2, 1);
}

.top-progress-bar {
  height: 100%;
  background-color: var(--accent-primary);
  /* 采用经过微调的缓动贝塞尔曲线，消除跳阶与顿挫感 */
  transition: width 260ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms ease;
  will-change: width, opacity;
}

.top-progress-bar.no-transition {
  transition: none !important;
}

.top-progress-bar.is-error {
  background-color: #f85149;
}
</style>
