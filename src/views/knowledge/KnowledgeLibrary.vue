<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { hierarchy, select, treemap, treemapBinary, treemapSquarify, zoom, zoomIdentity } from 'd3';
import { knowledgeApi } from '../../api/knowledge.js';
import { managementApi } from '../../api/management.js';
import { getMasteredIds, setMastered } from '../../utils/knowledge-mastery.js';
import MButton from '../../components/MButton.vue';
import MLoadingMask from '../../components/MLoadingMask.vue';
import TypstSource from '../../components/TypstSource.vue';
import { createKnowledgeRenderer } from './knowledge-webgpu-renderer.js';

const mapLoading = ref(false);
const categoryId = ref('');
const libraries = ref([]);
const librariesLoading = ref(false);
const librariesError = ref('');
let librariesSequence = 0;
const searchQuery = ref('');
const masteryFilter = ref('all');
const masteryAvailable = ref(false);
const mapError = ref('');
const scopeError = ref(false);
const detail = ref(null);
const detailLoading = ref(false);
const detailError = ref('');
const detailPrerequisites = ref([]);
const prerequisitesError = ref('');
const masteryLoading = ref(true);
const masterySaving = ref(false);
let mapSequence = 0;
let detailSequence = 0;
let suppressCategoryWatch = false;
const storageError = ref('');
const libraryMain = ref(null);
const canvas = ref(null);
const mapWorld = ref(null);
const labelLayer = ref(null);
const gpuCanvas = ref(null);
const gpuReady = ref(false);
const gpuError = ref('');
const gpuInitializing = ref(false);
const glyphLoading = ref(false);
const glyphWarning = ref('');
const detailPanel = ref(null);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
let canvasTransform = zoomIdentity;
let gpuRenderer = null;
let gpuFrame = 0;
let gpuInitSequence = 0;
let gpuSceneSequence = 0;
let gpuColor = [1, 1, 1, 1];
let gpuPalette = null;
let themeObserver;
let disposed = false;
const worldSize = 2000;
let resizeObserver;
let canvasZoom;
let fitted = false;
let zoomFrame = 0;
let zoomTarget = null;
const selected = ref(null);
const focusedId = ref('');
const activeDomain = ref('');
const activeTopic = ref('');
const returnStack = ref([]);
const graph = ref({ categories: [], nodes: [], edges: [] });
const domains = ref([]);
const domainById = new Map();
const nodeById = new Map();
const topicNames = new Map();
const canonicalId = (id) => id;
const learningNodes = computed(() => graph.value.nodes);
const currentDomain = computed(() => domainById.get(activeDomain.value));
const currentTopic = computed(() => currentDomain.value?.topics.find((topic) => topic.id === activeTopic.value));
const categoryOptions = computed(() => libraries.value.filter((item) => item.parent_id === null));
const currentLibraryName = computed(() => categoryOptions.value.find((item) => String(item.id) === categoryId.value)?.name || (categoryId.value ? '所选知识库' : '全部知识库'));
async function loadLibraries() {
  const sequence = ++librariesSequence;
  librariesLoading.value = true;
  librariesError.value = '';
  try {
    const result = await managementApi.categories('knowledge');
    if (disposed || sequence !== librariesSequence) return;
    if (!Array.isArray(result)) throw new Error('知识分类数据不完整');
    libraries.value = result;
  } catch {
    if (!disposed && sequence === librariesSequence) librariesError.value = '知识库分类加载失败';
  } finally {
    if (!disposed && sequence === librariesSequence) librariesLoading.value = false;
  }
}
const visibleDomains = computed(() => activeDomain.value ? domains.value.filter((domain) => domain.id === activeDomain.value) : domains.value);
const mastered = ref(new Set());

function buildDomains(data) {
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const grouped = new Map();
  domainById.clear();
  nodeById.clear();
  topicNames.clear();
  for (const node of data.nodes) {
    let path = [];
    let bestScore = -1;
    for (const nodeCategoryId of node.category_ids) {
      const candidate = [];
      const seen = new Set();
      let current = categories.get(nodeCategoryId);
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        candidate.unshift(current);
        current = categories.get(current.parent_id);
      }
      const score = candidate.length + (categoryId.value && candidate.some((item) => item.id === Number(categoryId.value)) ? 100000 : 0);
      if (score > bestScore) { bestScore = score; path = candidate; }
    }
    const selectedRoot = categoryId.value ? Number(categoryId.value) : null;
    const rootIndex = selectedRoot === null ? -1 : path.findIndex((item) => item.id === selectedRoot);
    const projected = rootIndex >= 0 ? path.slice(rootIndex + 1) : path;
    const rootDirect = rootIndex >= 0 && !projected.length;
    const incompletePath = selectedRoot !== null && rootIndex < 0;
    const domain = incompletePath ? { id: 'incomplete-path', name: '未显示分类或路径不完整' } : projected[0] || (rootDirect ? { id: `root-direct-${selectedRoot}`, name: '直属本知识库' } : { id: 'uncategorized', name: '无有效分类' });
    const topic = incompletePath && projected.length ? projected[projected.length - 1] : projected.length > 1 ? projected[1] : { id: `direct-${domain.id}`, name: projected.length ? '直属此分类' : rootDirect ? '直属知识点' : '未显示分类' };
    const item = { ...node, domain_id: domain.id, topic_id: topic.id };
    nodeById.set(item.id, item);
    if (!grouped.has(domain.id)) grouped.set(domain.id, { id: domain.id, name: domain.name, nodes: [], topics: [] });
    const group = grouped.get(domain.id);
    let section = group.topics.find((value) => value.id === topic.id);
    if (!section) { section = { id: topic.id, title: topic.name, nodes: [], overviews: [] }; group.topics.push(section); }
    group.nodes.push(item);
    section.nodes.push(item);
    topicNames.set(topic.id, topic.name);
  }
  const order = new Map(data.categories.map((category, index) => [category.id, index]));
  const result = [...grouped.values()].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  for (const domain of result) domain.topics.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  for (const domain of result) domainById.set(domain.id, domain);
  return result;
}

