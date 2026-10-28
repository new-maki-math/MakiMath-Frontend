<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useKnowledgePointExpansion } from './useKnowledgePointExpansion.js';
import { createKnowledgeTransition } from './knowledge-transition-gpu.js';

const props = defineProps({ sourceRect: { type: Function, required: true }, title: { type: String, default: '' }, animationTitle: { type: String, default: '' }, glyphAdvance: { type: Function, default: null }, beforeFrame: { type: Function, default: null }, nodeId: { type: [String, Number], default: null }, mastered: Boolean, gpuEnabled: Boolean });
const emit = defineEmits(['closed', 'zoom', 'pan']);
const overlay = ref(null);
const shell = ref(null);
const gpuCanvas = ref(null);
const gpuTransitioning = ref(false);
const gpuMode = ref(false);
let gpuScene = null;
let generation = 0;
let disposed = false;
let closingGpu = false;
let touchPanning = false;
const fill = ref(null);
const content = ref(null);
const backdrop = ref(null);
const closeButton = ref(null);
const scroll = ref(null);
watch(() => props.nodeId, () => { if (scroll.value) scroll.value.scrollTop = 0; });
const { phase, open, close, settle, syncSource } = useKnowledgePointExpansion(shell, fill, content, backdrop, () => props.sourceRect());
let observer;
function colorOf(value) {
  const probe = document.createElement('span');
  probe.style.color = value;
  shell.value.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  const parts = resolved.match(/[\d.]+/g) || [];
  const divisor = resolved.startsWith('color(srgb ') ? 1 : 255;
  return [Number(parts[0] || 0) / divisor, Number(parts[1] || 0) / divisor, Number(parts[2] || 0) / divisor, 1];
}
async function prepareGpu() {
  const source = props.sourceRect();
  const parent = gpuCanvas.value.getBoundingClientRect();
  const target = shell.value.getBoundingClientRect();
  if (!source || source.width <= 1 || source.height <= 1 || source.right <= parent.left || source.left >= parent.right || source.bottom <= parent.top || source.top >= parent.bottom) throw new Error('知识点不在画布中');
  const relative = (value, bounds) => [value.left - bounds.left, value.top - bounds.top, value.width, value.height];
  const geometry = () => {
    const bounds = gpuCanvas.value.getBoundingClientRect();
    const currentSource = props.sourceRect() || source;
    const currentTarget = shell.value.getBoundingClientRect();
    return { source: relative(currentSource, bounds), target: relative(currentTarget, bounds), sourceFontSize: currentSource.fontSize || 10, sourceOpacity: currentSource.titleOpacity ?? 1 };
  };
  return createKnowledgeTransition(gpuCanvas.value, props.animationTitle || props.title, geometry, colorOf(props.mastered ? 'color-mix(in srgb, var(--chip-mastered) 88%, white)' : 'color-mix(in srgb, var(--chip-unmastered) 88%, white)'), colorOf('var(--bg-surface)'), colorOf('var(--text-primary)'), props.glyphAdvance, props.beforeFrame);
}
async function dismiss() {
  if (phase.value === 'closing' || closingGpu) return;
  if (gpuTransitioning.value) { generation++; gpuScene?.dispose(); emit('closed'); return; }
  if (gpuMode.value) {
    const current = ++generation;
    closingGpu = true;
    try {
      gpuScene?.dispose();
      gpuScene = await prepareGpu();
      if (disposed || current !== generation) { gpuScene?.dispose(); return; }
      const animation = gpuScene.play(true);
      gpuTransitioning.value = true;
      await nextTick();
      await animation;
      if (!disposed && current === generation) emit('closed');
    } catch {
      gpuScene?.dispose();
      gpuScene = null;
      if (disposed || current !== generation) return;
      closingGpu = false;
      gpuMode.value = false;
      gpuTransitioning.value = false;
      if (await close()) emit('closed');
    }
  } else if (await close()) emit('closed');
}
function canPan(event) {
  return gpuTransitioning.value || phase.value === 'opening' || phase.value === 'closing' || !content.value?.contains(event.target);
}
function handlePan(event, type) {
  if (type === 'mousedown') {
    if (event.button === 0 && canPan(event)) emit('pan', { event, type });
    return;
  }
  if (type === 'touchstart') {
    if (!canPan(event)) return;
    touchPanning = true;
  } else if (!touchPanning) return;
  emit('pan', { event, type });
  if ((type === 'touchend' || type === 'touchcancel') && event.touches.length === 0) touchPanning = false;
}
function handleWheel(event) {
  if (!gpuTransitioning.value && (gpuMode.value || phase.value === 'open') && scroll.value?.contains(event.target)) return;
  event.preventDefault();
  emit('zoom', event);
}
function handleKey(event) {
  if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
  if (event.key !== 'Tab') return;
  const items = [...content.value.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')];
  if (!items.length) { event.preventDefault(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
onMounted(async () => {
  overlay.value?.focus();
  if (props.gpuEnabled) {
    const current = ++generation;
    gpuTransitioning.value = true;
    try {
      gpuScene = await prepareGpu();
      if (disposed || current !== generation) { gpuScene?.dispose(); return; }
      gpuMode.value = true;
      await gpuScene.play();
      if (disposed || current !== generation) return;
      gpuTransitioning.value = false;
    } catch {
      gpuScene?.dispose();
      gpuScene = null;
      if (disposed || current !== generation) return;
      gpuTransitioning.value = false;
      gpuMode.value = false;
      open();
    }
  } else open();
  await nextTick();
  closeButton.value?.focus();
  let size;
  observer = new ResizeObserver(([entry]) => {
    const next = `${entry.contentRect.width}:${entry.contentRect.height}`;
    if (size && size !== next) settle();
    size = next;
  });
  if (shell.value?.parentElement) observer.observe(shell.value.parentElement);
});
defineExpose({ syncSource });
onBeforeUnmount(() => { disposed = true; generation++; gpuScene?.dispose(); observer?.disconnect(); });
</script>

<template>
  <div ref="overlay" class="point-overlay" tabindex="-1" @keydown="handleKey" @wheel="handleWheel" @mousedown="handlePan($event, 'mousedown')" @touchstart="handlePan($event, 'touchstart')" @touchmove="handlePan($event, 'touchmove')" @touchend="handlePan($event, 'touchend')" @touchcancel="handlePan($event, 'touchcancel')">
    <canvas v-if="gpuEnabled" :style="{ visibility: gpuTransitioning ? 'visible' : 'hidden' }" ref="gpuCanvas" class="point-gpu" aria-hidden="true" />
    <div :style="{ visibility: gpuTransitioning ? 'hidden' : 'visible' }" ref="backdrop" class="point-backdrop" aria-hidden="true" />
    <div ref="shell" class="point-shell" :style="{ visibility: gpuTransitioning ? 'hidden' : 'visible', '--point-origin': mastered ? 'color-mix(in srgb, var(--chip-mastered) 88%, white)' : 'color-mix(in srgb, var(--chip-unmastered) 88%, white)' }" aria-hidden="true"><div ref="fill" class="point-fill" /></div>
    <section :style="{ visibility: gpuTransitioning ? 'hidden' : 'visible' }" ref="content" class="point-content" role="dialog" aria-modal="true" :aria-label="title || '知识点阅读'">
      <header class="point-header"><span>{{ title }}</span><button ref="closeButton" type="button" aria-label="关闭阅读" @click="dismiss">×</button></header>
      <div ref="scroll" class="point-scroll"><slot /></div>
    </section>
  </div>
</template>

<style scoped>
.point-overlay { position: absolute; inset: 0; z-index: 20; touch-action: none; }
.point-gpu { position: absolute; inset: 0; width: 100%; height: 100%; }
.point-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, .48); }
.point-shell, .point-content { position: absolute; inset: clamp(12px, 4%, 48px); border-radius: 6px; }
.point-shell { overflow: hidden; background: var(--point-origin); box-sizing: border-box; will-change: left, top, width, height, opacity; }
.point-fill { position: absolute; inset: 0; border-radius: inherit; background: var(--bg-surface); clip-path: circle(150% at 50% 50%); }
.point-content { display: flex; flex-direction: column; overflow: hidden; background: var(--bg-surface); color: var(--text-primary); }
.point-header { display: flex; align-items: center; justify-content: space-between; flex: none; padding: 12px 20px; border-bottom: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 14px; line-height: 1.35; }
.point-header span { min-width: 0; overflow-wrap: anywhere; font-family: "KnowledgeMapTransition", var(--font-ui); font-weight: 600; }
.point-header button { width: 32px; height: 32px; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-primary); font-size: 24px; cursor: pointer; }
.point-header button:hover { background: var(--bg-hover); }
.point-header button:focus-visible { outline: 2px solid var(--accent-primary); }
.point-scroll { touch-action: pan-y; flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
@media (max-width: 760px) { .point-shell, .point-content { inset: 0; } }
</style>
