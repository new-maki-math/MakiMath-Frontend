<script setup>
import { select, zoom, zoomIdentity } from 'd3';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import MButton from '../../components/MButton.vue';
import {
  clearCanvasTextCache,
  drawKnowledgeCanvas,
  readCanvasPalette
} from './knowledge-canvas2d.js';

const props = defineProps({
  layout: {
    type: Object,
    required: true
  },
  mastered: {
    type: Set,
    required: true
  },
  states: {
    type: Object,
    default: () => ({})
  },
  pulse: {
    type: Boolean,
    default: false
  },
  worldSize: {
    type: Number,
    required: true
  },
  categoryId: {
    type: String,
    default: ''
  }
});
const emit = defineEmits(['activate', 'background', 'focus', 'blur']);
const surface = ref(null);
const canvas = ref(null);
const canvasKey = ref(0);
let transform = zoomIdentity;
let zoomBehavior;
let sizeObserver;
let themeObserver;
let resolutionQuery;
let width = 0;
let height = 0;
let palette;
let frame = 0;
let zoomFrame = 0;
let zoomTarget;
let fitted = false;
let disposed = false;
let drawWorker = null;
let workerBusy = false;
let workerDirty = false;
let sceneLayout = {
  groups: [],
  tiles: []
};
let sceneVersion = 0;

function updateScene() {
  if (!palette) {
    return;
  }
  const groups = props.layout.groups.map((item) => ({
    title: item.title,
    kind: item.kind,
    isLibrary: item.isLibrary,
    style: {
      ...item.style
    }
  }));
  const tiles = props.layout.tiles.map((item) => ({
    node: {
      id: item.node.id,
      title: item.node.title,
      slug: item.node.slug,
      state: props.states[item.node.id] || ''
    },
    style: {
      ...item.style
    }
  }));
  sceneLayout = {
    groups,
    tiles
  };
  drawWorker?.postMessage({
    type: 'scene',
    version: sceneVersion,
    layout: sceneLayout,
    mastered: [...props.mastered],
    palette
  });
}

