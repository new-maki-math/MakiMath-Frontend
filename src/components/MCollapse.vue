<script setup>
import { computed } from 'vue';

const props = defineProps({
  // 是否展开
  open: {
    type: Boolean,
    default: undefined
  },
  // 双向绑定展开状态
  modelValue: {
    type: Boolean,
    default: undefined
  },
  // 折叠方向
  direction: {
    type: String,
    default: 'vertical',
    validator: (v) => ['vertical', 'horizontal'].includes(v)
  },
  // 横向折叠快捷属性
  horizontal: {
    type: Boolean,
    default: false
  },
  // 抽屉浮层模式
  drawer: {
    type: Boolean,
    default: false
  },
  // 动画时长
  duration: {
    type: [Number, String],
    default: 220
  }
});

const isOpen = computed(() => {
  if (props.open !== undefined) return Boolean(props.open);
  if (props.modelValue !== undefined) return Boolean(props.modelValue);
  return false;
});

const isHorizontal = computed(() => {
  return props.horizontal || props.direction === 'horizontal';
});

const durationMs = computed(() => {
  const d = Number(props.duration);
  return isNaN(d) ? 220 : d;
});

const opacityDurationMs = computed(() => {
  return Math.max(0, Math.round(durationMs.value * 0.85));
});
</script>

<template>
  <div
    class="m-collapse"
    :class="[
      drawer ? 'is-drawer' : (isHorizontal ? 'is-horizontal' : 'is-vertical'),
      { 'is-open': isOpen }
    ]"
    :style="{
      '--collapse-duration': `${durationMs}ms`,
      '--collapse-opacity-duration': `${opacityDurationMs}ms`
    }"
  >
    <div class="m-collapse-inner">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.m-collapse:not(.is-drawer) {
  position: relative;
  width: 100%;
}

/* 抽屉模式 */
.m-collapse.is-drawer {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  height: 100%;
  z-index: 50;
  transform: translate3d(-100%, 0, 0);
  transition: transform var(--collapse-duration, 220ms) cubic-bezier(0.16, 1, 0.3, 1),
              visibility var(--collapse-duration, 220ms);
  visibility: hidden;
  will-change: transform;
}

.m-collapse.is-drawer.is-open {
  transform: translate3d(0, 0, 0);
  visibility: visible;
}

.m-collapse.is-drawer > .m-collapse-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 横向折叠模式 */
.m-collapse.is-horizontal {
  display: grid;
  grid-template-columns: 0fr;
  transition: grid-template-columns var(--collapse-duration, 220ms) cubic-bezier(0.16, 1, 0.3, 1);
}

.m-collapse.is-horizontal.is-open {
  grid-template-columns: 1fr;
}

.m-collapse.is-horizontal > .m-collapse-inner {
  min-width: 0;
  overflow: hidden;
  height: 100%;
  transform: translate3d(0, 0, 0);
  transition: transform var(--collapse-duration, 220ms) cubic-bezier(0.16, 1, 0.3, 1),
              opacity var(--collapse-opacity-duration, 180ms) ease;
  will-change: transform, opacity;
}

.m-collapse.is-horizontal:not(.is-open) > .m-collapse-inner {
  opacity: 0;
  transform: translate3d(-10px, 0, 0);
  visibility: hidden;
  transition:
    transform var(--collapse-duration, 220ms) cubic-bezier(0.16, 1, 0.3, 1),
    opacity var(--collapse-opacity-duration, 180ms) ease,
    visibility 0s var(--collapse-duration, 220ms);
}

/* 纵向折叠模式 */
.m-collapse.is-vertical {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--collapse-duration, 220ms) cubic-bezier(0.16, 1, 0.3, 1);
}

.m-collapse.is-vertical.is-open {
  grid-template-rows: 1fr;
}

.m-collapse.is-vertical > .m-collapse-inner {
  min-height: 0;
  overflow: hidden;
  transform: translate3d(0, 0, 0);
  transition: transform var(--collapse-duration, 220ms) cubic-bezier(0.16, 1, 0.3, 1),
              opacity var(--collapse-opacity-duration, 180ms) ease;
  will-change: transform, opacity;
}

.m-collapse.is-vertical:not(.is-open) > .m-collapse-inner {
  opacity: 0;
  transform: translate3d(0, -6px, 0);
  visibility: hidden;
  transition:
    transform var(--collapse-duration, 220ms) cubic-bezier(0.16, 1, 0.3, 1),
    opacity var(--collapse-opacity-duration, 180ms) ease,
    visibility 0s var(--collapse-duration, 220ms);
}
</style>