async function loadMap({ preserveOnError = false } = {}) {
  const sequence = ++mapSequence;
  mapLoading.value = true;
  mapError.value = '';
  scopeError.value = false;
  if (!preserveOnError) { detailSequence++; selected.value = null; }
  try {
    const result = await knowledgeApi.map(categoryId.value);
    if (sequence !== mapSequence || disposed) return;
    domains.value = buildDomains(result);
    graph.value = result;
    activeDomain.value = '';
    activeTopic.value = '';
    selected.value = null;
    detailSequence++;
    focusedId.value = '';
    await nextTick();
    if (sequence !== mapSequence || disposed) return;
    resetCanvas(false);
    return true;
  } catch (error) {
    if (sequence === mapSequence && !disposed) {
      if (!preserveOnError) {
        graph.value = { categories: graph.value.categories, nodes: [], edges: [] };
        domains.value = [];
      }
      scopeError.value = preserveOnError;
      mapError.value = preserveOnError ? '切换范围失败，请在详情中重试。' : error.status === 404 ? '分类不存在或已归档，请选择其他分类' : '知识地图加载失败，请重试';
    }
    return false;
  } finally {
    if (sequence === mapSequence && !disposed) mapLoading.value = false;
  }
}

async function loadMastery() {
  try { mastered.value = await getMasteredIds(); masteryAvailable.value = true; }
  catch { storageError.value = '本地掌握记录读取失败，暂时无法修改。'; }
  finally { masteryLoading.value = false; }
}
const uniqueIds = (nodes) => new Set(nodes.map((node) => canonicalId(node.id)));
const stats = (nodes) => {
  const ids = uniqueIds(nodes);
  let done = 0;
  for (const id of ids) if (mastered.value.has(id)) done++;
  return { done, total: ids.size, percent: ids.size ? Math.round(done / ids.size * 100) : 0 };
};
const totalStats = computed(() => stats(learningNodes.value));
const chipNodes = computed(() => {
  const seen = new Set();
  return visibleDomains.value.flatMap((domain) => domain.nodes).filter((node) => {
    const id = canonicalId(node.id);
    if (seen.has(id)) return false;
    seen.add(id);
    const term = searchQuery.value.trim().toLocaleLowerCase();
    const matches = !term || node.title.toLocaleLowerCase().includes(term);
    if (!matches || masteryFilter.value === 'all') return matches;
    const isMastered = mastered.value.has(id);
    return masteryFilter.value === 'mastered' ? isMastered : !isMastered;
  });
});
const searchResults = computed(() => searchQuery.value.trim() ? chipNodes.value : []);
function selectSearchResult(node) {
  selectNode(node);
  const tile = chipLayout.value.tiles.find((item) => item.node.id === node.id);
  if (tile) focusTile(tile);
}
function visualWeight(id) {
  const hash = [...String(id)].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  return 0.7 + (hash % 61) / 100;
}
function orderedTreemap(node, x0, y0, x1, y1) {
  const children = node.children;
  if (node.depth !== 0) {
    treemapSquarify.ratio(1.25)(node, x0, y0, x1, y1);
    return;
  }
  if (children.length > 9) {
    treemapBinary(node, x0, y0, x1, y1);
    return;
  }
  const sums = [0];
  for (const child of children) sums.push(sums[sums.length - 1] + child.value);
  const solve = (start, end, left, top, right, bottom) => {
    if (end - start === 1) {
      const width = Math.max(0.0001, right - left - 26);
      const height = Math.max(0.0001, bottom - top - 83);
      const aspect = Math.log(width / height);
      return { cost: aspect * aspect, rects: [{ index: start, left, top, right, bottom }] };
    }
    let best = null;
    const total = sums[end] - sums[start];
    for (let split = start + 1; split < end; split++) {
      const fraction = (sums[split] - sums[start]) / total;
      for (const vertical of [true, false]) {
        const boundary = vertical ? left + (right - left) * fraction : top + (bottom - top) * fraction;
        const first = solve(start, split, left, top, vertical ? boundary : right, vertical ? bottom : boundary);
        if (best && first.cost >= best.cost) continue;
        const second = solve(split, end, vertical ? boundary : left, vertical ? top : boundary, right, bottom);
        const cost = first.cost + second.cost;
        if (!best || cost < best.cost) best = { cost, rects: [...first.rects, ...second.rects] };
      }
    }
    return best;
  };
  if (!children.length) return;
  const result = solve(0, children.length, x0, y0, x1, y1);
  for (const rect of result.rects) {
    const child = children[rect.index];
    child.x0 = rect.left; child.y0 = rect.top; child.x1 = rect.right; child.y1 = rect.bottom;
  }
}
const chipLayout = computed(() => {
  const entries = chipNodes.value;
  if (!entries.length) return { groups: [], tiles: [] };
  const children = visibleDomains.value.map((domain) => {
    const topics = domain.topics.map((topic) => {
      const nodes = entries.filter((node) => node.domain_id === domain.id && node.topic_id === topic.id);
      const weightSum = nodes.reduce((sum, node) => sum + visualWeight(node.id), 0);
      return { title: topic.title, kind: 'topic', children: nodes.map((node) => ({ node, weight: visualWeight(node.id) * nodes.length / weightSum })) };
    }).filter((topic) => topic.children.length);
    return { title: domain.name, kind: 'domain', children: topics };
  }).filter((domain) => domain.children.length);
  const root = hierarchy({ children }).sum((item) => item.weight || 0);
  treemap().size([worldSize, worldSize]).tile(orderedTreemap)
    .paddingOuter((node) => node.depth === 1 ? 8 : node.depth === 2 ? 5 : 0)
    .paddingTop((node) => node.depth === 1 ? 42 : node.depth === 2 ? 28 : 0)
    .paddingInner((node) => node.depth === 0 ? 9 : node.depth === 1 ? 5 : 2)
    .round(true)(root);
  const style = (node) => ({ left: `${node.x0}px`, top: `${node.y0}px`, width: `${Math.max(0, node.x1 - node.x0)}px`, height: `${Math.max(0, node.y1 - node.y0)}px` });
  return {
    groups: root.descendants().filter((node) => node.depth === 1 || node.depth === 2).map((node) => ({
      id: `${node.depth}-${node.data.title}`, kind: node.data.kind, title: node.data.title,
      nodes: node.leaves().map((leaf) => leaf.data.node),
      fontSize: node.depth === 1 ? 18 : 14,
      style: style(node)
    })),
    tiles: root.leaves().map((node) => ({ node: node.data.node, style: style(node) }))
  };
});
let titleMeasureContext;
function groupScrollDistance(group) {
  if (!libraryMain.value) return 0;
  if (!titleMeasureContext) titleMeasureContext = document.createElement('canvas').getContext('2d');
  if (!titleMeasureContext) return 0;
  titleMeasureContext.font = `${group.fontSize}px ${getComputedStyle(libraryMain.value).fontFamily}`;
  const margin = group.kind === 'domain' ? 24 : 16;
  return Math.max(0, titleMeasureContext.measureText(group.title).width - Math.max(0, parseFloat(group.style.width) - margin));
}
function labelOpacity(scale, start, end) {
  return Math.max(0, Math.min(1, (scale - start) / (end - start)));
}
function updateWorldTransform() {
  if (mapWorld.value) {
    mapWorld.value.style.transform = `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.k})`;
    const borderOpacity = `${Math.round(labelOpacity(canvasTransform.k, 0.2, 0.4) * 100)}%`;
    if (mapWorld.value.style.getPropertyValue('--group-border-opacity') !== borderOpacity) mapWorld.value.style.setProperty('--group-border-opacity', borderOpacity);
    const domainOpacity = labelOpacity(canvasTransform.k, 0.3, 0.5).toFixed(1);
    const topicOpacity = labelOpacity(canvasTransform.k, 0.5, 0.75).toFixed(1);
    if (mapWorld.value.style.getPropertyValue('--domain-label-opacity') !== domainOpacity) mapWorld.value.style.setProperty('--domain-label-opacity', domainOpacity);
    if (mapWorld.value.style.getPropertyValue('--topic-label-opacity') !== topicOpacity) mapWorld.value.style.setProperty('--topic-label-opacity', topicOpacity);
  }
  const opacity = labelOpacity(canvasTransform.k, 0.8, 1.05);
  if (labelLayer.value) {
    labelLayer.value.style.visibility = opacity ? 'visible' : 'hidden';
    labelLayer.value.style.opacity = opacity;
  }
  if (gpuCanvas.value) gpuCanvas.value.style.visibility = !currentTopic.value ? 'visible' : 'hidden';
  requestGpuDraw();
}
watch(mapWorld, updateWorldTransform);
watch(labelLayer, updateWorldTransform, { flush: 'post' });
function updateGpuColor() {
  if (!gpuCanvas.value) return;
  const probe = document.createElement('span');
  probe.style.display = 'none';
  libraryMain.value.appendChild(probe);
  const readColor = (value) => {
    probe.style.color = value;
    const resolved = getComputedStyle(probe).color;
    const parts = resolved.match(/[\d.]+/g) || [];
    const divisor = resolved.startsWith('color(srgb ') ? 1 : 255;
    return [Number(parts[0] || 0) / divisor, Number(parts[1] || 0) / divisor, Number(parts[2] || 0) / divisor, parts.length > 3 ? Number(parts[3]) : 1];
  };
  gpuColor = readColor('var(--text-primary)');
  gpuPalette = {
    domain: readColor('var(--bg-surface)'), topic: readColor('var(--bg-elevated)'),
    domainBorder: readColor('var(--text-secondary)'), topicBorder: readColor('var(--text-muted)'),
    unmastered: readColor('color-mix(in srgb, var(--text-muted) 32%, var(--bg-hover))'),
    mastered: readColor('color-mix(in srgb, var(--accent-primary) 60%, var(--bg-hover))'),
    selected: readColor('var(--text-primary)'), before: readColor('var(--tag-amber)'), after: readColor('var(--tag-purple)')
  };
  gpuPalette.domainBorder[3] *= 0.75;
  gpuPalette.topicBorder[3] *= 0.5;
  probe.remove();
}
function requestGpuDraw() {
  if (!gpuRenderer || gpuFrame || currentTopic.value) return;
  gpuFrame = requestAnimationFrame(() => {
    gpuFrame = 0;
    const animating = gpuRenderer?.draw(canvasTransform, canvasWidth.value, canvasHeight.value, gpuColor, [
      labelOpacity(canvasTransform.k, 0.3, 0.5), labelOpacity(canvasTransform.k, 0.5, 0.75), labelOpacity(canvasTransform.k, 0.8, 1.05)
    ], !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (animating) requestGpuDraw();
  });
}
async function rebuildGpuLabels() {
  if (!gpuRenderer || !gpuCanvas.value) return;
  const renderer = gpuRenderer;
  const sequence = ++gpuSceneSequence;
  try {
    const groups = chipLayout.value.groups;
    const applied = await renderer.setTiles(chipLayout.value.tiles, relationClass, getComputedStyle(gpuCanvas.value).fontFamily, groups, (node) => mastered.value.has(canonicalId(node.id)), gpuPalette);
    if (applied && renderer === gpuRenderer && sequence === gpuSceneSequence) requestGpuDraw();
  } catch {
    if (renderer !== gpuRenderer || sequence !== gpuSceneSequence) return;
    renderer.dispose();
    gpuRenderer = null;
    gpuReady.value = false;
    glyphLoading.value = false;
    gpuError.value = '字形加载或 WebGPU 渲染失败，当前使用备用显示。';
  }
}
async function initializeGpu() {
  if (!gpuCanvas.value || disposed) return;
  const sequence = ++gpuInitSequence;
  const started = performance.now();
  console.info('[知识地图] 开始准备画布');
  gpuRenderer?.dispose();
  gpuRenderer = null;
  gpuReady.value = false;
  gpuInitializing.value = true;
  glyphLoading.value = false;
  glyphWarning.value = '';
  try {
    if (document.fonts) await document.fonts.ready;
    console.info(`[知识地图] 页面字体就绪，耗时 ${Math.round(performance.now() - started)} ms`);
    if (disposed || sequence !== gpuInitSequence) return;
    const renderer = await createKnowledgeRenderer(gpuCanvas.value, () => {
      if (!disposed && sequence === gpuInitSequence) handleGpuLost();
    }, (loading) => {
      if (!disposed && sequence === gpuInitSequence) glyphLoading.value = loading;
    }, (codepoints) => {
      if (!disposed && sequence === gpuInitSequence) glyphWarning.value = codepoints.length ? `当前字体不支持部分字符，画布以问号代替：${codepoints.map((value) => String.fromCodePoint(value)).join(' ')}` : '';
    });
    if (disposed || sequence !== gpuInitSequence) { renderer.dispose(); return; }
    gpuRenderer = renderer;
    updateGpuColor();
    await rebuildGpuLabels();
    if (disposed || sequence !== gpuInitSequence) return;
    gpuReady.value = Boolean(gpuRenderer);
    if (gpuReady.value) gpuError.value = '';
    updateWorldTransform();
    console.info(`[知识地图] 画布准备完成，总耗时 ${Math.round(performance.now() - started)} ms`);
  } catch (error) {
    console.error('[知识地图] 画布初始化失败', error);
    if (disposed || sequence !== gpuInitSequence) return;
    gpuRenderer = null;
    gpuReady.value = false;
    gpuError.value = 'WebGPU 渲染不可用，当前使用备用显示。';
  } finally {
    if (sequence === gpuInitSequence) gpuInitializing.value = false;
  }
}
function handleGpuLost() {
  gpuInitSequence++;
  gpuInitializing.value = false;
  glyphLoading.value = false;
  gpuRenderer?.dispose();
  gpuRenderer = null;
  gpuReady.value = false;
  gpuError.value = 'WebGPU 设备已断开，当前使用备用显示。';
}
watch(categoryId, () => { if (!suppressCategoryWatch) { returnStack.value = []; searchQuery.value = ''; loadMap(); } });
watch([chipLayout, selected, mastered, focusedId, detailPrerequisites], rebuildGpuLabels, { flush: 'post' });
watch([canvasWidth, canvasHeight], requestGpuDraw, { flush: 'post' });
onMounted(() => {
  canvasZoom = zoom().scaleExtent([0.1, 8]).filter((event) => {
    if (currentTopic.value || event.button) return false;
    return true;
  }).on('start', (event) => { if (event.sourceEvent) stopSmoothZoom(); })
    .on('zoom', (event) => { canvasTransform = event.transform; updateWorldTransform(); });
  if (canvas.value) {
    select(canvas.value).call(canvasZoom).on('dblclick.zoom', null).on('wheel.zoom', null);
    canvas.value.addEventListener('wheel', handleCanvasWheel, { passive: false });
  }
  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0].contentRect;
    canvasWidth.value = rect.width;
    canvasHeight.value = rect.height;
    if (!fitted && rect.width > 0 && rect.height > 0) { fitted = true; resetCanvas(false); }
    else updateWorldTransform();
  });
  if (canvas.value) resizeObserver.observe(canvas.value);
  loadMastery();
  loadLibraries();
  loadMap();
  initializeGpu();
  themeObserver = new MutationObserver(() => { updateGpuColor(); rebuildGpuLabels(); });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
});
onUnmounted(() => {
  disposed = true;
  gpuInitSequence++;
  mapSequence++;
  librariesSequence++;
  detailSequence++;
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  cancelAnimationFrame(gpuFrame);
  gpuRenderer?.dispose();
  stopSmoothZoom();
  if (canvas.value) {
    canvas.value.removeEventListener('wheel', handleCanvasWheel);
    select(canvas.value).interrupt().on('.zoom', null);
  }
});
function related(direction) {
  if (!selected.value) return [];
  const selectedId = canonicalId(selected.value.id);
  const incoming = direction === 'before';
  const matches = new Map();
  for (const edge of graph.value.edges) {
    const sourceId = canonicalId(edge.source);
    const targetId = canonicalId(edge.target);
    if (sourceId === targetId || (incoming ? targetId !== selectedId : sourceId !== selectedId)) continue;
    const otherId = incoming ? sourceId : targetId;
    const node = nodeById.get(incoming ? edge.source : edge.target);
    if (!node) continue;
    if (!matches.has(otherId)) matches.set(otherId, { node, reasons: new Set() });
    if (edge.reason) matches.get(otherId).reasons.add(edge.reason);
  }
  return [...matches.values()].map((item) => ({ node: item.node, reason: [...item.reasons].join('；') }));
}
const successors = computed(() => related('after'));
const relationClass = (node) => {
  if (!selected.value) return canonicalId(node.id) === canonicalId(focusedId.value) ? 'is-selected' : '';
  const id = canonicalId(node.id);
  if (id === canonicalId(selected.value.id)) return 'is-selected';
  if (detailPrerequisites.value.some((item) => item.id === id)) return 'is-prerequisite';
  if (successors.value.some((item) => canonicalId(item.node.id) === id)) return 'is-successor';
  return 'is-dimmed';
};
async function toggleMastery(node) {
  if (!node || masteryLoading.value || masterySaving.value || !masteryAvailable.value) return;
  storageError.value = '';
  const previous = mastered.value;
  const next = new Set(previous);
  const value = !next.has(node.id);
  if (value) next.add(node.id);
  else next.delete(node.id);
  mastered.value = next;
  masterySaving.value = true;
  try { await setMastered(node.id, value); }
  catch { mastered.value = previous; storageError.value = '掌握状态保存失败，请重试。'; }
  finally { masterySaving.value = false; }
}
function stopSmoothZoom() {
  cancelAnimationFrame(zoomFrame);
  zoomFrame = 0;
  zoomTarget = null;
}
function animateZoom() {
  if (!zoomTarget || !canvas.value || !canvasZoom) { stopSmoothZoom(); return; }
  const current = canvasTransform;
  const target = zoomTarget;
  const step = 0.2;
  const x = current.x + (target.x - current.x) * step;
  const y = current.y + (target.y - current.y) * step;
  const k = current.k + (target.k - current.k) * step;
  const done = Math.abs(target.x - x) < 0.1 && Math.abs(target.y - y) < 0.1 && Math.abs(target.k - k) < 0.0001;
  const next = done ? target : { x, y, k };
  select(canvas.value).call(canvasZoom.transform, zoomIdentity.translate(next.x, next.y).scale(next.k));
  if (done) stopSmoothZoom();
  else zoomFrame = requestAnimationFrame(animateZoom);
}
function scaleAt(factor, x, y) {
  if (!canvas.value || !canvasZoom || currentTopic.value) return;
  select(canvas.value).interrupt();
  const current = zoomTarget || canvasTransform;
  const k = Math.max(0.1, Math.min(8, current.k * factor));
  const ratio = k / current.k;
  zoomTarget = { x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio, k };
  if (!zoomFrame) zoomFrame = requestAnimationFrame(animateZoom);
}
function handleCanvasWheel(event) {
  if (currentTopic.value || !canvas.value) return;
  event.preventDefault();
  const bounds = canvas.value.getBoundingClientRect();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
  scaleAt(Math.exp(-delta * 0.002), event.clientX - bounds.left, event.clientY - bounds.top);
}
function resetCanvas(animate = true) {
  if (!canvas.value || !canvasZoom || !canvasWidth.value || !canvasHeight.value) return;
  stopSmoothZoom();
  const k = Math.max(0.1, Math.min((canvasWidth.value - 40) / worldSize, (canvasHeight.value - 40) / worldSize));
  const transform = zoomIdentity.translate((canvasWidth.value - worldSize * k) / 2, (canvasHeight.value - worldSize * k) / 2).scale(k);
  const surface = select(canvas.value).interrupt();
  if (animate) surface.transition().duration(260).call(canvasZoom.transform, transform);
  else surface.call(canvasZoom.transform, transform);
}
function zoomCanvas(factor) {
  scaleAt(factor, canvasWidth.value / 2, canvasHeight.value / 2);
}
function resetDetailScroll() {
  nextTick(() => { if (detailPanel.value) detailPanel.value.scrollTop = 0; });
}
function openDomain(id) {
  activeDomain.value = id;
  activeTopic.value = '';
  closeDetail();
  returnStack.value = [];
  resetCanvas();
}
function openTopic(domainId, topicId) {
  activeDomain.value = domainId;
  activeTopic.value = topicId;
  closeDetail();
  returnStack.value = [];
  resetCanvas();
}
function openOverview() {
  activeDomain.value = '';
  activeTopic.value = '';
  closeDetail();
  returnStack.value = [];
  resetCanvas();
}
async function selectNode(node, preserveHistory = false) {
  const sequence = ++detailSequence;
  selected.value = node;
  if (!preserveHistory) returnStack.value = [];
  detail.value = null;
  detailPrerequisites.value = [];
  detailError.value = '';
  prerequisitesError.value = '';
  detailLoading.value = true;
  resetDetailScroll();
  const [point, relations] = await Promise.allSettled([knowledgeApi.get(node.id), knowledgeApi.prerequisites(node.id)]);
  if (sequence !== detailSequence || disposed) return;
  if (point.status === 'fulfilled') detail.value = point.value;
  else detailError.value = point.reason?.status === 404 ? '知识点已不可用，请刷新地图。' : '知识点详情加载失败。';
  if (relations.status === 'fulfilled') detailPrerequisites.value = relations.value;
  else prerequisitesError.value = '前置知识加载失败。';
  detailLoading.value = false;
}
function tileAt(event) {
  if (!gpuReady.value || !canvas.value || currentTopic.value || event.target !== gpuCanvas.value) return null;
  const bounds = canvas.value.getBoundingClientRect();
  const x = (event.clientX - bounds.left - canvasTransform.x) / canvasTransform.k;
  const y = (event.clientY - bounds.top - canvasTransform.y) / canvasTransform.k;
  return chipLayout.value.tiles.find((tile) => {
    const left = parseFloat(tile.style.left);
    const top = parseFloat(tile.style.top);
    return x >= left && y >= top && x < left + parseFloat(tile.style.width) && y < top + parseFloat(tile.style.height);
  }) || null;
}
function handleMapClick(event) {
  if (event.defaultPrevented) return;
  const tile = tileAt(event);
  if (tile) selectNode(tile.node);
}
function handleMapHover(event) {
  if (!gpuReady.value || !gpuCanvas.value) return;
  const tile = tileAt(event);
  gpuCanvas.value.title = tile ? `${domainById.get(tile.node.domain_id)?.name} / ${topicNames.get(tile.node.topic_id)} · ${tileLabel(tile.node)}` : '';
  gpuCanvas.value.style.cursor = tile ? 'pointer' : 'grab';
}
function focusTile(tile) {
  focusedId.value = tile.node.id;
  if (!canvas.value || !canvasZoom) return;
  stopSmoothZoom();
  const k = Math.max(canvasTransform.k, 1);
  const x = parseFloat(tile.style.left) + parseFloat(tile.style.width) / 2;
  const y = parseFloat(tile.style.top) + parseFloat(tile.style.height) / 2;
  select(canvas.value).interrupt().call(canvasZoom.transform, zoomIdentity.translate(canvasWidth.value / 2 - x * k, canvasHeight.value / 2 - y * k).scale(k));
}
const selectedTile = computed(() => selected.value && chipLayout.value.tiles.find((tile) => tile.node.id === selected.value.id));
const selectedOutsideMap = computed(() => selected.value && !graph.value.nodes.some((node) => node.id === selected.value.id));

