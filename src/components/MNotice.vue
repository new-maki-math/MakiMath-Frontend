<script>
import { ref } from 'vue';

// 全局通知单例状态
const globalNotice = ref(null);
let globalTimer = null;

// 全局函数式通知触发器
export const notify = (text, kind = 'ok', duration = 3200) => {
  if (!text) return;
  globalNotice.value = { text, kind };
  clearTimeout(globalTimer);
  if (duration > 0) {
    globalTimer = setTimeout(() => {
      globalNotice.value = null;
    }, duration);
  }
};

notify.ok = (text, duration) => notify(text, 'ok', duration);
notify.success = (text, duration) => notify(text, 'ok', duration);
notify.error = (text, duration) => notify(text, 'error', duration);
notify.warn = (text, duration) => notify(text, 'warn', duration);
notify.info = (text, duration) => notify(text, 'info', duration);
notify.clear = () => {
  clearTimeout(globalTimer);
  globalNotice.value = null;
};

export const useNotice = () => ({
  notice: globalNotice,
  notify,
  clear: notify.clear
});
</script>

<script setup>
import { computed } from 'vue';
import { CheckCircleSolid, WarningCircleSolid, InfoCircleSolid, Xmark } from '@iconoir/vue';

const props = defineProps({
  // 支持由外部主动传入 notice 结构 { text, kind }，未传入时回退到全局单例
  notice: {
    type: Object,
    default: null
  },
  // 是否自动传送至 body 顶层
  teleport: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['close']);

// 优先采用外部 props 传入的 notice，未传时使用全局响应式单例
const currentNotice = computed(() => props.notice || globalNotice.value);

const handleClose = () => {
  if (props.notice) {
    emit('close');
  } else {
    notify.clear();
  }
};
</script>

<template>
  <component :is="teleport ? 'teleport' : 'div'" to="body">
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
        <span class="m-notice-text" @click="typeof currentNotice.text === 'string' && currentNotice.text.includes('\n') && $event.stopPropagation()">{{ currentNotice.text }}</span>
        <button
          type="button"
          class="m-notice-close"
          title="关闭通知"
          @click.stop="handleClose"
        >
          <Xmark width="13" height="13" />
        </button>
      </div>
    </Transition>
  </component>
</template>

<style scoped>
/* 通知浮层定位 */
.m-notice {
  position: fixed;
  top: calc(var(--topbar-height, 54px) + 14px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: min(520px, calc(100vw - 48px));
  padding: 8px 14px;
  border-radius: var(--radius-sm, 4px);
  font-size: var(--font-size-smaller, 13px);
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  transition: border-color 140ms ease, background-color 140ms ease;
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
  color: #10b981;
}

.m-notice-icon.is-error {
  color: #ef4444;
}

.m-notice-icon.is-warn {
  color: #f59e0b;
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
  border-radius: var(--radius-xs, 2px);
  flex-shrink: 0;
  transition: color 140ms ease;
}

.m-notice-close:hover {
  color: var(--text-primary);
}

/* 状态修饰 */
.m-notice.is-error {
  border-color: rgba(224, 112, 112, 0.5);
  color: #e8a0a0;
  background-color: rgba(45, 20, 20, 0.95);
}

.m-notice.is-warn,
.m-notice.is-warning {
  border-color: rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}

.m-notice.is-info {
  border-color: rgba(56, 189, 248, 0.4);
}

/* 过渡动画 */
.notice-fade-enter-active,
.notice-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.notice-fade-enter-from,
.notice-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
