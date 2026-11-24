<script setup>
import 'viewerjs/dist/viewer.css';

import Viewer from 'viewerjs';
import { computed, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';

import { Download, Xmark, ZoomIn, ZoomOut } from '../../components/icons/icons.js';

const props = defineProps({
  src: {
    type: String,
    default: ''
  },
  filename: {
    type: String,
    default: ''
  }
});
const emit = defineEmits(['close']);
const source = ref('');
const image = ref(null);
const closeButton = ref(null);
const zoom = ref(100);
let viewer;
let previousFocus;
let generation = 0;
let zoomFrame = 0;
let targetRatio = null;
let zoomPivot = null;
let lastZoomTime = 0;
const downloadName = computed(() => {
  if (props.filename) {
    return props.filename;
  }
  const type = /^data:image\/(png|jpeg|webp|gif)/i.exec(source.value)?.[1]?.toLowerCase();
  return `image.${type === 'jpeg' ? 'jpg' : type || 'png'}`;
});

function onKeydown(event) {
  if (props.src && event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('close');
  }
}
function reset() {
  stopZoom();
  viewer?.reset();
}
function stopZoom() {
  cancelAnimationFrame(zoomFrame);
  zoomFrame = 0;
  targetRatio = null;
  lastZoomTime = 0;
}
function animateZoom(time) {
  if (!viewer?.viewed || targetRatio === null) {
    stopZoom();
    return;
  }
  const current = viewer.imageData.ratio;
  const elapsed = lastZoomTime ? Math.min(time - lastZoomTime, 50) : 16;
  lastZoomTime = time;
  const next = current + (targetRatio - current) * (1 - Math.exp(-elapsed / 65));
  const done = Math.abs(next - targetRatio) < targetRatio * 0.001;
  viewer.zoomTo(done ? targetRatio : next, false, zoomPivot);
  if (done) {
    stopZoom();
  } else {
    zoomFrame = requestAnimationFrame(animateZoom);
  }
}
function zoomBy(amount) {
  stopZoom();
  viewer?.zoom(amount);
}
function onWheel(event) {
  if (!viewer?.viewed || !viewer.imageData) {
    return;
  }
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1);
  const bounds = viewer.viewer.getBoundingClientRect();
  zoomPivot = {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top
  };
  targetRatio = Math.min(
    10,
    Math.max(
      0.05,
      (targetRatio ?? viewer.imageData.ratio) *
        Math.exp(-Math.max(-120, Math.min(120, delta)) * 0.003)
    )
  );
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    viewer.zoomTo(targetRatio, false, zoomPivot);
    stopZoom();
  } else if (!zoomFrame) {
    zoomFrame = requestAnimationFrame(animateZoom);
  }
}
function destroyViewer() {
  if (!props.src) {
    viewer?.destroy();
    viewer = undefined;
    source.value = '';
  }
}
watch(
  () => props.src,
  async (src) => {
    const current = ++generation;
    stopZoom();
    if (!src) {
      previousFocus?.focus?.();
      previousFocus = null;
      return;
    }
    viewer?.destroy();
    viewer = undefined;
    source.value = src;
    zoom.value = 100;
    previousFocus = document.activeElement;
    await nextTick();
    if (current !== generation || !image.value) {
      return;
    }
    closeButton.value?.focus();
    viewer = new Viewer(image.value, {
      inline: true,
      button: false,
      navbar: false,
      title: false,
      toolbar: false,
      tooltip: false,
      movable: true,
      zoomable: true,
      zoomOnWheel: false,
      transition: false,
      zoomRatio: 0.1,
      minZoomRatio: 0.05,
      maxZoomRatio: 10,
      viewed(event) {
        const displayed = event.detail.image;
        if (displayed.naturalWidth) {
          zoom.value = Math.round((displayed.width / displayed.naturalWidth) * 100);
        }
      },
      zoom(event) {
        zoom.value = Math.round(event.detail.ratio * 100);
      }
    });
  }
);
onMounted(() => window.addEventListener('keydown', onKeydown, true));
onDeactivated(() => {
  if (props.src) {
    emit('close');
  }
});
onBeforeUnmount(() => {
  generation++;
  stopZoom();
  window.removeEventListener('keydown', onKeydown, true);
  viewer?.destroy();
});
</script>

<template>
  <Teleport to="body">
    <Transition
      name="image-viewer-motion"
      @after-leave="destroyViewer"
    >
      <div
        v-if="src"
        class="image-viewer-backdrop"
        @click.self="emit('close')"
      >
        <section
          class="image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
        >
          <div class="image-viewer-toolbar">
            <button
              type="button"
              aria-label="缩小"
              title="缩小"
              @click="zoomBy(-0.2)"
            >
              <ZoomOut
                width="20"
                height="20"
              />
            </button>
            <button
              type="button"
              class="image-viewer-zoom"
              title="重置大小和位置"
              @click="reset"
            >
              {{ zoom }}%
            </button>
            <button
              type="button"
              aria-label="放大"
              title="放大"
              @click="zoomBy(0.2)"
            >
              <ZoomIn
                width="20"
                height="20"
              />
            </button>
            <a
              :href="source"
              :download="downloadName"
              aria-label="下载图片"
              title="下载图片"
              ><Download
                width="20"
                height="20"
            /></a>
            <button
              ref="closeButton"
              type="button"
              aria-label="关闭预览"
              title="关闭预览"
              @click="emit('close')"
            >
              <Xmark
                width="20"
                height="20"
              />
            </button>
          </div>
          <div
            class="image-viewer-canvas"
            @pointerdown.capture="stopZoom"
            @wheel.capture.prevent.stop="onWheel"
          >
            <img
              ref="image"
              :src="source"
              alt="图片预览"
            />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.image-viewer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 65%);
}
.image-viewer {
  display: flex;
  flex-direction: column;
  width: min(1100px, 100%);
  height: min(780px, 88dvh);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: #141414;
  color: white;
  box-shadow: 0 12px 40px rgb(0 0 0 / 35%);
}
.image-viewer-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
}
.image-viewer-toolbar button,
.image-viewer-toolbar a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
.image-viewer-toolbar button:hover,
.image-viewer-toolbar a:hover {
  background: rgb(255 255 255 / 14%);
}
.image-viewer-toolbar :is(button, a):focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
}
.image-viewer-zoom {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.image-viewer-canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.image-viewer-canvas > img {
  display: none;
}
.image-viewer-canvas :deep(.viewer-container) {
  background: transparent;
}
.image-viewer-motion-enter-active,
.image-viewer-motion-leave-active {
  transition: opacity 180ms var(--ease-standard);
}
.image-viewer-motion-enter-active .image-viewer,
.image-viewer-motion-leave-active .image-viewer {
  transition:
    transform 180ms var(--ease-layout),
    opacity 180ms var(--ease-standard);
}
.image-viewer-motion-enter-from,
.image-viewer-motion-leave-to {
  opacity: 0;
}
.image-viewer-motion-enter-from .image-viewer,
.image-viewer-motion-leave-to .image-viewer {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .image-viewer-motion-enter-active,
  .image-viewer-motion-leave-active,
  .image-viewer-motion-enter-active .image-viewer,
  .image-viewer-motion-leave-active .image-viewer {
    transition: none;
  }
}
</style>
