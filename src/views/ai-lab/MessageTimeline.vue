<script setup>
import { computed, nextTick, onDeactivated, ref, watch } from 'vue';

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  activeId: {
    type: String,
    default: ''
  }
});
defineEmits(['navigate']);
const hovered = ref('');
const tooltipPosition = ref({});
const timeline = ref(null);
onDeactivated(() => {
  hovered.value = '';
});
const focusIndex = computed(() => {
  return props.messages.findIndex((message) => message.id === hovered.value);
});
function messageLabel(message) {
  const text = message.text?.replace(/\s+/g, ' ').trim() || '图片消息';
  const characters = Array.from(text);
  const preview = characters.slice(0, 60).join('');
  return `我说：${preview}${characters.length > 60 ? '…' : ''}`;
}
const hoveredMessage = computed(() =>
  props.messages.find((message) => message.id === hovered.value)
);
function showTooltip(event, id) {
  const rect = event.currentTarget.getBoundingClientRect();
  tooltipPosition.value = {
    left: `${rect.right + 8}px`,
    top: `${Math.max(48, Math.min(window.innerHeight - 48, rect.top + rect.height / 2))}px`
  };
  hovered.value = id;
}
watch(
  () => props.activeId,
  async (id) => {
    await nextTick();
    const index = props.messages.findIndex((message) => message.id === id);
    const container = timeline.value;
    const tick = container?.children[index];
    if (!tick) {
      return;
    }
    if (tick.offsetTop < container.scrollTop) {
      container.scrollTop = tick.offsetTop;
    } else if (tick.offsetTop + tick.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = tick.offsetTop + tick.offsetHeight - container.clientHeight;
    }
  }
);
</script>

<template>
  <nav
    v-if="messages.length"
    ref="timeline"
    class="message-timeline"
    aria-label="我的消息历史"
    @scroll="hovered = ''"
  >
    <button
      v-for="(message, index) in messages"
      :key="message.id"
      type="button"
      class="message-timeline-tick"
      :class="{
        'is-active': message.id === activeId,
        'is-favorite': message.favorite
      }"
      :style="{
        '--tick-width': `${focusIndex < 0 ? 12 : Math.max(12, 32 - Math.abs(index - focusIndex) * 5)}px`
      }"
      :aria-label="messageLabel(message)"
      :aria-current="message.id === activeId ? 'location' : undefined"
      @mouseenter="showTooltip($event, message.id)"
      @mouseleave="hovered = ''"
      @focus="showTooltip($event, message.id)"
      @blur="hovered = ''"
      @click="$emit('navigate', message.id)"
    >
      <span></span>
    </button>
  </nav>
  <Teleport to="body">
    <div
      v-if="hoveredMessage"
      class="message-timeline-tooltip"
      :style="tooltipPosition"
      role="tooltip"
    >
      {{ messageLabel(hoveredMessage) }}
    </div>
  </Teleport>
</template>

<style scoped>
.message-timeline {
  position: absolute;
  z-index: 1;
  top: 24px;
  bottom: var(--composer-height);
  left: 6px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  overflow-y: auto;
  overflow-x: hidden;
  width: 36px;
  padding: 4px 0;
  scrollbar-width: none;
}
.message-timeline::-webkit-scrollbar {
  display: none;
}
.message-timeline-tick {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex: 0 0 10px;
  width: 100%;
  min-height: 10px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  opacity: 0.5;
}
.message-timeline-tick span {
  display: block;
  width: var(--tick-width);
  height: 3px;
  background: currentColor;
  transition:
    width 180ms var(--ease-standard),
    background-color 180ms var(--ease-standard);
}
.message-timeline-tick:hover,
.message-timeline-tick:focus-visible,
.message-timeline-tick.is-active {
  color: var(--text-primary);
  opacity: 1;
}
.message-timeline-tick.is-favorite {
  color: var(--color-warning, #e5a84b);
  opacity: 1;
}
.message-timeline-tick:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -1px;
}
.message-timeline-tooltip {
  position: fixed;
  z-index: 100;
  max-width: min(320px, 70vw);
  padding: 8px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  box-shadow: 0 4px 12px var(--shadow-color-soft);
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
  line-height: 1.4;
  overflow-wrap: anywhere;
  pointer-events: none;
  transform: translateY(-50%);
}
@media (prefers-reduced-motion: reduce) {
  .message-timeline-tick span {
    transition: none;
  }
}
</style>