function followDependency(node) {
  if (selected.value) {
    returnStack.value.push({
      node: selected.value, categoryId: categoryId.value, query: searchQuery.value, filter: masteryFilter.value,
      transform: { x: canvasTransform.x, y: canvasTransform.y, k: canvasTransform.k }
    });
  }
  const target = nodeById.get(node.id) || node;
  selectNode(target, true);
  const tile = chipLayout.value.tiles.find((item) => item.node.id === target.id);
  if (tile) focusTile(tile);
}

async function switchCategory(value) {
  if (categoryId.value === value) return true;
  const previousCategory = categoryId.value;
  suppressCategoryWatch = true;
  categoryId.value = value;
  await nextTick();
  suppressCategoryWatch = false;
  const pending = loadMap({ preserveOnError: true });
  const sequence = mapSequence;
  const loaded = await pending;
  if (disposed || sequence !== mapSequence || categoryId.value !== value) return null;
  if (!loaded) {
    suppressCategoryWatch = true;
    categoryId.value = previousCategory;
    await nextTick();
    suppressCategoryWatch = false;
  }
  return loaded;
}

async function locateSelected() {
  const target = selected.value;
  if (!target) return;
  const previousQuery = searchQuery.value;
  const previousFilter = masteryFilter.value;
  searchQuery.value = '';
  masteryFilter.value = 'all';
  if (!nodeById.has(target.id)) {
    const loaded = await switchCategory('');
    if (loaded !== true) {
      if (loaded === false) { searchQuery.value = previousQuery; masteryFilter.value = previousFilter; }
      return;
    }
    const current = nodeById.get(target.id);
    if (!current) {
      await selectNode(target, true);
      return;
    }
    selectNode(current, true);
  }
  await nextTick();
  const tile = chipLayout.value.tiles.find((item) => item.node.id === target.id);
  if (tile) focusTile(tile);
}

