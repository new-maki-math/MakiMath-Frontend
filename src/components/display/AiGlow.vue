<script setup>
import { computed, ref, useId, watch } from 'vue';

defineProps({
  active: { type: Boolean, default: false },
  trace: { type: Boolean, default: false },
  fullRing: { type: Boolean, default: false },
  tag: { type: String, default: 'div' }
});

const perimeter = ref(null);
const size = ref({ width: 0, height: 0, radius: 0 });
const gradientId = `ai-gradient-${useId()}`;
const outsideId = `${gradientId}-outside`;
const insideId = `${gradientId}-inside`;
const haloId = `${gradientId}-halo`;
const rotatingGradientId = `${gradientId}-rotating`;

watch(perimeter, (node, _previous, onCleanup) => {
  if (!node) {
    return;
  }
  const observer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const radius = Math.min(
      parseFloat(getComputedStyle(node).borderTopRightRadius) || 0,
      width / 2,
      height / 2
    );
    size.value = { width, height, radius };
  });
  observer.observe(node);
  onCleanup(() => observer.disconnect());
});

const outline = computed(() => {
  const { width, height, radius } = size.value;
  if (!width || !height) {
    return '';
  }
  const corner = `A ${radius} ${radius} 0 0 1`;
  return [
    `M ${width - radius} 0`,
    `${corner} ${width} ${radius}`,
    `V ${height - radius}`,
    `${corner} ${width - radius} ${height}`,
    `H ${radius}`,
    `${corner} 0 ${height - radius}`,
    `V ${radius}`,
    `${corner} ${radius} 0`,
    'Z'
  ].join(' ');
});
const gradientLength = computed(() => Math.hypot(size.value.width, size.value.height));
const center = computed(() => `${size.value.width / 2} ${size.value.height / 2}`);
const outside = computed(() => {
  const { width, height } = size.value;
  return `M -48 -48 H ${width + 48} V ${height + 48} H -48 Z ${outline.value}`;
});
</script>

<template>
  <component
    :is="tag"
    class="ai-glow"
    :class="{ 'is-active': active, 'is-trace': trace || fullRing }"
  >
    <div
      v-if="active && (trace || fullRing)"
      ref="perimeter"
      class="ai-glow-perimeter"
      aria-hidden="true"
    >
      <svg v-if="outline" class="ai-glow-outline">
        <defs>
          <linearGradient
            :id="gradientId"
            gradientUnits="userSpaceOnUse"
            :x1="(size.width - gradientLength) / 2"
            :x2="(size.width + gradientLength) / 2"
          >
            <stop offset="0" stop-color="#f472b6" />
            <stop offset=".25" stop-color="#a78bfa" />
            <stop offset=".5" stop-color="#60a5fa" />
            <stop offset=".75" stop-color="#2dd4bf" />
            <stop offset="1" stop-color="#fbbf24" />
          </linearGradient>
          <linearGradient
            :id="rotatingGradientId"
            :href="`#${gradientId}`"
          >
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              :from="`0 ${center}`"
              :to="`${fullRing ? -360 : 360} ${center}`"
              dur="3s"
              repeatCount="indefinite"
            />
          </linearGradient>
          <clipPath :id="outsideId">
            <path :d="outside" clip-rule="evenodd" />
          </clipPath>
          <clipPath :id="insideId">
            <path :d="outline" />
          </clipPath>
          <g :id="haloId">
            <path
              class="ai-glow-halo is-rotating"
              :class="fullRing ? 'is-full-ring' : 'is-tracing'"
              :d="outline"
              :stroke="`url(#${rotatingGradientId})`"
              pathLength="100"
            />
            <path
              class="ai-glow-halo"
              :class="fullRing ? ['is-static', 'is-full-ring'] : 'is-static'"
              :d="outline"
              :stroke="`url(#${gradientId})`"
            />
          </g>
        </defs>
        <use :href="`#${haloId}`" :clip-path="`url(#${outsideId})`" />
        <use :href="`#${haloId}`" :clip-path="`url(#${insideId})`" opacity="0.18" />
        <path
          class="ai-glow-edge is-rotating"
          :class="{ 'is-tracing': !fullRing }"
          :d="outline"
          :stroke="`url(#${rotatingGradientId})`"
          pathLength="100"
        />
        <path
          class="ai-glow-edge is-static"
          :d="outline"
          :stroke="`url(#${gradientId})`"
        />
      </svg>
    </div>
    <slot />
  </component>
</template>

<style scoped>
@property --ai-glow-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
.ai-glow {
  position: relative;
  isolation: isolate;
}
.ai-glow.is-active:not(.is-trace) {
  border-color: transparent;
  background:
    linear-gradient(var(--ai-glow-surface, var(--bg-surface)), var(--ai-glow-surface, var(--bg-surface))) padding-box,
    conic-gradient(from var(--ai-glow-angle), #f472b6, #a78bfa, #60a5fa, #2dd4bf, #fbbf24, #f472b6) border-box;
  animation: ai-glow-flow 5s linear infinite;
}
.ai-glow.is-active:not(.is-trace)::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -7px;
  border-radius: inherit;
  background: conic-gradient(from var(--ai-glow-angle), #f472b6, #a78bfa, #60a5fa, #2dd4bf, #fbbf24, #f472b6);
  filter: blur(14px);
  opacity: 0.3;
  pointer-events: none;
  animation: ai-glow-flow 5s linear infinite;
}
.ai-glow.is-active:not(.is-trace)::after {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 1px;
  border-radius: inherit;
  background: var(--ai-glow-surface, var(--bg-surface));
  pointer-events: none;
}
.ai-glow-perimeter {
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
.ai-glow-outline {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.ai-glow-halo {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
  opacity: 0.62;
  filter: blur(5px);
}
.ai-glow-edge {
  fill: none;
  stroke-width: 1.5;
  stroke-linecap: round;
  opacity: 0.85;
}
.ai-glow-halo.is-tracing,
.ai-glow-edge.is-tracing {
  animation: ai-glow-clockwise 1.1s var(--ease-standard, ease-out) backwards;
}
.ai-glow-halo.is-static,
.ai-glow-edge.is-static {
  display: none;
}
.ai-glow-halo.is-full-ring {
  opacity: 0.75;
  filter: blur(6px);
}
@keyframes ai-glow-flow {
  from { --ai-glow-angle: 0deg; }
  to { --ai-glow-angle: 360deg; }
}
@keyframes ai-glow-clockwise {
  from {
    stroke-dasharray: 0 100;
  }
  to {
    stroke-dasharray: 100 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ai-glow.is-active:not(.is-trace),
  .ai-glow.is-active:not(.is-trace)::before {
    animation: none;
  }
  .ai-glow-halo.is-rotating,
  .ai-glow-edge.is-rotating {
    display: none;
  }
  .ai-glow-halo.is-static,
  .ai-glow-edge.is-static {
    display: block;
  }
}
@media print {
  .ai-glow.is-active:not(.is-trace) {
    background: var(--bg-surface);
    border-color: var(--border-subtle);
    animation: none;
  }
  .ai-glow.is-active:not(.is-trace)::before,
  .ai-glow.is-active:not(.is-trace)::after,
  .ai-glow-perimeter {
    display: none;
  }
}
</style>
