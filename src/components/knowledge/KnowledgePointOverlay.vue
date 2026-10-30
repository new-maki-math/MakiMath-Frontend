<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useKnowledgePointExpansion } from './useKnowledgePointExpansion.js';
import { createKnowledgeTransition2D } from './knowledge-transition-canvas2d.js';

const props = defineProps({ sourceRect: { type: Function, required: true }, title: { type: String, default: '' }, animationTitle: { type: String, default: '' }, glyphAdvance: { type: Function, default: null }, beforeFrame: { type: Function, default: null }, nodeId: { type: [String, Number], default: null }, sessionId: { type: Number, required: true }, mastered: Boolean, openingColor: { type: String, default: '' }, canvas2dEnabled: Boolean });
const emit = defineEmits(['closing', 'closed', 'zoom', 'pan']);
const overlay = ref(null);
const shell = ref(null);
const transitionCanvas = ref(null);
const canvasTransitioning = ref(false);
const dismissing = ref(false);
const canvasMode = ref(false);
let transitionScene = null;
let generation = 0;
let disposed = false;
let closingCanvas = false;
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
async function prepareCanvas() {
  const source = props.sourceRect();
  const parent = transitionCanvas.value.getBoundingClientRect();
  const target = shell.value.getBoundingClientRect();
  if (!source || source.width <= 1 || source.height <= 1 || source.right <= parent.left || source.left >= parent.right || source.bottom <= parent.top || source.top >= parent.bottom) throw new Error('知识点不在画布中');
  const relative = (value, bounds) => [value.left - bounds.left, value.top - bounds.top, value.width, value.height];
  const geometry = () => {
    const bounds = transitionCanvas.value.getBoundingClientRect();
    const currentSource = props.sourceRect() || source;
    const currentTarget = shell.value.getBoundingClientRect();
    const heading = content.value?.querySelector('.point-header span');
    const range = document.createRange();
    if (heading?.firstChild) range.selectNodeContents(heading);
    const headingRect = heading?.firstChild ? range.getClientRects()[0] : heading?.getBoundingClientRect();
    const headingStyle = heading ? getComputedStyle(heading) : null;
    return { source: relative(currentSource, bounds), target: relative(currentTarget, bounds), sourceFontSize: currentSource.fontSize || 10, sourceOpacity: currentSource.titleOpacity ?? 1, titleX: headingRect ? headingRect.left - bounds.left : currentTarget.left - bounds.left + 20, titleY: headingRect ? headingRect.top - bounds.top : currentTarget.top - bounds.top + 18, titleFontSize: parseFloat(headingStyle?.fontSize) || 14, titleFont: headingStyle?.fontFamily || 'sans-serif' };
  };
  const tileColor = props.mastered ? 'color-mix(in srgb, var(--accent-primary) 50%, var(--tree-selected-bg))' : 'color-mix(in srgb, var(--text-muted) 38%, var(--bg-hover))';
  const originColor = (closingCanvas ? source.color : props.openingColor || source.color) || tileColor;
  return createKnowledgeTransition2D(transitionCanvas.value, props.animationTitle || props.title, geometry, colorOf(originColor), colorOf('var(--bg-surface)'), colorOf(props.mastered ? 'var(--tree-selected-fg)' : 'var(--text-primary)'), colorOf('var(--text-primary)'), colorOf(originColor), props.glyphAdvance, props.beforeFrame);
}
function updateContentOpacity(wave) {
  if (!content.value) return;
  const progress = Math.max(0, Math.min(1, (wave - 0.35) / 0.55));
  content.value.style.setProperty('--content-opacity', String(progress * progress * (3 - 2 * progress)));
}
async function dismiss() {
  if (phase.value === 'closing' || closingCanvas) return;
  dismissing.value = true;
  emit('closing', props.sessionId);
  content.value?.style.setProperty('--content-opacity', '0');
  if (canvasTransitioning.value) { generation++; transitionScene?.dispose(); emit('closed', props.sessionId); return; }
  if (canvasMode.value) {
    const current = ++generation;
    closingCanvas = true;
    try {
      transitionScene?.dispose();
      transitionScene = await prepareCanvas();
      if (disposed || current !== generation) { transitionScene?.dispose(); return; }
      const animation = transitionScene.play(true);
      canvasTransitioning.value = true;
      await nextTick();
      await animation;
      if (!disposed && current === generation) emit('closed', props.sessionId);
    } catch {
      transitionScene?.dispose();
      transitionScene = null;
      if (disposed || current !== generation) return;
      closingCanvas = false;
      canvasMode.value = false;
      canvasTransitioning.value = false;
      if (await close()) emit('closed', props.sessionId);
    }
  } else if (await close()) emit('closed', props.sessionId);
}
function canPan(event) {
  return canvasTransitioning.value || phase.value === 'opening' || phase.value === 'closing' || !content.value?.contains(event.target);
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
  if (!canvasTransitioning.value && (canvasMode.value || phase.value === 'open') && scroll.value?.contains(event.target)) return;
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
  if (props.canvas2dEnabled) {
    const current = ++generation;
    canvasTransitioning.value = true;
    try {
      transitionScene = await prepareCanvas();
      if (disposed || current !== generation) { transitionScene?.dispose(); return; }
      canvasMode.value = true;
      await transitionScene.play(false, updateContentOpacity);
      if (disposed || current !== generation) return;
      canvasTransitioning.value = false;
    } catch {
      transitionScene?.dispose();
      transitionScene = null;
      if (disposed || current !== generation) return;
      canvasTransitioning.value = false;
      canvasMode.value = false;
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
defineExpose({ syncSource, dismiss });
onBeforeUnmount(() => { disposed = true; generation++; transitionScene?.dispose(); observer?.disconnect(); });
</script>

<template>
  <div ref="overlay" class="point-overlay" :class="{ 'is-closing': dismissing }" :inert="dismissing" tabindex="-1" @keydown="handleKey" @wheel="handleWheel" @mousedown="handlePan($event, 'mousedown')" @touchstart="handlePan($event, 'touchstart')" @touchmove="handlePan($event, 'touchmove')" @touchend="handlePan($event, 'touchend')" @touchcancel="handlePan($event, 'touchcancel')">
    <canvas v-if="canvas2dEnabled" :style="{ visibility: canvasTransitioning ? 'visible' : 'hidden' }" ref="transitionCanvas" class="point-transition" aria-hidden="true" />
    <div :style="{ visibility: canvasTransitioning ? 'hidden' : 'visible' }" ref="backdrop" class="point-backdrop" aria-hidden="true" />
    <div ref="shell" class="point-shell" :style="{ visibility: canvasTransitioning ? 'hidden' : 'visible', '--point-origin': mastered ? 'color-mix(in srgb, color-mix(in srgb, var(--accent-primary) 50%, var(--tree-selected-bg)) 88%, white)' : 'color-mix(in srgb, color-mix(in srgb, var(--text-muted) 38%, var(--bg-hover)) 88%, white)' }" aria-hidden="true"><div ref="fill" class="point-fill" /></div>
    <section ref="content" class="point-content" :class="{ 'is-canvas-transitioning': canvasTransitioning }" role="dialog" aria-modal="true" :aria-label="title || '知识点阅读'">
      <header class="point-header"><span>{{ title }}</span><button ref="closeButton" type="button" aria-label="关闭阅读" @click="dismiss">×</button></header>
      <div ref="scroll" class="point-scroll"><slot /></div>
    </section>
  </div>
</template>

<style scoped>
.point-overlay { position: absolute; inset: 0; z-index: 20; touch-action: none; }
.point-overlay.is-closing { pointer-events: none; }
.point-transition { position: absolute; inset: 0; width: 100%; height: 100%; }
.point-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, .48); }
.point-shell, .point-content { position: absolute; inset: clamp(12px, 4%, 48px); border-radius: 6px; }
.point-shell { overflow: hidden; background: var(--point-origin); box-sizing: border-box; will-change: left, top, width, height, opacity; }
.point-fill { position: absolute; inset: 0; border-radius: inherit; background: var(--bg-surface); clip-path: circle(150% at 50% 50%); }
.point-content { display: flex; flex-direction: column; overflow: hidden; background: var(--bg-surface); color: var(--text-primary); }
.point-content.is-canvas-transitioning { background: transparent; opacity: var(--content-opacity, 0); pointer-events: none; }
.point-content.is-canvas-transitioning .point-header span { visibility: hidden; }
.point-header { display: flex; align-items: center; justify-content: space-between; flex: none; padding: 12px 20px; border-bottom: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 14px; line-height: 1.35; }
.point-header span { min-width: 0; overflow-wrap: anywhere; font-family: var(--font-ui); font-weight: 600; }
.point-header button { width: 32px; height: 32px; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-primary); font-size: 24px; cursor: pointer; }
.point-header button:hover { background: var(--bg-hover); }
.point-header button:focus-visible { outline: 2px solid var(--accent-primary); }
.point-scroll { touch-action: pan-y; flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
@media (max-width: 760px) { .point-shell, .point-content { inset: 0; } .point-header { padding: 8px 12px; } .point-header button { flex: none; width: 44px; height: 44px; } }
</style>
