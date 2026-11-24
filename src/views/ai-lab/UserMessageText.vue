<script setup>
import { nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';

import MModal from '../../components/overlay/MModal.vue';

const props = defineProps({
  text: {
    type: String,
    required: true
  }
});
const textElement = ref(null);
const truncated = ref(false);
const open = ref(false);
let observer;

function measure() {
  const element = textElement.value;
  truncated.value = Boolean(element && element.scrollHeight > element.clientHeight + 1);
}
watch(
  () => props.text,
  async () => {
    await nextTick();
    measure();
  }
);
onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure);
    observer.observe(textElement.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());
onDeactivated(() => {
  open.value = false;
});
</script>

<template>
  <div>
    <div
      ref="textElement"
      class="user-message-text"
      :class="{
        'is-truncated': truncated
      }"
    >
      {{ text }}
    </div>
    <button
      v-if="truncated"
      type="button"
      class="user-message-expand"
      @click="open = true"
    >
      查看全部
    </button>
    <MModal
      v-if="open"
      :open="true"
      title="消息内容"
      width="min(720px, 92vw)"
      hide-footer
      show-close
      @close="open = false"
    >
      <div class="user-message-full">{{ text }}</div>
    </MModal>
  </div>
</template>

<style scoped>
.user-message-text,
.user-message-full {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.7;
  user-select: text;
  -webkit-user-select: text;
}
.user-message-text {
  max-height: 61.2em;
  overflow: hidden;
}
.user-message-text.is-truncated {
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 48px), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 48px), transparent);
}
.user-message-expand {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 32px;
  margin-top: 4px;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.user-message-expand:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.user-message-expand:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
</style>