function requestDraw() {
  if (!disposed && !frame) {
    frame = requestAnimationFrame(draw);
  }
}
function draw() {
  frame = 0;
  if (!canvas.value || !palette) {
    return;
  }
  if (drawWorker) {
    if (workerBusy) {
      workerDirty = true;
      return;
    }
    workerBusy = true;
    drawWorker.postMessage({
      type: 'frame',
      transform: {
        x: transform.x,
        y: transform.y,
        k: transform.k
      },
      width,
      height,
      dpr: window.devicePixelRatio || 1,
      time:
        props.pulse && !matchMedia('(prefers-reduced-motion: reduce)').matches
          ? performance.now()
          : 0
    });
  } else {
    drawKnowledgeCanvas(
      canvas.value,
      sceneLayout,
      props.mastered,
      transform,
      palette,
      width,
      height,
      window.devicePixelRatio || 1,
      props.pulse && !matchMedia('(prefers-reduced-motion: reduce)').matches ? performance.now() : 0
    );
    if (props.pulse && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      requestDraw();
    }
  }
}
function stopZoom() {
  cancelAnimationFrame(zoomFrame);
  zoomFrame = 0;
  zoomTarget = null;
}
function animateZoom() {
  if (!zoomTarget || !surface.value) {
    stopZoom();
    return;
  }
  const target = zoomTarget;
  const x = transform.x + (target.x - transform.x) * 0.2;
  const y = transform.y + (target.y - transform.y) * 0.2;
  const k = transform.k + (target.k - transform.k) * 0.2;
  const done =
    Math.abs(target.x - x) < 0.1 && Math.abs(target.y - y) < 0.1 && Math.abs(target.k - k) < 0.0001;
  const next = done
    ? target
    : {
        x,
        y,
        k
      };
  select(surface.value).call(
    zoomBehavior.transform,
    zoomIdentity.translate(next.x, next.y).scale(next.k)
  );
  if (done) {
    stopZoom();
  } else {
    zoomFrame = requestAnimationFrame(animateZoom);
  }
}
function scaleAt(factor, x, y) {
  if (!surface.value || !zoomBehavior) {
    return;
  }
  const current = zoomTarget || transform;
  const k = Math.max(0.1, Math.min(8, current.k * factor));
  const ratio = k / current.k;
  zoomTarget = {
    x: x - (x - current.x) * ratio,
    y: y - (y - current.y) * ratio,
    k
  };
  if (!zoomFrame) {
    zoomFrame = requestAnimationFrame(animateZoom);
  }
}
function onWheel(event) {
  event.preventDefault();
  const rect = surface.value.getBoundingClientRect();
  const delta =
    event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
  scaleAt(Math.exp(-delta * 0.002), event.clientX - rect.left, event.clientY - rect.top);
}
function onClick(event) {
  if (event.defaultPrevented) {
    return;
  }
  const rect = surface.value.getBoundingClientRect();
  const x = (event.clientX - rect.left - transform.x) / transform.k;
  const y = (event.clientY - rect.top - transform.y) / transform.k;
  const tile = props.layout.tiles.find((item) => {
    const left = parseFloat(item.style.left);
    const top = parseFloat(item.style.top);
    return (
      x >= left &&
      y >= top &&
      x < left + parseFloat(item.style.width) &&
      y < top + parseFloat(item.style.height)
    );
  });
  if (tile) {
    emit('activate', tile.node);
  } else {
    emit('background');
  }
}
function sourceRect(id) {
  const tile = props.layout.tiles.find((item) => item.node.id === id);
  if (!tile || !surface.value) {
    return null;
  }
  const bounds = surface.value.getBoundingClientRect();
  const left = bounds.left + transform.x + parseFloat(tile.style.left) * transform.k;
  const top = bounds.top + transform.y + parseFloat(tile.style.top) * transform.k;
  const width = parseFloat(tile.style.width) * transform.k;
  const height = parseFloat(tile.style.height) * transform.k;
  const state = props.states[id] || '';
  const known = props.mastered.has(tile.node.slug);
  const tint =
    state === 'is-prerequisite'
      ? 'before'
      : state === 'is-successor'
        ? 'after'
        : state === 'is-selected'
          ? known
            ? 'selectedMastered'
            : 'selected'
          : known
            ? 'mastered'
            : 'unmastered';
  const pulse =
    props.pulse &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches &&
    (tint === 'before' || tint === 'after')
      ? 0.65 + 0.35 * (0.5 + 0.5 * Math.sin((performance.now() * Math.PI) / 1000))
      : 1;
  const color =
    palette && pulse < 1
      ? `color-mix(in srgb, ${palette[tint]} ${pulse * 100}%, ${palette.topic})`
      : palette?.[tint];
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    fontSize: 10 * transform.k,
    titleOpacity: Math.max(0, Math.min(1, (transform.k - 0.95) / 0.25)),
    color
  };
}
function handlePan({ event, type }) {
  if (!surface.value) {
    return;
  }
  const handler = select(surface.value).on(`${type}.zoom`);
  if (!handler) {
    return;
  }
  const mapped =
    type === 'mousedown'
      ? new Proxy(event, {
          get(target, key) {
            if (key === 'currentTarget') {
              return surface.value;
            }
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          }
        })
      : event;
  handler.call(surface.value, mapped);
}
function focusTile(tile) {
  if (!surface.value || !zoomBehavior) {
    return;
  }
  stopZoom();
  const k = Math.max(transform.k, 1);
  const x = parseFloat(tile.style.left) + parseFloat(tile.style.width) / 2;
  const y = parseFloat(tile.style.top) + parseFloat(tile.style.height) / 2;
  select(surface.value)
    .interrupt()
    .call(
      zoomBehavior.transform,
      zoomIdentity.translate(width / 2 - x * k, height / 2 - y * k).scale(k)
    );
}
function getTransform() {
  return {
    x: transform.x,
    y: transform.y,
    k: transform.k
  };
}
function setTransform(value) {
  if (surface.value && zoomBehavior) {
    select(surface.value)
      .interrupt()
      .call(zoomBehavior.transform, zoomIdentity.translate(value.x, value.y).scale(value.k));
  }
}
defineExpose({
  sourceRect,
  onWheel,
  handlePan,
  focusTile,
  getTransform,
  setTransform,
  fit
});
function fit() {
  if (!surface.value || !width || !height) {
    return;
  }
  stopZoom();
  const k = Math.max(
    0.1,
    Math.min(8, (width - 40) / props.worldSize, (height - 40) / props.worldSize)
  );
  select(surface.value).call(
    zoomBehavior.transform,
    zoomIdentity
      .translate((width - props.worldSize * k) / 2, (height - props.worldSize * k) / 2)
      .scale(k)
  );
}
function watchResolution() {
  resolutionQuery?.removeEventListener('change', watchResolution);
  resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  resolutionQuery.addEventListener('change', watchResolution);
  requestDraw();
}
watch(
  () => props.layout,
  () => {
    sceneVersion++;
    clearCanvasTextCache();
    updateScene();
    requestDraw();
  },
  {
    flush: 'post'
  }
);
watch(
  () => props.mastered,
  () => {
    updateScene();
    requestDraw();
  },
  {
    flush: 'post'
  }
);
watch(
  () => props.states,
  () => {
    updateScene();
    requestDraw();
  },
  {
    flush: 'post'
  }
);
watch(() => props.pulse, requestDraw);
watch(() => props.categoryId, fit);
onMounted(() => {
  palette = readCanvasPalette(surface.value);
  updateScene();
  if (
    typeof OffscreenCanvas !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    canvas.value.transferControlToOffscreen
  ) {
    try {
      drawWorker = new Worker(new URL('./knowledge-canvas2d-worker.js', import.meta.url), {
        type: 'module'
      });
      const offscreen = canvas.value.transferControlToOffscreen();
      drawWorker.postMessage(
        {
          type: 'init',
          canvas: offscreen
        },
        [offscreen]
      );
      drawWorker.onmessage = () => {
        workerBusy = false;
        if (
          workerDirty ||
          (props.pulse && !matchMedia('(prefers-reduced-motion: reduce)').matches)
        ) {
          workerDirty = false;
          requestDraw();
        }
      };
      drawWorker.onerror = () => {
        drawWorker?.terminate();
        drawWorker = null;
        workerBusy = false;
        canvasKey.value++;
        nextTick(requestDraw);
      };
      updateScene();
    } catch {
      drawWorker?.terminate();
      drawWorker = null;
      canvasKey.value++;
    }
  }
  zoomBehavior = zoom()
    .scaleExtent([0.1, 8])
    .filter((event) => !event.button)
    .on('start', (event) => {
      if (event.sourceEvent) {
        stopZoom();
      }
    })
    .on('zoom', (event) => {
      transform = event.transform;
      requestDraw();
    });
  select(surface.value).call(zoomBehavior).on('dblclick.zoom', null).on('wheel.zoom', null);
  surface.value.addEventListener('wheel', onWheel, {
    passive: false
  });
  sizeObserver = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    if (!fitted && width > 0 && height > 0) {
      fitted = true;
      fit();
    } else {
      requestDraw();
    }
  });
  sizeObserver.observe(surface.value);
  themeObserver = new MutationObserver(() => {
    palette = readCanvasPalette(surface.value);
    updateScene();
    requestDraw();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class', 'style']
  });
  watchResolution();
  document.fonts?.ready.then(() => {
    if (!disposed) {
      clearCanvasTextCache();
      updateScene();
      requestDraw();
    }
  });
});
onUnmounted(() => {
  disposed = true;
  drawWorker?.terminate();
  sizeObserver?.disconnect();
  themeObserver?.disconnect();
  resolutionQuery?.removeEventListener('change', watchResolution);
  cancelAnimationFrame(frame);
  clearCanvasTextCache();
  stopZoom();
  if (surface.value) {
    surface.value.removeEventListener('wheel', onWheel);
    select(surface.value).interrupt().on('.zoom', null);
  }
});
</script>

