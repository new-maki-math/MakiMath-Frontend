<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as d3 from 'd3';

const props = defineProps({
  nodes: { type: Array, required: true },
  edges: { type: Array, required: true },
  visibleIds: { type: Object, required: true },
  masteredIds: { type: Object, required: true },
  selectedId: { type: Number, default: null }
});
const emit = defineEmits(['select']);
const container = ref(null);
const canvas = ref(null);
let graphNodes = [];
let graphEdges = [];
let transform = d3.zoomIdentity;
let zoom;
let observer;
let themeObserver;
let layoutTimer;
let layoutGeneration = 0;
let width = 1;
let height = 1;
let frame;

function draw() {
  if (!canvas.value) return;
  const ctx = canvas.value.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const styles = getComputedStyle(container.value);
  const text = styles.getPropertyValue('--text-primary').trim() || '#ddd';
  const accent = styles.getPropertyValue('--accent-primary').trim() || '#38bdf8';
  const mastered = '#20a997';
  const idle = '#858b91';
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);
  const visible = props.visibleIds;
  if (transform.k > 0.13) {
    for (const edge of graphEdges) {
      if (!visible.has(edge.source.id) || !visible.has(edge.target.id)) continue;
      const a = edge.source;
      const b = edge.target;
      const color = props.masteredIds.has(a.id) && props.masteredIds.has(b.id) ? mastered : idle;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1 / transform.k;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (transform.k > 0.55) {
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const x = b.x - Math.cos(angle) * 9;
        const y = b.y - Math.sin(angle) * 9;
        const size = 5 / transform.k;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(angle - 0.5) * size, y - Math.sin(angle - 0.5) * size);
        ctx.lineTo(x - Math.cos(angle + 0.5) * size, y - Math.sin(angle + 0.5) * size);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  for (const node of graphNodes) {
    if (!visible.has(node.id)) continue;
    const x = transform.applyX(node.x);
    const y = transform.applyY(node.y);
    if (x < -100 || x > width + 100 || y < -40 || y > height + 40) continue;
    ctx.fillStyle = props.masteredIds.has(node.id) ? mastered : idle;
    ctx.beginPath();
    ctx.arc(node.x, node.y, Math.max(5, 3 / transform.k), 0, Math.PI * 2);
    ctx.fill();
    if (node.id === props.selectedId) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2 / transform.k;
      ctx.beginPath();
      ctx.arc(node.x, node.y, Math.max(9, 7 / transform.k), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (transform.k > 0.65) {
      ctx.fillStyle = text;
      ctx.font = `${12 / transform.k}px sans-serif`;
      ctx.fillText(node.title, node.x + 10, node.y - 8 / transform.k);
    }
  }
}

function scheduleDraw() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
}

function fit() {
  if (!graphNodes.length || !zoom) return;
  const xs = d3.extent(graphNodes, (node) => node.x);
  const ys = d3.extent(graphNodes, (node) => node.y);
  const scale = Math.min(1.5, Math.max(0.03, Math.min((width - 100) / Math.max(100, xs[1] - xs[0]), (height - 100) / Math.max(100, ys[1] - ys[0]))));
  d3.select(canvas.value).call(zoom.transform, d3.zoomIdentity.translate(width / 2 - (xs[0] + xs[1]) / 2 * scale, height / 2 - (ys[0] + ys[1]) / 2 * scale).scale(scale));
}

function focus(id) {
  const node = graphNodes.find((item) => item.id === id);
  if (!node || !zoom) return;
  const scale = Math.max(transform.k, 1);
  d3.select(canvas.value).call(zoom.transform, d3.zoomIdentity.translate(width / 2 - node.x * scale, height / 2 - node.y * scale).scale(scale));
}

function resize() {
  if (!container.value || !canvas.value) return;
  width = container.value.clientWidth || 1;
  height = container.value.clientHeight || 1;
  const ratio = window.devicePixelRatio || 1;
  canvas.value.width = Math.round(width * ratio);
  canvas.value.height = Math.round(height * ratio);
  scheduleDraw();
}

function layout() {
  const generation = ++layoutGeneration;
  clearTimeout(layoutTimer);
  graphNodes = props.nodes.map((node) => ({ ...node }));
  const ids = new Set(graphNodes.map((node) => node.id));
  graphEdges = props.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({ ...edge }));
  if (!graphNodes.length) { scheduleDraw(); return; }
  const simulation = d3.forceSimulation(graphNodes)
    .force('link', d3.forceLink(graphEdges).id((node) => node.id).distance(45).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-35).theta(1.1))
    .force('center', d3.forceCenter(0, 0))
    .stop();
  let remaining = 120;
  const step = () => {
    if (generation !== layoutGeneration) return;
    simulation.tick(Math.min(4, remaining));
    remaining -= 4;
    if (remaining > 0) layoutTimer = setTimeout(step, 0);
    else { simulation.stop(); fit(); }
  };
  step();
}

function zoomBy(factor) {
  d3.select(canvas.value).call(zoom.scaleBy, factor);
}

onMounted(() => {
  zoom = d3.zoom().scaleExtent([0.03, 5]).on('zoom', (event) => { transform = event.transform; scheduleDraw(); });
  const selection = d3.select(canvas.value).call(zoom).on('dblclick.zoom', null);
  selection.on('click.select', (event) => {
    if (event.defaultPrevented) return;
    const [x, y] = d3.pointer(event, canvas.value);
    let closest = null;
    let distance = 12;
    for (const node of graphNodes) {
      if (!props.visibleIds.has(node.id)) continue;
      const d = Math.hypot(transform.applyX(node.x) - x, transform.applyY(node.y) - y);
      if (d < distance) { closest = node; distance = d; }
    }
    if (closest) emit('select', closest.id);
  });
  observer = new ResizeObserver(resize);
  observer.observe(container.value);
  themeObserver = new MutationObserver(scheduleDraw);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
  resize();
  layout();
});
watch(() => [props.nodes, props.edges], layout);
watch(() => [props.visibleIds, props.masteredIds, props.selectedId], scheduleDraw);
onBeforeUnmount(() => {
  layoutGeneration++;
  clearTimeout(layoutTimer);
  cancelAnimationFrame(frame);
  observer?.disconnect();
  themeObserver?.disconnect();
  if (canvas.value) d3.select(canvas.value).on('.zoom', null).on('.select', null);
});
defineExpose({ fit, focus, zoomBy });
</script>

<template>
  <div ref="container" class="knowledge-map-canvas">
    <canvas ref="canvas" aria-label="知识地图，可拖动和缩放，通过搜索结果选择知识点" />
  </div>
</template>

<style scoped>
.knowledge-map-canvas { width: 100%; height: 100%; overflow: hidden; touch-action: none; }
canvas { display: block; width: 100%; height: 100%; cursor: grab; }
canvas:active { cursor: grabbing; }
</style>
