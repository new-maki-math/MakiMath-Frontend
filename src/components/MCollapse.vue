<script setup>
import { computed } from 'vue';

const props = defineProps({
  // 是否展开
  open: {
    type: Boolean,
    default: false
  },
  // 横向折叠快捷属性
  horizontal: {
    type: Boolean,
    default: false
  },
  // 动画时长
  duration: {
    type: [Number, String],
    default: 220
  },
  fade: {
    type: Boolean,
    default: true
  }
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
      horizontal ? 'is-horizontal' : 'is-vertical',
      { 'is-open': open, 'no-fade': !fade }
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
.m-collapse { --collapse-easing: cubic-bezier(0.16, 1, 0.3, 1); }

.m-collapse {
  position: relative;
  width: 100%;
}

/* 横向折叠模式 */
.m-collapse.is-horizontal {
  display: grid;
  grid-template-columns: 0fr;
  transition: grid-template-columns var(--collapse-duration, 220ms) var(--collapse-easing);
}

.m-collapse.is-horizontal.is-open {
  grid-template-columns: 1fr;
}

.m-collapse.is-horizontal > .m-collapse-inner {
  min-width: 0;
  overflow: hidden;
  height: 100%;
  transform: translate3d(0, 0, 0);
  transition: transform var(--collapse-duration, 220ms) var(--collapse-easing),
              opacity var(--collapse-opacity-duration, 180ms) var(--collapse-easing);
  will-change: transform, opacity;
}

.m-collapse.is-horizontal:not(.is-open) > .m-collapse-inner {
  opacity: 0;
  transform: translate3d(-10px, 0, 0);
  visibility: hidden;
  transition:
    transform var(--collapse-duration, 220ms) var(--collapse-easing),
    opacity var(--collapse-opacity-duration, 180ms) var(--collapse-easing),
    visibility 0s var(--collapse-duration, 220ms);
}

/* 纵向折叠模式 */
.m-collapse.is-vertical {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--collapse-duration, 220ms) var(--collapse-easing);
}

.m-collapse.is-vertical.is-open {
  grid-template-rows: 1fr;
}

.m-collapse.is-vertical > .m-collapse-inner {
  min-height: 0;
  overflow: hidden;
  transform: translate3d(0, 0, 0);
  transition: transform var(--collapse-duration, 220ms) var(--collapse-easing),
              opacity var(--collapse-opacity-duration, 180ms) var(--collapse-easing);
  will-change: transform, opacity;
}

.m-collapse.is-vertical:not(.is-open) > .m-collapse-inner {
  opacity: 0;
  transform: translate3d(0, -6px, 0);
  visibility: hidden;
  transition:
    transform var(--collapse-duration, 220ms) var(--collapse-easing),
    opacity var(--collapse-opacity-duration, 180ms) var(--collapse-easing),
    visibility 0s var(--collapse-duration, 220ms);
}

.m-collapse.is-vertical.no-fade > .m-collapse-inner {
  opacity: 1;
  transform: none;
  visibility: visible;
  transition: none;
  will-change: auto;
}
</style>
