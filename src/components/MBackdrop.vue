<script setup>
import { computed } from 'vue';

const props = defineProps({
  // 是否显示遮罩
  open: {
    type: Boolean,
    default: undefined
  },
  modelValue: {
    type: Boolean,
    default: undefined
  },
  visible: {
    type: Boolean,
    default: undefined
  },
  // 传送目标容器
  teleport: {
    type: [Boolean, String],
    default: false
  },
  // 是否固定定位
  fixed: {
    type: Boolean,
    default: false
  },
  // 自定义层级
  zIndex: {
    type: [Number, String],
    default: undefined
  },
  // 点击遮罩是否触发关闭
  closeOnClick: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['close', 'click', 'update:modelValue']);

const isOpen = computed(() => {
  if (props.open !== undefined) return Boolean(props.open);
  if (props.modelValue !== undefined) return Boolean(props.modelValue);
  if (props.visible !== undefined) return Boolean(props.visible);
  return false;
});

const shouldTeleport = computed(() => {
  return Boolean(props.teleport);
});

const teleportTarget = computed(() => {
  if (typeof props.teleport === 'string' && props.teleport.trim()) {
    return props.teleport;
  }
  return 'body';
});

const isFixed = computed(() => {
  return props.fixed || shouldTeleport.value;
});

const backdropStyle = computed(() => {
  const style = {};
  if (props.zIndex !== undefined) {
    style.zIndex = props.zIndex;
  }
  return style;
});

const handleClick = (e) => {
  emit('click', e);
  if (props.closeOnClick) {
    emit('close');
    emit('update:modelValue', false);
  }
};
</script>

<template>
  <Teleport v-if="shouldTeleport" :to="teleportTarget">
    <div
      class="m-backdrop"
      :class="[
        isFixed ? 'is-fixed' : 'is-absolute',
        { 'is-open': isOpen }
      ]"
      :style="backdropStyle"
      aria-hidden="true"
      @click.stop="handleClick"
    >
      <slot />
    </div>
  </Teleport>
  <div
    v-else
    class="m-backdrop"
    :class="[
      isFixed ? 'is-fixed' : 'is-absolute',
      { 'is-open': isOpen }
    ]"
    :style="backdropStyle"
    aria-hidden="true"
    @click.stop="handleClick"
  >
    <slot />
  </div>
</template>

<style scoped>
/* 遮罩层基础样式 */
.m-backdrop {
  background-color: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 190ms cubic-bezier(0.16, 1, 0.3, 1),
              visibility 190ms;
  visibility: hidden;
  will-change: opacity;
}

.m-backdrop.is-absolute {
  position: absolute;
  inset: 0;
  z-index: 45;
}

.m-backdrop.is-fixed {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 80;
}

.m-backdrop.is-open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
</style>
