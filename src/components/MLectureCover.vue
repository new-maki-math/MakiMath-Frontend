<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';

import { lectureApi } from '../api/lectures.js';
import { authStatus, currentUser } from '../utils/auth.js';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  showCaption: {
    type: Boolean,
    default: true
  },
  coverRevisionId: {
    type: [String, Number],
    default: ''
  },
  coverHash: {
    type: String,
    default: ''
  },
  hasCover: {
    type: Boolean,
    default: false
  }
});
const remoteCover = ref('');
const coverSource = computed(() => props.image || remoteCover.value);
const loadedCover = ref('');
watch(
  coverSource,
  () => {
    loadedCover.value = '';
  },
  {
    flush: 'sync'
  }
);
function showCover(event) {
  const source = event.currentTarget.getAttribute('src');
  if (source === coverSource.value) {
    loadedCover.value = source;
  }
}
let sequence = 0;
watch(
  () => [
    props.image,
    props.coverRevisionId,
    props.coverHash,
    props.hasCover,
    authStatus.value,
    currentUser.value?.id
  ],
  async () => {
    const current = ++sequence;
    remoteCover.value = '';
    if (props.image || !props.hasCover || !props.coverRevisionId) {
      return;
    }
    try {
      const id = props.coverRevisionId;
      const result = await lectureApi.getCover(id, props.coverHash);
      if (
        current === sequence &&
        String(result.revision_id) === String(id) &&
        typeof result.cover === 'string'
      ) {
        remoteCover.value = result.cover;
      }
    } catch (error) {
      if (current === sequence) {
        console.warn('[讲义封面] 读取失败', error);
      }
    }
  },
  {
    immediate: true
  }
);
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <button
    class="lecture-cover"
    type="button"
    :aria-label="title"
    :title="title"
  >
    <svg
      class="cover-art"
      viewBox="0 0 210 297"
      aria-hidden="true"
    >
      <rect
        width="210"
        height="297"
        class="cover-background"
      />
      <rect
        width="7"
        height="297"
        class="cover-spine"
      />
      <path
        d="M25 29h160 M25 263h160"
        class="cover-rule"
      />
      <text
        x="25"
        y="23"
        class="cover-brand"
      >
        MAKI / MATH
      </text>
      <text
        x="185"
        y="23"
        text-anchor="end"
        class="cover-index"
      >
        LECTURE NOTES
      </text>
      <g class="cover-grid">
        <path d="M38 65v152 M65 65v152 M92 65v152 M119 65v152 M146 65v152 M173 65v152" />
        <path d="M38 65h135 M38 92h135 M38 119h135 M38 146h135 M38 173h135 M38 200h135" />
      </g>
      <path
        d="M43 192 L69 171 L96 178 L122 129 L148 139 L173 91"
        class="cover-graph"
      />
      <circle
        cx="69"
        cy="171"
        r="3"
        class="cover-dot"
      />
      <circle
        cx="122"
        cy="129"
        r="3"
        class="cover-dot"
      />
      <circle
        cx="173"
        cy="91"
        r="3"
        class="cover-dot"
      />
      <text
        x="25"
        y="277"
        class="cover-footer"
      >
        KNOWLEDGE / PRACTICE
      </text>
      <text
        x="185"
        y="277"
        text-anchor="end"
        class="cover-footer"
      >
        ∑
      </text>
    </svg>
    <img
      v-if="coverSource"
      :key="coverSource"
      class="cover-image"
      :class="{
        'is-loaded': loadedCover === coverSource
      }"
      :src="coverSource"
      alt=""
      @load="showCover"
    />
    <span
      v-if="showCaption"
      class="cover-caption"
    >
      <span class="cover-title">{{ title }}</span>
      <span
        v-if="subtitle"
        class="cover-subtitle-wrap"
        ><span class="cover-subtitle">{{ subtitle }}</span></span
      >
    </span>
  </button>
</template>

<style scoped>
.lecture-cover {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 210 / 297;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  background: var(--bg-surface);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 180ms ease;
}
.lecture-cover:hover,
.lecture-cover:focus-visible {
  border-color: var(--accent-primary);
}
.lecture-cover:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
.cover-image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 240ms ease;
}
.cover-image.is-loaded {
  opacity: 1;
}
.cover-art {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.cover-background {
  fill: var(--bg-surface);
}
.cover-spine {
  fill: var(--accent-primary);
}
.cover-rule {
  fill: none;
  stroke: var(--border-hover);
  stroke-width: 0.8;
}
.cover-brand,
.cover-index,
.cover-footer {
  fill: var(--text-secondary);
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  letter-spacing: 0.4px;
}
.cover-brand {
  fill: var(--text-primary);
  font-weight: 600;
}
.cover-grid {
  fill: none;
  stroke: var(--border-subtle);
  stroke-width: 0.65;
}
.cover-graph {
  fill: none;
  stroke: var(--accent-primary);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cover-dot {
  fill: var(--accent-primary);
}
.cover-caption {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  flex-direction: column;
  max-height: 55%;
  padding: 12px 14px;
  overflow: hidden;
  background: var(--bg-surface);
  background: color-mix(in srgb, var(--bg-surface) 78%, transparent);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-subtle);
  transition: background-color 180ms ease;
}
.lecture-cover:hover .cover-caption,
.lecture-cover:focus-visible .cover-caption {
  background: var(--bg-elevated);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
}
.cover-title,
.cover-subtitle {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
}
.cover-title {
  -webkit-line-clamp: 3;
  font-size: var(--font-size);
  font-weight: var(--font-weight-semibold);
  line-height: 1.45;
}
.cover-subtitle-wrap {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 180ms ease,
    opacity 180ms ease;
}
.cover-subtitle {
  min-height: 0;
  -webkit-line-clamp: 2;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  line-height: 1.45;
}
.lecture-cover:hover .cover-subtitle-wrap,
.lecture-cover:focus-visible .cover-subtitle-wrap {
  grid-template-rows: 1fr;
  opacity: 1;
}
.lecture-cover:hover .cover-subtitle,
.lecture-cover:focus-visible .cover-subtitle {
  padding-top: 5px;
}
@media (prefers-reduced-motion: reduce) {
  .lecture-cover,
  .cover-image,
  .cover-caption,
  .cover-subtitle-wrap {
    transition: none;
  }
}
@media (hover: none) {
  .cover-subtitle-wrap {
    grid-template-rows: 1fr;
    opacity: 1;
  }
  .cover-subtitle {
    padding-top: 5px;
  }
}
</style>
