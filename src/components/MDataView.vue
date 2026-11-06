<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  text: {
    type: String,
    default: '加载中…'
  },
  contentKey: {
    type: [String, Number],
    default: 'content'
  },
  animate: {
    type: Boolean,
    default: true
  }
});
</script>

<template>
  <div
    class="m-data-view"
    :aria-busy="loading"
  >
    <div
      v-if="loading"
      class="data-loading"
      role="status"
    >
      <span
        class="data-spinner"
        aria-hidden="true"
      ></span>
      <span>{{ text }}</span>
    </div>
    <Transition
      v-else
      name="data-enter"
      appear
    >
      <div
        :key="contentKey"
        class="data-content"
        :class="{
 'no-motion': !animate 
}"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.m-data-view,
.data-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.data-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.data-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-hover);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: data-spin 0.75s linear infinite;
}
.data-enter-enter-active:not(.no-motion) {
  transition:
    opacity 220ms ease-out,
    transform 220ms ease-out;
}
.data-enter-enter-from:not(.no-motion) {
  opacity: 0;
  transform: translateY(8px);
}
.data-enter-leave-active {
  display: none;
}
@keyframes data-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .data-spinner {
    animation: none;
  }
  .data-enter-enter-active {
    transition: none !important;
  }
}
</style>