async function returnToPrevious() {
  const previous = returnStack.value.pop();
  if (!previous) return;
  const currentQuery = searchQuery.value;
  const currentFilter = masteryFilter.value;
  searchQuery.value = previous.query;
  masteryFilter.value = previous.filter;
  const loaded = await switchCategory(previous.categoryId);
  if (loaded !== true) {
    if (loaded === false) { searchQuery.value = currentQuery; masteryFilter.value = currentFilter; returnStack.value.push(previous); }
    return;
  }
  selectNode(nodeById.get(previous.node.id) || previous.node, true);
  await nextTick();
  if (canvas.value && canvasZoom) {
    const { x, y, k } = previous.transform;
    select(canvas.value).interrupt().call(canvasZoom.transform, zoomIdentity.translate(x, y).scale(k));
  }
}

function closeDetail() {
  detailSequence++;
  selected.value = null;
  detail.value = null;
  returnStack.value = [];
}
const tileLabel = (node) => `${node.title}，${mastered.value.has(canonicalId(node.id)) ? '已掌握' : '未掌握'}`;
</script>

<template>
  <section class="knowledge-library">
    <MLoadingMask :visible="mapLoading || gpuInitializing || glyphLoading" :text="mapLoading ? '正在加载知识地图…' : '正在准备知识点字形…'" :z-index="50" />
    <main ref="libraryMain" class="library-main">
      <div class="floating-info">
        <nav class="breadcrumbs" aria-label="知识库层级"><button type="button" @click="openOverview">{{ currentLibraryName }}</button><template v-if="currentDomain"><span>/</span><button type="button" @click="openDomain(currentDomain.id)">{{ currentDomain.name }}</button></template><template v-if="currentTopic"><span>/</span><span aria-current="page">{{ currentTopic.title }}</span></template></nav>
        <div class="knowledge-filters">
          <label>知识库<select v-model="categoryId"><option value="">全部知识库</option><option v-if="categoryId && !categoryOptions.some((item) => String(item.id) === categoryId)" :value="categoryId" disabled>所选分类不可用</option><option v-for="category in categoryOptions" :key="category.id" :value="String(category.id)">{{ category.name }}</option></select></label>
          <label>搜索当前范围<input v-model="searchQuery" type="search" placeholder="知识点标题" /></label>
          <label>掌握状态<select v-model="masteryFilter"><option value="all">全部</option><option value="mastered">已掌握</option><option value="unmastered">未掌握</option></select></label>
          <p class="filter-note">图中按分类分区，深层分类归入子分区；完整分类见详情。</p>
          <p v-if="librariesLoading" class="filter-note">正在加载知识库分类…</p>
          <p v-else-if="librariesError" class="storage-error" role="alert">{{ librariesError }} <button type="button" @click="loadLibraries">重试</button></p>
          <p v-else-if="!categoryOptions.length" class="filter-note">暂无可选择的一级知识库分类</p>
          <div v-if="searchQuery.trim()" class="search-results">
            <div class="search-result-head"><span>{{ currentLibraryName }} · {{ masteryFilter === 'all' ? '全部状态' : masteryFilter === 'mastered' ? '已掌握' : '未掌握' }} · {{ searchResults.length }} 条结果</span><button type="button" @click="searchQuery = ''">清空</button></div>
            <ul v-if="searchResults.length"><li v-for="item in searchResults.slice(0, 50)" :key="item.id"><button type="button" @click="selectSearchResult(item)">{{ item.title }}</button></li></ul>
            <p v-else class="filter-note">当前范围没有匹配的知识点</p>
            <p v-if="searchResults.length > 50" class="filter-note">显示前 50 条，请继续输入缩小范围</p>
          </div>
        </div>
        <p v-if="mapError" class="storage-error" role="alert">{{ mapError }} <button v-if="!scopeError" type="button" @click="loadMap()">重试</button></p>
        <p v-else-if="!mapLoading && !learningNodes.length" class="detail-note">当前分类暂无公开知识点</p>
        <p v-else-if="!mapLoading && !chipNodes.length" class="detail-note">当前筛选没有匹配的知识点</p>
        <p v-if="storageError" class="storage-error" role="alert">{{ storageError }}</p>
        <p v-if="gpuError" class="storage-error" role="alert">{{ gpuError }}</p>
        <p v-if="glyphWarning" class="storage-error" role="alert">{{ glyphWarning }}</p>
        <div v-if="selected" class="relation-legend"><span class="key-selected">当前</span><span class="key-before">公开前置</span><span class="key-after">范围内后续</span><span>前置 → 后续</span></div>
      </div>
      <div ref="canvas" class="map-canvas" :class="{ 'is-topic': currentTopic }" @click="handleMapClick" @mousemove="handleMapHover">
        <div v-if="!currentTopic && !gpuReady" ref="mapWorld" class="map-world" :style="{ width: `${worldSize}px`, height: `${worldSize}px` }">
          <div v-for="group in chipLayout.groups" :key="group.id" :class="['chip-group', `is-${group.kind}`]" :style="group.style"><span class="group-heading"><span class="group-heading-text" :class="{ scrolling: groupScrollDistance(group) > 0 }" :style="{ '--scroll-distance': `-${groupScrollDistance(group)}px` }">{{ group.title }}</span></span></div>
          <button v-for="tile in chipLayout.tiles" :key="tile.node.id" type="button" :data-node-id="tile.node.id" :class="['map-tile', relationClass(tile.node), { mastered: mastered.has(canonicalId(tile.node.id)) }]" :style="tile.style" :title="`${domainById.get(tile.node.domain_id)?.name} / ${topicNames.get(tile.node.topic_id)} · ${tileLabel(tile.node)}`" :aria-label="tileLabel(tile.node)" @click="selectNode(tile.node)" />
          <svg v-if="!gpuReady" ref="labelLayer" class="label-layer" :viewBox="`0 0 ${worldSize} ${worldSize}`" aria-hidden="true">
            <defs><clipPath v-for="tile in chipLayout.tiles" :id="`knowledge-label-${tile.node.id}`" :key="tile.node.id"><rect :x="parseFloat(tile.style.left) + 4" :y="parseFloat(tile.style.top) + 4" :width="Math.max(0, parseFloat(tile.style.width) - 8)" :height="Math.max(0, parseFloat(tile.style.height) - 8)" /></clipPath></defs>
            <text v-for="tile in chipLayout.tiles" :key="tile.node.id" :x="parseFloat(tile.style.left) + 4" :y="parseFloat(tile.style.top) + 14" :clip-path="`url(#knowledge-label-${tile.node.id})`" :class="relationClass(tile.node)">{{ tile.node.title }}</text>
          </svg>
        </div>
        <section v-if="currentTopic" class="topic-detail">
          <div class="topic-detail-head"><div><h2>{{ currentTopic.title }}</h2><p v-if="stats(currentTopic.nodes).total">{{ stats(currentTopic.nodes).done }} / {{ stats(currentTopic.nodes).total }} 已掌握</p><p v-else>暂无知识点</p></div></div>
          <div class="detail-grid">
            <button v-for="node in currentTopic.nodes" :key="node.id" type="button" :data-node-id="node.id" :class="['detail-tile', relationClass(node)]" :title="tileLabel(node)" :aria-label="tileLabel(node)" @click="selectNode(node)"><i :class="['detail-square', { mastered: mastered.has(canonicalId(node.id)) }]" /><span>{{ node.title }}</span></button>
          </div>
        </section>
        <div v-if="!currentTopic && gpuReady" class="canvas-accessibility" aria-label="知识点列表">
          <button v-for="tile in chipLayout.tiles" :key="tile.node.id" type="button" :aria-label="tileLabel(tile.node)" @focus="focusTile(tile)" @blur="focusedId = ''" @click="selectNode(tile.node)" />
        </div>
        <canvas v-show="!currentTopic && gpuReady" ref="gpuCanvas" class="gpu-labels" aria-hidden="true" />
      </div>
      <div v-if="!currentTopic" class="floating-controls"><MButton size="sm" aria-label="缩小画布" @click="zoomCanvas(0.8)">−</MButton><MButton size="sm" aria-label="放大画布" @click="zoomCanvas(1.25)">+</MButton><MButton size="sm" @click="resetCanvas">全览</MButton></div>
      <div v-if="!currentTopic" class="floating-legend"><span><i class="swatch" />未掌握</span><span><i class="swatch mastered" />已掌握</span><span><i class="boundary-key domain" />分区</span><span><i class="boundary-key topic" />子分区</span><span>{{ totalStats.done }} / {{ totalStats.total }}</span></div>
    </main>
    <aside v-if="selected" ref="detailPanel" class="detail-panel" aria-label="知识点详情">
      <div class="detail-top"><span class="eyebrow font-mono">知识点 / {{ selected.id }}</span><MButton size="sm" variant="ghost" @click="closeDetail">关闭</MButton></div>
      <MButton v-if="returnStack.length" size="sm" variant="ghost" @click="returnToPrevious">返回上一知识点</MButton>
      <h2>{{ detail?.title || selected.title }}</h2>
      <p v-if="!selectedTile" class="detail-note">{{ selectedOutsideMap ? (categoryId ? '该知识点不在当前分类范围内。' : '当前公开地图中没有该知识点。') : '该知识点被当前筛选隐藏。' }} <button type="button" @click="locateSelected">切换范围并定位</button></p>
      <p class="detail-note">{{ mastered.has(selected.id) ? '已掌握' : '未掌握' }} · 保存在本浏览器</p>
      <MButton size="sm" :disabled="masteryLoading || masterySaving || !masteryAvailable" :variant="mastered.has(selected.id) ? 'secondary' : 'primary'" @click="toggleMastery(selected)">{{ mastered.has(selected.id) ? '标记为未掌握' : '标记为已掌握' }}</MButton>
      <p v-if="detailLoading" class="detail-note">正在加载知识点…</p>
      <p v-if="detailError" class="storage-error" role="alert">{{ detailError }} <button type="button" @click="selectNode(selected, true)">重试</button></p>
      <template v-if="detail">
        <p v-if="detail.categories?.length" class="detail-note">分类：{{ detail.categories.map((category) => category.name).join('、') }}<template v-if="detail.categories.length > 1"> · 地图只展示一次</template></p>
        <section class="detail-section"><h3>正文</h3><TypstSource :key="detail.id" :source="detail.source" /></section>
        <p class="detail-note">加入讲义功能待接入</p>
      </template>
      <section class="detail-section"><h3>直接前置</h3><p v-if="prerequisitesError" class="storage-error" role="alert">{{ prerequisitesError }}</p><p v-else-if="!detailLoading && !detailPrerequisites.length" class="detail-note">暂无公开前置知识点。</p><button v-for="item in detailPrerequisites" :key="item.id" class="dependency" type="button" @click="followDependency(item)"><span>{{ item.title }}</span></button></section>
      <section class="detail-section"><h3>当前地图范围内的直接后续</h3><p v-if="!successors.length" class="detail-note">当前范围内没有直接后续。</p><button v-for="item in successors" :key="item.node.id" class="dependency" type="button" @click="followDependency(item.node)"><span>{{ item.node.title }}</span></button></section>
    </aside>
  </section>