<template>
  <div class="canvas-test">
    <div
      ref="surface"
      class="canvas-surface"
      aria-label="知识地图画布测试区域"
      @click="onClick"
    >
      <canvas
        :key="canvasKey"
        ref="canvas"
        class="canvas-image"
        aria-hidden="true"
      />
      <div
        class="canvas-accessibility"
        aria-label="知识点列表"
      >
        <button
          v-for="tile in layout.tiles"
          :key="tile.node.id"
          type="button"
          :aria-label="`${tile.node.title}，${mastered.has(tile.node.slug) ? '已掌握' : '未掌握'}，激活打开阅读`"
          @focus="
            focusTile(tile);
            emit('focus', tile.node);
          "
          @blur="emit('blur')"
          @click.stop="emit('activate', tile.node)"
        />
      </div>
    </div>
    <div class="canvas-controls">
      <MButton
        size="sm"
        aria-label="缩小画布"
        @click="scaleAt(0.8, width / 2, height / 2)"
        >−</MButton
      >
      <MButton
        size="sm"
        aria-label="放大画布"
        @click="scaleAt(1.25, width / 2, height / 2)"
        >+</MButton
      >
      <MButton
        size="sm"
        @click="fit"
        >全览</MButton
      >
    </div>
  </div>
</template>

<style scoped>
.canvas-test {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.canvas-surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}
.canvas-surface:active {
  cursor: grabbing;
}
.canvas-image {
  display: block;
  width: 100%;
  height: 100%;
}
.canvas-accessibility {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.canvas-controls {
  position: absolute;
  right: 18px;
  bottom: 16px;
  display: flex;
  gap: 4px;
}
@media (max-width: 760px) {
  .canvas-controls {
    right: 10px;
    bottom: max(10px, env(safe-area-inset-bottom));
  }
  .canvas-controls :deep(button) {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
