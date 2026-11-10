<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { NavArrowLeft, NavArrowRight } from '../icons/icons.js';

const props = defineProps({
  bookHeight: { type: Number, default: 0 }
});
const emit = defineEmits(['book-height-change']);
const shelfAnimations = new Map();
const shelfRef = ref(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
const stackIndex = ref(0);
const itemCount = ref(0);
const visibleCount = ref(4);
const stacked = ref(false);
let resizeObserver;
let mutationObserver;
let wheelDistance = 0;
let lastWheelTime = 0;
let touchStart = null;
let touchOffsets = null;
let touchDistance = 0;

function updateEdges() {
  const shelf = shelfRef.value;
  if (!shelf) return;
  const items = [...shelf.children];
  itemCount.value = items.length;
  const gap = window.matchMedia('(max-width: 480px)').matches ? 14 : 24;
  const availableForTwo = Math.max(0, (shelf.clientWidth - 40 - gap) / 2);
  let bookHeight = props.bookHeight || Math.min(Math.max(0, shelf.clientHeight - 10), 275, availableForTwo * 297 / 210);
  if (!props.bookHeight && shelf.clientWidth > 0 && bookHeight > 0) {
    const availableWidth = shelf.clientWidth - 40;
    const currentCount = Math.max(2, Math.floor((availableWidth + gap) / (bookHeight * 210 / 297 + gap)));
    const nextCount = currentCount + 1;
    const heightForNext = (availableWidth - gap * (nextCount - 1)) / nextCount * 297 / 210;
    if (items.length >= nextCount && heightForNext >= bookHeight * 0.85) {
      bookHeight = Math.min(bookHeight, heightForNext);
    }
  }
  if (!props.bookHeight && bookHeight > 0) emit('book-height-change', bookHeight);
  if (bookHeight > 0) shelf.style.setProperty('--shelf-book-height', `${bookHeight}px`);
  const step = bookHeight * 210 / 297 + gap;
  if (shelf.clientWidth > 0 && bookHeight > 0) {
    visibleCount.value = Math.max(2, Math.floor((shelf.clientWidth - 40 + gap) / step + 0.0001));
  }
  const lastSlot = visibleCount.value - 1;
  stacked.value = items.length > visibleCount.value;
  if (stacked.value && shelf.scrollLeft) shelf.scrollLeft = 0;
  stackIndex.value = Math.max(0, Math.min(stackIndex.value, items.length - visibleCount.value));
  items.forEach((item, index) => {
    const relative = index - stackIndex.value;
    const behind = stacked.value && (relative < 0 || relative > lastSlot);
    item.inert = behind;
    item.toggleAttribute('data-shelf-covered', behind);
    if (stacked.value) {
      const slot = Math.max(0, Math.min(lastSlot, relative));
      const depth = behind ? Math.min(Math.abs(relative < 0 ? relative : relative - lastSlot), 3) : 0;
      const scale = 1 - depth * 0.04;
      const offset = relative < 0 ? -depth * 6 : relative > lastSlot ? depth * 6 + bookHeight * (1 - scale) * 210 / 297 : 0;
      item.style.position = 'absolute';
      item.style.bottom = '0';
      item.style.left = `${20 + slot * step + offset}px`;
      item.style.margin = '0';
      item.style.zIndex = behind ? String(4 - depth) : '5';
      item.style.height = `${bookHeight * scale}px`;
    } else {
      for (const property of ['position', 'bottom', 'left', 'height', 'margin', 'z-index']) {
        item.style.removeProperty(property);
      }
    }
  });
  canScrollLeft.value = shelf.scrollLeft > 1;
  canScrollRight.value = shelf.scrollLeft < shelf.scrollWidth - shelf.clientWidth - 1;
}

function scrollPage(direction, { duration = 380 } = {}) {
  const shelf = shelfRef.value;
  if (!shelf) return;
  stopShelfAnimation(shelf);
  if (stacked.value) {
    const nextIndex = Math.max(0, Math.min(itemCount.value - visibleCount.value, stackIndex.value + direction));
    if (nextIndex === stackIndex.value) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previous = new Map();
    if (!reduceMotion) {
      for (const item of shelf.children) {
        const cover = item.matches('.lecture-cover') ? item : item.querySelector('.lecture-cover');
        previous.set(item, {
          bounds: item.getBoundingClientRect(),
          filter: getComputedStyle(item).filter,
          covered: item.hasAttribute('data-shelf-covered'),
          cover,
          shadow: cover ? getComputedStyle(cover).boxShadow : ''
        });
        item.getAnimations().forEach((animation) => animation.cancel());
        cover?.getAnimations().forEach((animation) => animation.cancel());
      }
    }
    stackIndex.value = nextIndex;
    for (const item of shelf.children) item.style.removeProperty('transform');
    updateEdges();
    if (!reduceMotion) {
      const animationOptions = { duration, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' };
      const enteringIndex = direction > 0 ? nextIndex + visibleCount.value - 1 : nextIndex;
      for (const [index, item] of [...shelf.children].entries()) {
        const before = previous.get(item);
        const after = item.getBoundingClientRect();
        const offset = before ? before.bounds.left - after.left : 0;
        const covered = item.hasAttribute('data-shelf-covered');
        if (offset || (before && (before.bounds.height !== after.height || before.covered !== covered))) {
          if (index === enteringIndex) item.style.zIndex = '4';
          const animation = item.animate([
            { transform: `translateX(${offset}px)`, height: `${before?.bounds.height ?? after.height}px`, filter: before?.filter || 'none' },
            { transform: 'translateX(0)', height: `${after.height}px`, filter: covered ? 'brightness(0.82)' : 'brightness(1)' }
          ], animationOptions);
          if (before?.cover && before.covered !== covered) {
            const shadow = covered
              ? '0 2px 4px color-mix(in srgb, var(--shadow-color-subtle) 45%, transparent)'
              : '1px 0 3px var(--shadow-color-subtle), 0 3px 8px var(--shadow-color-subtle)';
            before.cover.animate([{ boxShadow: before.shadow }, { boxShadow: shadow }], animationOptions);
          }
          if (index === enteringIndex) {
            animation.finished.catch(() => {}).finally(() => {
              if (stackIndex.value === nextIndex && item.isConnected) item.style.zIndex = '5';
            });
          }
        }
      }
    }
    return;
  }
  const items = [...shelf.children];
  const current = shelf.scrollLeft;
  const target = direction > 0
    ? items.find((item) => item.offsetLeft + item.offsetWidth > current + shelf.clientWidth - 20)
    : [...items].reverse().find((item) => item.offsetLeft < current + 19);
  if (!target) return;
  shelf.scrollTo({
    left: Math.max(0, target.offsetLeft - 20),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  });
}

function stopShelfAnimation(shelf) {
  const animation = shelfAnimations.get(shelf);
  if (!animation) {
    return;
  }
  cancelAnimationFrame(animation.frame);
  shelfAnimations.delete(shelf);
}

function scrollShelf(event) {
  const shelf = event.currentTarget;
  if (event.ctrlKey || event.metaKey) {
    return;
  }
  if (stacked.value) {
    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const delta = rawDelta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? shelf.clientWidth : 1);
    const direction = Math.sign(delta);
    if (!direction || (direction < 0 && stackIndex.value === 0) || (direction > 0 && stackIndex.value + visibleCount.value >= itemCount.value)) {
      wheelDistance = 0;
      return;
    }
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheelTime > 180 || Math.sign(wheelDistance) !== direction) wheelDistance = 0;
    lastWheelTime = now;
    wheelDistance += delta;
    const steps = Math.min(2, Math.floor(Math.abs(wheelDistance) / 55));
    if (steps) {
      wheelDistance -= direction * steps * 55;
      for (let step = 0; step < steps; step++) scrollPage(direction, { duration: 240 });
    }
    return;
  }
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
    stopShelfAnimation(shelf);
    return;
  }
  const maxScroll = shelf.scrollWidth - shelf.clientWidth;
  if (maxScroll <= 0) {
    return;
  }
  event.preventDefault();
  const delta =
    event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? shelf.clientWidth : 1);
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    (event.deltaMode === 0 && Math.abs(event.deltaY) < 50)
  ) {
    stopShelfAnimation(shelf);
    shelf.scrollLeft += delta;
    return;
  }
  let animation = shelfAnimations.get(shelf);
  if (!animation) {
    animation = {
      target: shelf.scrollLeft,
      frame: 0,
      lastTime: 0
    };
    shelfAnimations.set(shelf, animation);
  }
  animation.target = Math.max(0, Math.min(maxScroll, animation.target + delta));
  if (animation.frame) {
    return;
  }
  const tick = (time) => {
    if (!shelf.isConnected) {
      stopShelfAnimation(shelf);
      return;
    }
    const elapsed = animation.lastTime ? Math.min(time - animation.lastTime, 50) : 16;
    animation.lastTime = time;
    animation.target = Math.max(
      0,
      Math.min(shelf.scrollWidth - shelf.clientWidth, animation.target)
    );
    const distance = animation.target - shelf.scrollLeft;
    if (Math.abs(distance) < 0.5) {
      shelf.scrollLeft = animation.target;
      shelfAnimations.delete(shelf);
      return;
    }
    shelf.scrollLeft += distance * (1 - Math.exp(-elapsed / 85));
    animation.frame = requestAnimationFrame(tick);
  };
  animation.frame = requestAnimationFrame(tick);
}