</template>

<style scoped>
.knowledge-library { position: relative; display: flex; flex: 1; min-height: 0; overflow: hidden; background: var(--bg-app); color: var(--text-primary); }
.library-main { position: relative; display: flex; flex: 1; min-width: 0; min-height: 0; }
.map-canvas { position: relative; flex: 1; min-width: 0; min-height: 0; overflow: hidden; cursor: grab; touch-action: none; }
.map-canvas:active { cursor: grabbing; }
.map-canvas.is-topic { overflow: auto; cursor: auto; touch-action: auto; }
.map-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; background: var(--bg-app); border-radius: var(--radius-xs); }
.chip-group { position: absolute; box-sizing: border-box; overflow: hidden; background: var(--bg-surface); border: 1px solid color-mix(in srgb, var(--border-hover) var(--group-border-opacity, 100%), transparent); border-radius: var(--radius-xs); pointer-events: none; }
.chip-group.is-topic { background: var(--bg-elevated); border-color: color-mix(in srgb, var(--border-subtle) var(--group-border-opacity, 100%), transparent); }
.chip-group > .group-heading { position: absolute; top: 0; left: 0; right: 0; padding: 9px 12px; overflow: hidden; color: var(--text-primary); white-space: nowrap; text-overflow: ellipsis; font-size: 18px; font-weight: var(--font-weight-medium); opacity: var(--domain-label-opacity, 0); }
.group-heading-text { display: inline-block; white-space: nowrap; }
.group-heading-text.scrolling { animation: title-scroll 6s ease-in-out infinite alternate; }
@keyframes title-scroll { 0%, 15% { transform: translateX(0); } 85%, 100% { transform: translateX(var(--scroll-distance)); } }
@media (prefers-reduced-motion: reduce) { .group-heading-text.scrolling { animation: none; } }
.chip-group.is-topic > .group-heading { padding: 5px 8px; color: var(--text-secondary); font-size: 14px; opacity: var(--topic-label-opacity, 0); }
.map-tile { position: absolute; box-sizing: border-box; min-width: 0; min-height: 0; padding: 4px; overflow: hidden; border: 0; border-radius: var(--radius-xs); background: color-mix(in srgb, var(--text-muted) 32%, var(--bg-hover)); color: var(--text-primary); text-align: left; cursor: pointer; }
.label-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; visibility: hidden; }
.label-layer text { fill: var(--text-primary); font-family: var(--font-ui, sans-serif); font-size: 10px; }
.label-layer text.is-dimmed { opacity: .4; }
.gpu-labels { position: absolute; inset: 0; width: 100%; height: 100%; color: var(--text-primary); }
.canvas-accessibility { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.map-tile.mastered { background: color-mix(in srgb, var(--accent-primary) 60%, var(--bg-hover)); }
.swatch.mastered { background: color-mix(in srgb, var(--accent-primary) 60%, var(--bg-hover)); }
.detail-square.mastered { background: var(--accent-primary); }
.map-tile:hover { outline: 1px solid var(--border-focus); outline-offset: -1px; }
.map-tile.is-dimmed, .detail-tile.is-dimmed { opacity: .4; }
.map-tile.is-selected, .detail-tile.is-selected { outline: 2px solid var(--text-primary); outline-offset: 1px; }
.map-tile.is-prerequisite, .detail-tile.is-prerequisite { outline: 2px solid var(--tag-amber); outline-offset: 1px; }
.map-tile.is-successor, .detail-tile.is-successor { outline: 2px solid var(--tag-purple); outline-offset: 1px; }
.map-tile:focus-visible, .detail-tile:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 1px; }
.floating-info { position: absolute; z-index: 3; top: 16px; left: 18px; max-width: min(340px, calc(100% - 36px)); color: var(--text-secondary); font-size: var(--font-size-smallest); }
.breadcrumbs, .relation-legend, .sample-actions, .floating-legend, .floating-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.breadcrumbs button, .auxiliary button { padding: 0; border: 0; background: transparent; color: var(--text-primary); cursor: pointer; text-align: left; }
.breadcrumbs button:hover, .auxiliary button:hover { color: var(--accent-primary); }
.knowledge-filters { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; padding: 10px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); }
.knowledge-filters label { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.knowledge-filters input, .knowledge-filters select { min-width: 0; width: 145px; padding: 4px 6px; color: var(--text-primary); background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); font: inherit; }
.filter-note { margin: 2px 0; color: var(--text-muted); }
.search-results { border-top: 1px solid var(--border-subtle); padding-top: 6px; }
.search-result-head { display: flex; justify-content: space-between; gap: 8px; }
.search-results ul { list-style: none; max-height: 200px; overflow: auto; margin: 6px 0 0; padding: 0; }
.search-results li button { width: 100%; padding: 5px 4px; color: var(--text-primary); text-align: left; overflow-wrap: anywhere; }
.search-results li button:hover { background: var(--bg-hover); }
.storage-error { color: var(--tag-red); }
.relation-legend { margin-top: 8px; }
.key-selected { color: var(--text-primary); } .key-before { color: var(--tag-amber); } .key-after { color: var(--tag-purple); }
.floating-controls { position: absolute; z-index: 3; right: 18px; bottom: 16px; }
.floating-legend { position: absolute; z-index: 3; left: 18px; bottom: 16px; color: var(--text-secondary); font-size: var(--font-size-smallest); }
.floating-legend span { display: inline-flex; align-items: center; gap: 5px; }
.swatch, .detail-square { display: inline-block; width: 10px; height: 10px; background: var(--text-muted); flex-shrink: 0; }
.swatch { background: color-mix(in srgb, var(--text-muted) 32%, var(--bg-hover)); border: 1px solid var(--border-hover); }
.boundary-key { width: 14px; height: 0; border-top: 2px solid var(--text-secondary); }
.boundary-key.domain { border-top: 3px solid var(--text-primary); }
.topic-detail { min-height: 100%; padding: 86px 24px 24px; background: var(--bg-app); }
.topic-detail h2 { margin: 0; font-size: var(--font-size); }
.topic-detail p { margin: 6px 0 16px; color: var(--text-secondary); font-size: var(--font-size-smaller); }
.detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.detail-tile { display: flex; flex-direction: column; align-items: center; gap: 8px; min-height: 90px; padding: 10px 6px; border: 0; background: transparent; color: var(--text-primary); text-align: center; font-size: var(--font-size-smaller); cursor: pointer; }
.detail-square { width: 28px; height: 28px; }
.auxiliary { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 20px; color: var(--text-muted); font-size: var(--font-size-smaller); }
.detail-panel { position: absolute; z-index: 5; top: 0; right: 0; bottom: 0; width: min(440px, 100%); overflow: auto; padding: 24px; background: var(--bg-surface); border-left: 1px solid var(--border-subtle); }
.detail-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.eyebrow { color: var(--text-muted); font-size: var(--font-size-smallest); }
.detail-path, .detail-note { margin: 8px 0; color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.6; }
.detail-panel h2 { font-size: var(--font-size-larger); line-height: 1.5; }
.detail-section { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--border-subtle); }
.detail-section h3 { font-size: var(--font-size); } .detail-section h3 span { color: var(--text-muted); font-weight: normal; }
.detail-section :deep(.typst-source) { margin-top: 12px; overflow-wrap: anywhere; }
.dependency { display: flex; flex-direction: column; gap: 4px; width: 100%; padding: 10px 0; border: 0; border-bottom: 1px solid var(--border-subtle); background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; font-size: var(--font-size-smaller); }
.dependency:hover { color: var(--accent-primary); } .dependency small { color: var(--text-muted); line-height: 1.5; }
@media (max-width: 760px) { .detail-panel { width: 100%; } .floating-legend { bottom: 56px; } }
</style>
