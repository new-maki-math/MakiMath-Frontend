<script>
let openCard;
</script>

<script setup>
import { inject, onBeforeUnmount, onDeactivated, ref, shallowRef, useId, watch } from 'vue';

import { canUseAi } from '../../utils/ai-access.js';
import AiCardComposer from '../../views/ai-lab/AiCardComposer.vue';

const props = defineProps({
  reference: {
    type: String,
    default: ''
  }
});

const gradientId = `ai-badge-${useId()}`;
const active = inject('ai-card-glow', ref(false));
const button = ref(null);
const panel = ref(null);
const sheetPosition = shallowRef(null);
const cardVisible = ref(true);
let positionFrame = 0;
let cardVisibilityObserver;

function followCard() {
  const card = button.value?.closest('[data-ai-card]');
  if (!card?.isConnected) {
    stopFollowingCard();
    return;
  }
  const { bottom, left, width } = card.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
  const panelHeight = panel.value?.offsetHeight || 128;
  const top = Math.min(bottom, Math.max(viewportTop, viewportBottom - panelHeight - 12));
  const next = {
    top: `${top}px`,
    left: `${left + Math.max(0, (width - 800) / 2)}px`,
    width: `${Math.min(width, 800)}px`
  };
  const previous = sheetPosition.value;
  if (
    !previous ||
    next.top !== previous.top ||
    next.left !== previous.left ||
    next.width !== previous.width
  ) {
    sheetPosition.value = next;
  }
  positionFrame = requestAnimationFrame(followCard);
}

function stopFollowingCard() {
  cancelAnimationFrame(positionFrame);
  positionFrame = 0;
  cardVisibilityObserver?.disconnect();
  cardVisibilityObserver = undefined;
}

function toggle() {
  if (!canUseAi.value) {
    return;
  }
  if (active.value) {
    close();
    return;
  }
  if (openCard) {
    openCard.value = false;
  }
  openCard = active;
  active.value = true;
}

function close() {
  active.value = false;
  button.value?.focus({
    preventScroll: true
  });
}

function releaseCard() {
  if (openCard === active) {
    openCard = undefined;
  }
}

watch(active, (value) => {
  if (value) {
    stopFollowingCard();
    cardVisible.value = true;
    const card = button.value?.closest('[data-ai-card]');
    if (card && typeof IntersectionObserver !== 'undefined') {
      cardVisibilityObserver = new IntersectionObserver(([entry]) => {
        cardVisible.value = entry.isIntersecting;
      });
      cardVisibilityObserver.observe(card);
    }
    followCard();
  } else {
    releaseCard();
  }
});
watch(
  () => props.reference,
  () => {
    active.value = false;
  }
);
watch(canUseAi, (allowed) => {
  if (!allowed) {
    active.value = false;
    stopFollowingCard();
  }
});
onBeforeUnmount(() => {
  releaseCard();
  stopFollowingCard();
});
onDeactivated(() => {
  active.value = false;
  stopFollowingCard();
});
</script>

<template>
  <button
    v-if="canUseAi"
    ref="button"
    type="button"
    class="ai-badge"
    :aria-label="active ? '关闭 AI 提问' : '向 AI 提问'"
    :title="active ? '关闭 AI 提问' : '向 AI 提问'"
    :aria-expanded="active"
    @click.stop="toggle"
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          :id="gradientId"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="#f472b6"
          />
          <stop
            offset="0.5"
            stop-color="#a78bfa"
          />
          <stop
            offset="1"
            stop-color="#38bdf8"
          />
        </linearGradient>
      </defs>
      <path
        :fill="`url(#${gradientId})`"
        d="M12 2.5 14.1 8.9 20.5 11l-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1zm7 12.5 1.1 3.4 3.4 1.1-3.4 1.1L19 24l-1.1-3.4-3.4-1.1 3.4-1.1z"
      />
    </svg>
    <span>AI</span>
  </button>
  <Teleport
    v-if="canUseAi"
    to="body"
  >
    <div
      v-show="cardVisible"
      class="ai-card-sheet-viewport"
      :style="sheetPosition"
    >
      <Transition
        name="ai-card-sheet"
        @after-leave="stopFollowingCard"
      >
        <section
          v-if="active && sheetPosition"
          ref="panel"
          class="ai-card-sheet"
          role="dialog"
          aria-label="卡片 AI 提问"
          @keydown.esc.stop.prevent="close"
        >
          <AiCardComposer
            :reference="reference"
            @sent="active = false"
          />
        </section>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.ai-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: #a78bfa;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  user-select: none;
}
.ai-badge:hover,
.ai-badge[aria-expanded='true'] {
  background: var(--bg-hover);
}
.ai-badge:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
@media print {
  .ai-badge,
  .ai-card-sheet {
    display: none;
  }
}
.ai-card-sheet-viewport {
  position: fixed;
  z-index: 100;
}
.ai-card-sheet-viewport:has(.ai-card-sheet-enter-active, .ai-card-sheet-leave-active) {
  clip-path: inset(0 -24px -24px);
}
.ai-card-sheet {
  padding-top: calc(1em + 12px);
  outline: none;
}
.ai-card-sheet-enter-active {
  transition: transform 280ms var(--ease-emphasized);
}
.ai-card-sheet-leave-active {
  transition: transform 220ms var(--ease-smooth);
}
.ai-card-sheet-enter-from,
.ai-card-sheet-leave-to {
  transform: translateY(calc(-100% - 1em - 16px));
}
@media (prefers-reduced-motion: reduce) {
  .ai-card-sheet-enter-active,
  .ai-card-sheet-leave-active {
    transition: none;
  }
}
</style>