function onTouchStart(event) {
  const touch = event.touches[0];
  touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  touchOffsets = null;
  touchDistance = 0;
}

function onTouchMove(event) {
  if (!stacked.value || !touchStart || !event.touches[0]) return;
  const touch = event.touches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  if (!touchOffsets && (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy))) return;
  const shelf = shelfRef.value;
  if (!touchOffsets) {
    touchOffsets = new Map();
    const index = dx < 0 ? stackIndex.value : stackIndex.value + visibleCount.value - 1;
    const item = shelf.children[index];
    if (item) {
      const transform = getComputedStyle(item).transform;
      const offset = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
      touchOffsets.set(item, offset);
      item.getAnimations().forEach((animation) => animation.cancel());
    }
  }
  touchDistance = dx;
  const atEdge = (dx > 0 && stackIndex.value === 0) || (dx < 0 && stackIndex.value + visibleCount.value >= itemCount.value);
  const drag = Math.sign(dx) * Math.min(100, Math.abs(dx) * (atEdge ? 0.22 : 0.55));
  for (const [item, offset] of touchOffsets) {
    item.style.transform = `translateX(${offset + drag}px)`;
  }
}

function settleTouch() {
  if (!touchOffsets) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const item of touchOffsets.keys()) {
    const from = item.style.transform || 'translateX(0)';
    item.style.removeProperty('transform');
    if (!reduced) {
      item.animate([{ transform: from }, { transform: 'translateX(0)' }], {
        duration: 260,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
      });
    }
  }
  touchOffsets = null;
}

