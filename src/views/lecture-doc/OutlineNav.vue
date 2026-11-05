<script setup>
import { computed, nextTick, onBeforeUpdate, onMounted, ref, watch } from 'vue';

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  activeKey: {
    type: String,
    default: ''
  }
});
const emit = defineEmits(['select']);
const track = ref(null);
const headerLabel = ref(null);
const labels = new Map();
const rows = new Map();
const barTop = ref(0);
const barHeight = ref(20);
const visibleItems = computed(() => props.items.filter((item) => item.level !== 1));
const baseLevel = computed(() =>
  visibleItems.value.length ? Math.min(...visibleItems.value.map((item) => item.level)) : 1
);
const titleItem = computed(() => {
  const index = props.items.findIndex((item) => item.key === props.activeKey);
  return (
    props.items.slice(0, index < 0 ? 1 : index + 1).findLast((item) => item.level === 1) ||
    props.items.find((item) => item.level === 1) ||
    null
  );
});
const activeIsVisible = computed(() =>
  visibleItems.value.some((item) => item.key === props.activeKey)
);

function setLabel(key, element) {
  if (element) {
    labels.set(key, element);
  }
}
function setRow(key, element) {
  if (element) {
    rows.set(key, element);
  }
}
onBeforeUpdate(() => {
  labels.clear();
  rows.clear();
});

function accessibleTitle(item) {
  return (item.element.innerText || item.element.textContent || '').replace(/\s+/g, ' ').trim();
}

function renderLabel(item, label) {
  if (!item || !label) {
    return;
  }
  const clone = item.element.cloneNode(true);
  for (const element of clone.querySelectorAll(
    'script, style, iframe, object, embed, input, button, a'
  )) {
    element.replaceWith(document.createTextNode(element.textContent || ''));
  }
  for (const element of clone.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      if (
        /^on/i.test(attribute.name) ||
        ['id', 'href', 'src', 'srcdoc', 'tabindex'].includes(attribute.name.toLowerCase())
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  label.replaceChildren(...clone.childNodes);
}

function renderLabels() {
  renderLabel(titleItem.value, headerLabel.value);
  for (const item of visibleItems.value) {
    renderLabel(item, labels.get(item.key));
  }
}

function updateBar() {
  const row = rows.get(props.activeKey);
  if (!row || !track.value) {
    return;
  }
  barTop.value = row.offsetTop;
  barHeight.value = row.offsetHeight;
  const scroll = track.value;
  if (row.offsetTop < scroll.scrollTop) {
    scroll.scrollTop = row.offsetTop;
  } else if (row.offsetTop + row.offsetHeight > scroll.scrollTop + scroll.clientHeight) {
    scroll.scrollTop = row.offsetTop + row.offsetHeight - scroll.clientHeight;
  }
}

async function refresh() {
  await nextTick();
  renderLabels();
  updateBar();
}
watch(() => props.items, refresh, {
  flush: 'post'
});
watch(() => props.activeKey, refresh, {
  flush: 'post'
});
onMounted(refresh);
</script>

<template>
  <nav
    class="outline-timeline"
    aria-label="本节大纲"
  >
    <div class="timeline-header font-mono">OUTLINE</div>
    <button
      v-if="titleItem"
      class="timeline-title"
      type="button"
      :title="accessibleTitle(titleItem)"
      :aria-label="accessibleTitle(titleItem)"
      @click="emit('select', titleItem)"
    >
      <span
        ref="headerLabel"
        class="timeline-label"
        aria-hidden="true"
      ></span>
    </button>
    <div
      ref="track"
      class="timeline-scroll"
    >
      <div class="timeline-track">
        <span
          class="track-rail"
          aria-hidden="true"
        ></span>
        <span
          v-if="activeIsVisible"
          class="track-active-bar"
          :style="{
            transform: `translateY(${barTop}px)`,
            height: `${barHeight}px`
          }"
          aria-hidden="true"
        ></span>
        <div
          v-for="item in visibleItems"
          :key="item.key"
          :ref="(element) => setRow(item.key, element)"
          class="timeline-item-row"
          :style="{
            paddingLeft: `${Math.min(Math.max(item.level - baseLevel, 0), 4) * 12}px`
          }"
        >
          <button
            type="button"
            class="timeline-item"
            :class="{
              active: item.key === activeKey
            }"
            :title="accessibleTitle(item)"
            :aria-label="accessibleTitle(item)"
            :aria-current="item.key === activeKey ? 'location' : undefined"
            @click="emit('select', item)"
          >
            <span
              :ref="(element) => setLabel(item.key, element)"
              class="timeline-label"
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.outline-timeline {
  box-sizing: border-box;
  width: 194px;
  min-width: 0;
  color: var(--text-secondary);
}
.timeline-header {
  padding-left: 14px;
  margin-bottom: 12px;
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 1px;
}
.timeline-title {
  display: block;
  width: 100%;
  padding-top: 0;
  padding-left: 14px;
  padding-right: 0;
  padding-bottom: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  margin-bottom: 12px;
  text-align: left;
  cursor: pointer;
}
.timeline-scroll {
  max-height: calc(100vh - 180px);
  overflow: auto;
}
.timeline-track {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 14px;
}
.track-rail {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 1px;
  background: var(--border-subtle);
}
.track-active-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: var(--accent-primary);
  transition:
    transform 160ms ease,
    height 160ms ease;
}
.timeline-item {
  display: block;
  width: 100%;
  min-width: 0;
  border: 0;
  padding: 2px 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.timeline-item:hover {
  color: var(--text-secondary);
}
.timeline-item.active {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}
.timeline-item:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
.timeline-label {
  display: block;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 1200px) {
  .outline-timeline {
    display: none;
  }
}
@media print {
  .outline-timeline {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .track-active-bar {
    transition: none;
  }
}
</style>
