<script>
import { ref } from 'vue';

// 全局通知单例状态
const globalNotice = ref(null);
let globalTimer = null;

// 全局函数式通知触发器
export const notify = (text, kind = 'ok', duration = 3200) => {
  if (!text) {
    return;
  }
  globalNotice.value = {
    text,
    kind
  };
  clearTimeout(globalTimer);
  if (duration > 0) {
    globalTimer = setTimeout(() => {
      globalNotice.value = null;
    }, duration);
  }
};

notify.clear = () => {
  clearTimeout(globalTimer);
  globalNotice.value = null;
};
</script>

<script setup>
import { CheckCircleSolid, InfoCircleSolid, WarningCircleSolid, Xmark } from '../icons/icons.js';

const currentNotice = globalNotice;
const handleClose = notify.clear;
</script>

<template>
  <Teleport to="body">
    <Transition name="notice-fade">
      <div
        v-if="currentNotice"
        class="m-notice"
        :class="`is-${currentNotice.kind || 'ok'}`"
        role="alert"
        @click="handleClose"
      >
        <div class="m-notice-icon-wrap">
          <CheckCircleSolid
            v-if="currentNotice.kind === 'ok' || currentNotice.kind === 'success'"
            width="15"
            height="15"
            class="m-notice-icon is-ok"
          />
          <WarningCircleSolid
            v-else-if="currentNotice.kind === 'error'"
            width="15"
            height="15"
            class="m-notice-icon is-error"
          />
          <WarningCircleSolid
            v-else-if="currentNotice.kind === 'warn' || currentNotice.kind === 'warning'"
            width="15"
            height="15"
            class="m-notice-icon is-warn"
          />
          <InfoCircleSolid
            v-else
            width="15"
            height="15"
            class="m-notice-icon is-info"
          />
        </div>
        <span
          class="m-notice-text"
          @click="
            typeof currentNotice.text === 'string' &&
            currentNotice.text.includes('\n') &&
            $event.stopPropagation()
          "
          >{{ currentNotice.text }}</span
        >
        <button
          type="button"
          class="m-notice-close"
          title="关闭通知"
          @click.stop="handleClose"
        >
          <Xmark
            width="13"
            height="13"
          />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 通知浮层定位 */
.m-notice {
  position: fixed;
  top: calc(var(--topbar-height) + 14px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: min(520px, calc(100vw - 48px));
  padding: 8px 14px;
  border-radius: var(--radius);
  font-size: var(--font-size-smaller);
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 6px 20px var(--shadow-color-strong);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  transition:
    border-color 140ms ease,
    background-color 140ms ease;
}

.m-notice:hover {
  background-color: var(--bg-surface);
}

.m-notice-icon-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.m-notice-icon.is-ok {
  color: var(--status-success);
}

.m-notice-icon.is-error {
  color: var(--status-error);
}

.m-notice-icon.is-warn {
  color: var(--status-warning);
}

.m-notice-icon.is-info {
  color: var(--accent-primary);
}

.m-notice-text {
  flex: 1;
  min-width: 0;
  max-height: min(50vh, 400px);
  overflow-y: auto;
  line-height: 1.45;
  white-space: pre-line;
  word-break: break-word;
}

.m-notice-close {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius);
  flex-shrink: 0;
  transition: color 140ms ease;
}

.m-notice-close:hover {
  color: var(--text-primary);
}

/* 状态修饰 */
.m-notice.is-error {
  border-color: var(--notice-error-border);
  color: var(--notice-error-text);
  background-color: var(--notice-error-bg);
}

.m-notice.is-warn,
.m-notice.is-warning {
  border-color: var(--notice-warning-border);
  color: var(--notice-warning-text);
}

.m-notice.is-info {
  border-color: var(--notice-info-border);
}

/* 过渡动画 */
.notice-fade-enter-active,
.notice-fade-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.notice-fade-enter-from,
.notice-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