function onTouchEnd() {
  if (!stacked.value || !touchStart) return;
  const direction = touchDistance < 0 ? 1 : -1;
  const canMove = direction > 0 ? stackIndex.value + visibleCount.value < itemCount.value : stackIndex.value > 0;
  touchStart = null;
  if (touchOffsets && Math.abs(touchDistance) > 40 && canMove) {
    scrollPage(direction, { duration: 260 });
    touchOffsets = null;
  } else {
    settleTouch();
  }
}

function onTouchCancel() {
  touchStart = null;
  settleTouch();
}

onMounted(() => {
  resizeObserver = new ResizeObserver(updateEdges);
  resizeObserver.observe(shelfRef.value);
  mutationObserver = new MutationObserver(updateEdges);
  mutationObserver.observe(shelfRef.value, { childList: true, subtree: true });
  updateEdges();
});

watch(() => props.bookHeight, () => nextTick(updateEdges));

onUnmounted(() => {
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
  for (const shelf of shelfAnimations.keys()) {
    stopShelfAnimation(shelf);
  }
});
</script>

<template>
  <div class="shelf-frame">
    <div
      ref="shelfRef"
      class="horizontal-shelf"
      :class="{ 'is-stacked': stacked }"
      @scroll="updateEdges"
      @wheel="scrollShelf"
      @pointerdown="stopShelfAnimation($event.currentTarget)"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend.passive="onTouchEnd"
      @touchcancel.passive="onTouchCancel"
    >
      <slot />
    </div>
    <button v-if="stacked ? stackIndex > 0 : canScrollLeft" class="shelf-arrow is-left" type="button" aria-label="查看前面的图书" @click="scrollPage(-1)" >
      <NavArrowLeft width="18" height="18" />
    </button>
    <button v-if="stacked ? stackIndex + visibleCount < itemCount : canScrollRight" class="shelf-arrow is-right" type="button" aria-label="查看后面的图书" @click="scrollPage(1)">
      <NavArrowRight width="18" height="18" />
    </button>
  </div>
</template>

<style scoped>
.shelf-frame {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.horizontal-shelf {
  display: flex;
  flex: 1;
  align-items: flex-end;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  gap: 24px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  padding: 10px 20px 12px;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scroll-padding-inline: 20px;
}
.horizontal-shelf::-webkit-scrollbar {
  display: none;
}
.horizontal-shelf.is-stacked {
  position: relative;
  isolation: isolate;
  overflow: clip;
  padding-inline: 20px;
  scroll-snap-type: none;
  touch-action: pan-y;
}
.horizontal-shelf.is-stacked :deep(.lecture-cover) {
  box-shadow:
    1px 0 3px var(--shadow-color-subtle),
    0 3px 8px var(--shadow-color-subtle);
  transition: box-shadow 240ms ease, outline-color 180ms ease;
}
.horizontal-shelf.is-stacked :deep([data-shelf-covered].lecture-cover),
.horizontal-shelf.is-stacked :deep([data-shelf-covered] .lecture-cover) {
  box-shadow: 0 2px 4px color-mix(in srgb, var(--shadow-color-subtle) 45%, transparent);
}
.horizontal-shelf > * {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  scroll-snap-align: start;
  transition: filter 380ms ease;
}
.horizontal-shelf :deep([data-shelf-covered]) {
  filter: brightness(0.82);
}
.shelf-arrow {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  box-shadow: 0 2px 6px var(--shadow-color-subtle);
  cursor: pointer;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 160ms ease;
}
.shelf-arrow.is-left { left: 2px; }
.shelf-arrow.is-right { right: 2px; }
.shelf-frame:hover .shelf-arrow,
.shelf-frame:focus-within .shelf-arrow {
  opacity: 1;
}
@media (hover: none) {
  .shelf-arrow { opacity: 1; }
}
.horizontal-shelf :deep(.lecture-cover) {
  flex: 0 0 auto;
  width: auto;
  height: var(--shelf-book-height, 100%);
  max-height: 255px;
}
.horizontal-shelf :deep(.version-stack) {
  height: var(--shelf-book-height, 100%);
}
.horizontal-shelf :deep(.version-stack .lecture-cover) {
  height: 100%;
}
@media (max-width: 480px) {
  .horizontal-shelf {
    gap: 14px;
  }
}
</style>
