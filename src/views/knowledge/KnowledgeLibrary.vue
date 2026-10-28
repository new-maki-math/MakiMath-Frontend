<script setup>
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { commandServiceKey } from '../../commands/index.js';
import { hierarchy, select, treemap, treemapBinary, treemapSquarify, zoom, zoomIdentity } from 'd3';
import { knowledgeApi } from '../../api/knowledge.js';
import { managementApi } from '../../api/management.js';
import { getMasteredIds, setMastered, setMasteredBatch, subscribeMasteryChanges } from '../../utils/knowledge-mastery.js';
import MButton from '../../components/MButton.vue';
import KnowledgePointOverlay from './KnowledgePointOverlay.vue';
import KnowledgePointContent from './KnowledgePointContent.vue';
import MInput from '../../components/MInput.vue';
import MSelect from '../../components/MSelect.vue';
import MLoadingMask from '../../components/MLoadingMask.vue';
import { createKnowledgeRenderer } from './knowledge-webgpu-renderer.js';

const commandService = inject(commandServiceKey);
const route = useRoute();
let unregisterCommands;
const mapLoading = ref(false);
const categoryId = ref('');
const libraries = ref([]);
const librariesLoading = ref(false);
const librariesError = ref('');
let librariesSequence = 0;
const searchQuery = ref('');
const masteryAvailable = ref(false);
const mapError = ref('');
const scopeError = ref(false);
const detail = ref(null);
const detailLoading = ref(false);
const detailError = ref('');
const locateError = ref('');
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
const reading = ref(false);
const readingClosing = ref(false);
const overlaySession = ref(0);
const readingOverlay = ref(null);
let returnFocus = null;
let restoringFocus = false;
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
let resolutionQuery;
let canvasZoom;
let fitted = false;
let zoomFrame = 0;
let zoomTarget = null;
const selected = ref(null);
watch(selected, (node) => { if (!node && reading.value) closeReading(); });
const focusedId = ref('');
const showingRelations = ref(false);
const openingHighlight = ref('');
const returnStack = ref([]);
const graph = ref({ categories: [], nodes: [], edges: [] });
const domains = ref([]);
const domainById = new Map();
const nodeById = new Map();
const topicNames = new Map();
const canonicalId = (id) => id;
const learningNodes = computed(() => graph.value.nodes);
const categoryOptions = computed(() => libraries.value.filter((item) => item.parent_id === null));
const currentLibraryName = computed(() => categoryOptions.value.find((item) => String(item.id) === categoryId.value)?.name || (categoryId.value ? '所选知识库不可用' : '请选择知识库'));
const librarySelectOptions = computed(() => [
  { value: '', label: '请选择知识库', disabled: true },
  ...(categoryId.value && !categoryOptions.value.some((item) => String(item.id) === categoryId.value) ? [{ value: categoryId.value, label: '所选分类不可用', disabled: true }] : []),
  ...categoryOptions.value.map((item) => ({ value: String(item.id), label: item.name }))
]);
async function loadLibraries() {
  const sequence = ++librariesSequence;
  librariesLoading.value = true;
  librariesError.value = '';
  try {
    const result = await managementApi.categories('knowledge');
    if (disposed || sequence !== librariesSequence) return;
    if (!Array.isArray(result)) throw new Error('知识分类数据不完整');
    libraries.value = result;
    const roots = result.filter((item) => item.parent_id === null);
    if (!categoryId.value && roots.length) categoryId.value = String(roots[0].id);
    else if (categoryId.value && !roots.some((item) => String(item.id) === categoryId.value)) {
      mapSequence++;
      detailSequence++;
      mapLoading.value = false;
      graph.value = { categories: [], nodes: [], edges: [] };
      domains.value = [];
      nodeById.clear();
      selected.value = null;
      returnStack.value = [];
      mapError.value = '所选知识库不存在或已归档，请重新选择。';
    }
  } catch {
    if (!disposed && sequence === librariesSequence) librariesError.value = '知识库分类加载失败';
  } finally {
    if (!disposed && sequence === librariesSequence) librariesLoading.value = false;
  }
}
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
  if (!categoryId.value) return false;
  showingRelations.value = false;
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
    if (!reading.value) { selected.value = null; detailSequence++; }
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

let masteryReadSequence = 0;
let unsubscribeMastery;
async function loadMastery() {
  const sequence = ++masteryReadSequence;
  try {
    const ids = await getMasteredIds();
    if (sequence === masteryReadSequence && !disposed) { mastered.value = ids; masteryAvailable.value = true; }
  } catch {
    if (sequence === masteryReadSequence && !disposed) storageError.value = '本地掌握记录读取失败，暂时无法修改。';
  } finally { if (sequence === masteryReadSequence) masteryLoading.value = false; }
}
const uniqueIds = (nodes) => new Set(nodes.map((node) => node.slug));
const stats = (nodes) => {
  const ids = uniqueIds(nodes);
  let done = 0;
  for (const id of ids) if (mastered.value.has(id)) done++;
  return { done, total: ids.size, percent: ids.size ? Math.round(done / ids.size * 100) : 0 };
};
const totalStats = computed(() => stats(learningNodes.value));
function masteryCommandUnavailableReason() {
  if (disposed || route.name !== 'knowledge-library') return '请先进入知识库页面。';
  if (librariesLoading.value) return '知识库分类正在加载，请稍后重试。';
  if (librariesError.value) return '知识库分类加载失败，请先重试。';
  if (!categoryId.value) return '请先选择知识库。';
  if (mapLoading.value) return '知识库数据正在加载，请稍后重试。';
  if (mapError.value) return '知识库数据加载失败，请先重试。';
  if (graph.value.filter?.category_id !== Number(categoryId.value)) return '当前知识库数据尚未就绪。';
  if (masteryLoading.value) return '掌握状态正在加载，请稍后重试。';
  if (!masteryAvailable.value) return '本地掌握状态不可用。';
  if (masterySaving.value) return '掌握状态正在写入，请稍后重试。';
  if (!graph.value.nodes.length) return '当前知识库没有公开知识点。';
  return '';
}
const chipNodes = computed(() => {
  const seen = new Set();
  return domains.value.flatMap((domain) => domain.nodes).filter((node) => {
    const id = canonicalId(node.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
});
const searchResults = computed(() => {
  const term = searchQuery.value.trim().toLocaleLowerCase();
  return term ? chipNodes.value.filter((node) => node.title.toLocaleLowerCase().includes(term)) : [];
});
const searchResultIds = computed(() => new Set(searchResults.value.map((node) => node.id)));
function selectSearchResult(node) {
  const tile = chipLayout.value.tiles.find((item) => item.node.id === node.id);
  if (tile) focusTile(tile);
  activateNode(node);
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
  const libraryGroup = categoryId.value && !mapError.value ? {
    id: `library-${categoryId.value}`, kind: 'domain', isLibrary: true, title: currentLibraryName.value,
    nodes: entries, fontSize: 18,
    style: { left: '0px', top: '0px', width: `${worldSize}px`, height: `${worldSize}px` }
  } : null;
  if (!entries.length) return { groups: libraryGroup ? [libraryGroup] : [], tiles: [] };
  const children = domains.value.map((domain) => {
    const topics = domain.topics.map((topic) => {
      const nodes = entries.filter((node) => node.domain_id === domain.id && node.topic_id === topic.id);
      const weightSum = nodes.reduce((sum, node) => sum + visualWeight(node.id), 0);
      return { title: topic.title, kind: 'topic', children: nodes.map((node) => ({ node, weight: visualWeight(node.id) * nodes.length / weightSum })) };
    }).filter((topic) => topic.children.length);
    return { title: domain.name, kind: 'domain', children: topics };
  }).filter((domain) => domain.children.length);
  const root = hierarchy({ children }).sum((item) => item.weight || 0);
  treemap().size([worldSize - 32, worldSize - 70]).tile(orderedTreemap)
    .paddingOuter((node) => node.depth === 1 ? 10 : node.depth === 2 ? 7 : 0)
    .paddingTop((node) => node.depth === 1 ? 42 : node.depth === 2 ? 28 : 0)
    .paddingInner((node) => node.depth === 0 ? 12 : node.depth === 1 ? 8 : 2)
    .round(true)(root);
  const style = (node) => ({ left: `${node.x0 + 16}px`, top: `${node.y0 + 54}px`, width: `${Math.max(0, node.x1 - node.x0)}px`, height: `${Math.max(0, node.y1 - node.y0)}px` });
  return {
    groups: [...(libraryGroup ? [libraryGroup] : []), ...root.descendants().filter((node) => node.depth === 1 || node.depth === 2).map((node) => ({
      id: `${node.depth}-${node.data.title}`, kind: node.data.kind, title: node.data.title,
      nodes: node.leaves().map((leaf) => leaf.data.node),
      fontSize: node.depth === 1 ? 18 : 14,
      style: style(node)
    }))],
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
    const domainOpacity = labelOpacity(canvasTransform.k, 0.32, 0.52).toFixed(1);
    const topicOpacity = labelOpacity(canvasTransform.k, 0.58, 0.8).toFixed(1);
    if (mapWorld.value.style.getPropertyValue('--domain-label-opacity') !== domainOpacity) mapWorld.value.style.setProperty('--domain-label-opacity', domainOpacity);
    if (mapWorld.value.style.getPropertyValue('--topic-label-opacity') !== topicOpacity) mapWorld.value.style.setProperty('--topic-label-opacity', topicOpacity);
  }
  const opacity = labelOpacity(canvasTransform.k, 0.95, 1.2);
  if (labelLayer.value) {
    labelLayer.value.style.visibility = opacity ? 'visible' : 'hidden';
    labelLayer.value.style.opacity = opacity;
  }
  requestGpuDraw();
  readingOverlay.value?.syncSource();
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
    library: readColor('var(--bg-surface)'), domain: readColor('var(--bg-elevated)'), topic: readColor('color-mix(in srgb, var(--bg-elevated) 80%, var(--text-muted))'),
    domainBorder: readColor('color-mix(in srgb, var(--text-secondary) 38%, transparent)'), topicBorder: readColor('color-mix(in srgb, var(--text-secondary) 22%, transparent)'),
    unmastered: readColor('color-mix(in srgb, var(--text-muted) 38%, var(--bg-hover))'),
    mastered: readColor('color-mix(in srgb, var(--accent-primary) 50%, var(--tree-selected-bg))'),
    text: readColor('var(--text-primary)'), masteredText: readColor('var(--tree-selected-fg)'),
    selected: readColor('var(--text-primary)'), before: readColor('var(--tag-orange)'), after: readColor('var(--tag-green)')
  };
  probe.remove();
}
function drawGpuFrame() {
  gpuFrame = 0;
  const animating = gpuRenderer?.draw(canvasTransform, canvasWidth.value, canvasHeight.value, gpuColor, [
    labelOpacity(canvasTransform.k, 0.32, 0.52), labelOpacity(canvasTransform.k, 0.58, 0.8), labelOpacity(canvasTransform.k, 0.95, 1.2)
  ], !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (animating) requestGpuDraw();
}
function requestGpuDraw() {
  if (!gpuRenderer || gpuFrame) return;
  gpuFrame = requestAnimationFrame(drawGpuFrame);
}
function syncMapFrame() {
  if (!gpuRenderer) return;
  cancelAnimationFrame(gpuFrame);
  drawGpuFrame();
}
async function rebuildGpuLabels() {
  if (!gpuRenderer || !gpuCanvas.value) return;
  const renderer = gpuRenderer;
  const sequence = ++gpuSceneSequence;
  try {
    const groups = chipLayout.value.groups;
    const applied = await renderer.setTiles(chipLayout.value.tiles, relationClass, getComputedStyle(gpuCanvas.value).fontFamily, groups, (node) => mastered.value.has(node.slug), gpuPalette);
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
    await new Promise((resolve) => requestAnimationFrame(resolve));
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
watch(searchQuery, () => { showingRelations.value = false; });
watch(categoryId, () => { if (!suppressCategoryWatch && categoryId.value) { returnStack.value = []; searchQuery.value = ''; loadMap(); } });
watch([chipLayout, selected, reading, mastered, focusedId, detailPrerequisites, searchResultIds, showingRelations], rebuildGpuLabels, { flush: 'post' });
watch([canvasWidth, canvasHeight], requestGpuDraw, { flush: 'post' });
function watchResolution() {
  resolutionQuery?.removeEventListener('change', watchResolution);
  resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  resolutionQuery.addEventListener('change', watchResolution);
  requestGpuDraw();
}
onMounted(() => {
  unregisterCommands = commandService?.registerKnowledgeContext({ unavailableReason: masteryCommandUnavailableReason, updateMastery: updateLibraryMastery });
  window.addEventListener('resize', requestGpuDraw);
  watchResolution();
  canvasZoom = zoom().scaleExtent([0.1, 8]).filter((event) => {
    if (event.button) return false;
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
  unsubscribeMastery = subscribeMasteryChanges(loadMastery);
  loadMastery();
  loadLibraries();
  initializeGpu();
  themeObserver = new MutationObserver(() => { updateGpuColor(); rebuildGpuLabels(); });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
});
onUnmounted(() => {
  disposed = true;
  masteryReadSequence++;
  unsubscribeMastery?.();
  unregisterCommands?.();
  window.removeEventListener('resize', requestGpuDraw);
  resolutionQuery?.removeEventListener('change', watchResolution);
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
function related(direction, target = selected.value) {
  if (!target) return [];
  const selectedId = canonicalId(target.id);
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
  const focus = showingRelations.value ? selected.value : null;
  if (!focus) {
    if (searchQuery.value.trim()) return searchResultIds.value.has(node.id) ? 'is-selected' : 'is-dimmed';
    return canonicalId(node.id) === canonicalId(focusedId.value) ? 'is-selected' : '';
  }
  const id = canonicalId(node.id);
  if (id === canonicalId(focus.id)) return 'is-selected';
  const prerequisites = detailPrerequisites.value;
  const next = successors.value;
  if (prerequisites.some((item) => canonicalId(item.id) === id)) return 'is-prerequisite';
  if (next.some((item) => canonicalId(item.node.id) === id)) return 'is-successor';
  return 'is-dimmed';
};
async function toggleMastery(node) {
  if (!node || masteryLoading.value || masterySaving.value || !masteryAvailable.value) return;
  storageError.value = '';
  const previous = mastered.value;
  const next = new Set(previous);
  const value = !next.has(node.slug);
  if (value) next.add(node.slug);
  else next.delete(node.slug);
  mastered.value = next;
  masterySaving.value = true;
  try { await setMastered(node.slug, value); }
  catch { mastered.value = previous; storageError.value = '掌握状态保存失败，请重试。'; }
  finally { masterySaving.value = false; }
}
async function updateLibraryMastery(randomize) {
  const reason = masteryCommandUnavailableReason();
  if (reason) return { ok: false, message: reason };
  const ids = [...new Set(graph.value.nodes.map((node) => node.slug))];
  const changes = new Map();
  for (const id of ids) {
    if (randomize) {
      if (!mastered.value.has(id) && Math.random() < 0.5) changes.set(id, true);
    } else if (mastered.value.has(id)) changes.set(id, false);
  }
  if (randomize && !changes.size) {
    const candidates = ids.filter((id) => !mastered.value.has(id));
    if (candidates.length) changes.set(candidates[Math.floor(Math.random() * candidates.length)], true);
  }
  if (!changes.size) return { ok: true, message: randomize ? '当前知识库没有需要随机标记的知识点。' : '当前知识库没有已掌握的知识点。', count: 0 };
  masterySaving.value = true;
  storageError.value = '';
  try {
    await setMasteredBatch(changes);
    if (disposed) return { ok: true, message: `已更新 ${changes.size} 个知识点。`, count: changes.size };
    const next = new Set(mastered.value);
    for (const [id, value] of changes) {
      if (value) next.add(id);
      else next.delete(id);
    }
    mastered.value = next;
    return { ok: true, message: `已更新 ${changes.size} 个知识点。`, count: changes.size };
  } catch {
    if (!disposed) storageError.value = '批量更新掌握状态失败，原状态已保留。';
    return { ok: false, message: '批量更新掌握状态失败，原状态已保留。' };
  } finally {
    if (!disposed) masterySaving.value = false;
  }
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
  if (!canvas.value || !canvasZoom) return;
  select(canvas.value).interrupt();
  const current = zoomTarget || canvasTransform;
  const k = Math.max(0.1, Math.min(8, current.k * factor));
  const ratio = k / current.k;
  zoomTarget = { x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio, k };
  if (!zoomFrame) zoomFrame = requestAnimationFrame(animateZoom);
}
function handleCanvasWheel(event) {
  if (!canvas.value) return;
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
async function selectNode(node, preserveHistory = false) {
  const sequence = ++detailSequence;
  selected.value = node;
  if (!preserveHistory) returnStack.value = [];
  detail.value = null;
  locateError.value = '';
  detailPrerequisites.value = [];
  detailError.value = '';
  prerequisitesError.value = '';
  detailLoading.value = true;
  const [point, relations] = await Promise.allSettled([knowledgeApi.get(node.id), knowledgeApi.prerequisites(node.id)]);
  if (sequence !== detailSequence || disposed) return;
  if (point.status === 'fulfilled') detail.value = point.value;
  else detailError.value = point.reason?.status === 404 ? '知识点已不可用，请刷新地图。' : '知识点详情加载失败。';
  if (relations.status === 'fulfilled') detailPrerequisites.value = relations.value;
  else prerequisitesError.value = '前置知识加载失败。';
  detailLoading.value = false;
}
function tileAt(event) {
  if (!gpuReady.value || !canvas.value || event.target !== gpuCanvas.value) return null;
  const bounds = canvas.value.getBoundingClientRect();
  const x = (event.clientX - bounds.left - canvasTransform.x) / canvasTransform.k;
  const y = (event.clientY - bounds.top - canvasTransform.y) / canvasTransform.k;
  return chipLayout.value.tiles.find((tile) => {
    const left = parseFloat(tile.style.left);
    const top = parseFloat(tile.style.top);
    return x >= left && y >= top && x < left + parseFloat(tile.style.width) && y < top + parseFloat(tile.style.height);
  }) || null;
}
function handleOverlayPan({ event, type }) {
  if (!canvas.value || !canvasZoom) return;
  const handler = select(canvas.value).on(`${type}.zoom`);
  if (!handler) return;
  const mapEvent = type === 'mousedown' ? new Proxy(event, {
    get(target, key) {
      if (key === 'currentTarget') return canvas.value;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  }) : event;
  handler.call(canvas.value, mapEvent);
}
function handleBackgroundClick(event) {
  if (event.defaultPrevented || reading.value || !showingRelations.value) return;
  showingRelations.value = false;
}
function handleMapClick(event) {
  if (event.defaultPrevented) return;
  const tile = tileAt(event);
  if (tile) activateNode(tile.node);
}
function handleMapHover(event) {
  if (!gpuReady.value || !gpuCanvas.value) return;
  const tile = tileAt(event);
  gpuCanvas.value.title = tile ? `${domainById.get(tile.node.domain_id)?.name} / ${topicNames.get(tile.node.topic_id)} · ${tileLabel(tile.node)}` : '';
  gpuCanvas.value.style.cursor = tile ? 'pointer' : 'grab';
}
function showRelations() {
  if (!selectedTile.value) return;
  showingRelations.value = true;
  readingOverlay.value?.dismiss();
}
function focusTile(tile) {
  focusedId.value = tile.node.id;
  if (restoringFocus) return;
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
      node: selected.value, categoryId: categoryId.value, query: searchQuery.value,
      transform: { x: canvasTransform.x, y: canvasTransform.y, k: canvasTransform.k }
    });
  }
  const target = nodeById.get(node.id) || node;
  selectNode(target, true);
  const tile = chipLayout.value.tiles.find((item) => item.node.id === target.id);
  if (tile) focusTile(tile);
}

async function switchCategory(value) {
  if (!value || !categoryOptions.value.some((item) => String(item.id) === value)) {
    locateError.value = '目标知识库不存在或已归档，请重新选择。';
    return false;
  }
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

function findLibraryForDetail() {
  if (!detail.value || detail.value.id !== selected.value?.id) return null;
  const categories = new Map(libraries.value.map((item) => [item.id, item]));
  for (const linked of detail.value.categories || []) {
    const seen = new Set();
    let category = categories.get(linked.id);
    while (category && !seen.has(category.id)) {
      seen.add(category.id);
      if (category.parent_id === null) return String(category.id);
      category = categories.get(category.parent_id);
    }
  }
  return null;
}
async function locateSelected() {
  const target = selected.value;
  if (!target) return;
  locateError.value = '';
  const previousQuery = searchQuery.value;
  if (!nodeById.has(target.id)) {
    if (detailLoading.value) { locateError.value = '请等待知识点详情加载完成。'; return; }
    if (librariesError.value || librariesLoading.value) { locateError.value = '知识库分类尚未加载，请先重试分类加载。'; return; }
    const targetLibrary = findLibraryForDetail();
    if (!targetLibrary) { locateError.value = '无法确定该知识点所属的有效一级知识库。'; return; }
    const loaded = await switchCategory(targetLibrary);
    if (loaded !== true) return;
    const current = nodeById.get(target.id);
    if (!current) {
      await selectNode(target, true);
      locateError.value = '该知识点未出现在所选知识库的公开地图中，无法定位。';
      return;
    }
    selectNode(current, true);
  }
  searchQuery.value = '';
  await nextTick();
  const tile = chipLayout.value.tiles.find((item) => item.node.id === target.id);
  if (tile) focusTile(tile);
  else {
    searchQuery.value = previousQuery;
    locateError.value = '当前知识库中无法定位该知识点。';
  }
}

async function returnToPrevious() {
  const previous = returnStack.value.pop();
  if (!previous) return;
  const currentQuery = searchQuery.value;
  searchQuery.value = previous.query;
  const loaded = await switchCategory(previous.categoryId);
  if (loaded !== true) {
    if (loaded === false) { searchQuery.value = currentQuery; returnStack.value.push(previous); }
    return;
  }
  selectNode(nodeById.get(previous.node.id) || previous.node, true);
  await nextTick();
  if (canvas.value && canvasZoom) {
    const { x, y, k } = previous.transform;
    select(canvas.value).interrupt().call(canvasZoom.transform, zoomIdentity.translate(x, y).scale(k));
  }
}

function activateNode(node) {
  if (reading.value && !readingClosing.value) return;
  if (showingRelations.value && relationClass(node) === 'is-dimmed') {
    showingRelations.value = false;
    return;
  }
  openingHighlight.value = relationClass(node);
  showingRelations.value = false;
  readingClosing.value = false;
  overlaySession.value++;
  returnFocus = document.activeElement;
  stopSmoothZoom();
  select(canvas.value).interrupt();
  searchQuery.value = '';
  selectNode(node);
  reading.value = true;
}
function glyphAdvance(character) {
  return gpuRenderer?.glyphAdvance(character);
}
function readingSourceRect() {
  const tile = selectedTile.value;
  if (!tile || !canvas.value) return null;
  const bounds = canvas.value.getBoundingClientRect();
  const left = bounds.left + canvasTransform.x + parseFloat(tile.style.left) * canvasTransform.k;
  const top = bounds.top + canvasTransform.y + parseFloat(tile.style.top) * canvasTransform.k;
  const width = parseFloat(tile.style.width) * canvasTransform.k;
  const height = parseFloat(tile.style.height) * canvasTransform.k;
  return { left, top, width, height, right: left + width, bottom: top + height, fontSize: 10 * canvasTransform.k, titleOpacity: labelOpacity(canvasTransform.k, 0.95, 1.2) };
}
function closeReading(sessionId) {
  if (sessionId != null && sessionId !== overlaySession.value) return;
  readingClosing.value = false;
  reading.value = false;
  nextTick(() => { restoringFocus = true; if (returnFocus?.isConnected && returnFocus !== document.body) returnFocus.focus(); else canvas.value?.focus(); restoringFocus = false; });
}
const tileLabel = (node) => `${node.title}，${mastered.value.has(node.slug) ? '已掌握' : '未掌握'}，激活打开阅读`;
</script>

<template>
  <section class="knowledge-library">
    <MLoadingMask :visible="mapLoading || gpuInitializing || glyphLoading" :text="mapLoading ? '正在加载知识地图…' : '正在准备知识点字形…'" :z-index="50" />
    <main ref="libraryMain" class="library-main" @click="handleBackgroundClick">
      <div class="floating-info" :inert="reading">
        <div class="knowledge-filters">
          <MSelect v-model="categoryId" aria-label="选择知识库" :options="librarySelectOptions" />
          <MInput v-model="searchQuery" aria-label="搜索知识点标题" type="search" placeholder="搜索知识点标题" />
          <p v-if="librariesLoading" class="filter-note">正在加载知识库分类…</p>
          <p v-else-if="librariesError" class="storage-error" role="alert">{{ librariesError }} <button type="button" @click="loadLibraries">重试</button></p>
          <p v-else-if="!categoryOptions.length" class="filter-note">暂无可选择的一级知识库分类</p>
          <div v-if="searchQuery.trim()" class="search-results">
            <div class="search-result-head"><span>{{ searchResults.length }} 条结果</span><button type="button" @click="searchQuery = ''">清空</button></div>
            <ul v-if="searchResults.length"><li v-for="item in searchResults.slice(0, 50)" :key="item.id"><button type="button" @click="selectSearchResult(item)">{{ item.title }}</button></li></ul>
            <p v-else class="filter-note">当前范围没有匹配的知识点</p>
            <p v-if="searchResults.length > 50" class="filter-note">显示前 50 条，请继续输入缩小范围</p>
          </div>
        </div>
        <p v-if="mapError" class="storage-error" role="alert">{{ mapError }} <button v-if="!scopeError" type="button" @click="loadMap()">重试</button></p>
        <p v-else-if="categoryId && !mapLoading && !learningNodes.length" class="detail-note">当前分类暂无公开知识点</p>
        <p v-else-if="categoryId && !mapLoading && !chipNodes.length" class="detail-note">当前筛选没有匹配的知识点</p>
        <p v-if="storageError" class="storage-error" role="alert">{{ storageError }}</p>
        <p v-if="gpuError" class="storage-error" role="alert">{{ gpuError }}</p>
        <p v-if="glyphWarning" class="storage-error" role="alert">{{ glyphWarning }}</p>
        <div v-if="showingRelations && selected" class="relation-info">
          <p>正在查看：{{ selected.title }}</p>
          <p><span class="relation-label before">前置</span><span class="relation-label after">后续</span></p>
          <p>前置和后续仅在当前地图范围内高亮</p>
          <p v-if="prerequisitesError" class="storage-error" role="alert">{{ prerequisitesError }}</p>
          <MButton size="sm" @click="showingRelations = false">退出关系查看</MButton>
        </div>
      </div>
      <div ref="canvas" class="map-canvas" tabindex="-1" :inert="reading && !readingClosing" @click="handleMapClick" @mousemove="handleMapHover">
        <div v-if="!gpuReady" ref="mapWorld" class="map-world" :style="{ width: `${worldSize}px`, height: `${worldSize}px` }">
          <div v-for="group in chipLayout.groups" :key="group.id" :class="['chip-group', `is-${group.kind}`, { 'is-library': group.isLibrary }]" :style="group.style"><span class="group-heading"><span class="group-heading-text" :class="{ scrolling: groupScrollDistance(group) > 0 }" :style="{ '--scroll-distance': `-${groupScrollDistance(group)}px` }">{{ group.title }}</span></span></div>
          <button v-for="tile in chipLayout.tiles" :key="tile.node.id" type="button" :data-node-id="tile.node.id" :class="['map-tile', relationClass(tile.node), { mastered: mastered.has(tile.node.slug) }]" :style="tile.style" :title="`${domainById.get(tile.node.domain_id)?.name} / ${topicNames.get(tile.node.topic_id)} · ${tileLabel(tile.node)}`" :aria-label="tileLabel(tile.node)" @click.stop="activateNode(tile.node)" />
          <svg v-if="!gpuReady" ref="labelLayer" class="label-layer" :viewBox="`0 0 ${worldSize} ${worldSize}`" aria-hidden="true">
            <defs><clipPath v-for="tile in chipLayout.tiles" :id="`knowledge-label-${tile.node.id}`" :key="tile.node.id"><rect :x="parseFloat(tile.style.left) + 4" :y="parseFloat(tile.style.top) + 4" :width="Math.max(0, parseFloat(tile.style.width) - 8)" :height="Math.max(0, parseFloat(tile.style.height) - 8)" /></clipPath></defs>
            <text v-for="tile in chipLayout.tiles" :key="tile.node.id" :x="parseFloat(tile.style.left) + 4" :y="parseFloat(tile.style.top) + 14" :clip-path="`url(#knowledge-label-${tile.node.id})`" :class="[relationClass(tile.node), { mastered: mastered.has(tile.node.slug) }]">{{ tile.node.title }}</text>
          </svg>
        </div>
        <div v-if="gpuReady" class="canvas-accessibility" aria-label="知识点列表">
          <button v-for="tile in chipLayout.tiles" :key="tile.node.id" type="button" :aria-label="tileLabel(tile.node)" @focus="focusTile(tile)" @blur="focusedId = ''" @click.stop="activateNode(tile.node)" />
        </div>
        <canvas v-show="gpuReady" ref="gpuCanvas" class="gpu-labels" aria-hidden="true" />
      </div>
      <div class="floating-controls" :inert="reading"><MButton size="sm" aria-label="缩小画布" @click="zoomCanvas(0.8)">−</MButton><MButton size="sm" aria-label="放大画布" @click="zoomCanvas(1.25)">+</MButton><MButton size="sm" @click="resetCanvas">全览</MButton></div>
      <div class="floating-legend" :inert="reading"><span><i class="swatch" />未掌握</span><span><i class="swatch mastered" />已掌握</span><span><i class="boundary-key domain" />分区</span><span><i class="boundary-key topic" />子分区</span><span>{{ totalStats.done }} / {{ totalStats.total }}</span></div>
      <KnowledgePointOverlay v-if="reading && selected" ref="readingOverlay" :key="overlaySession" :session-id="overlaySession" :source-rect="readingSourceRect" :glyph-advance="glyphAdvance" :before-frame="syncMapFrame" :animation-title="selected.title" :title="detail?.title || selected.title" :node-id="selected.id" :gpu-enabled="gpuReady" :mastered="mastered.has(selected.slug)" :highlight="openingHighlight" @closing="readingClosing = true" @closed="closeReading" @zoom="handleCanvasWheel" @pan="handleOverlayPan">
        <KnowledgePointContent :selected="selected" :detail="detail" :selected-tile="selectedTile" :selected-outside-map="selectedOutsideMap" :locate-error="locateError" :detail-loading="detailLoading" :detail-error="detailError" :prerequisites-error="prerequisitesError" :detail-prerequisites="detailPrerequisites" :successors="successors" :can-return="Boolean(returnStack.length)" :is-mastered="mastered.has(selected.slug)" :mastery-loading="masteryLoading" :mastery-saving="masterySaving" :mastery-available="masteryAvailable" :storage-error="storageError" @relations="showRelations" @back="returnToPrevious" @locate="locateSelected" @mastery="toggleMastery" @retry="selectNode(selected, true)" @follow="followDependency" />
      </KnowledgePointOverlay>
    </main>

  </section>
</template>

<style scoped>
.knowledge-library { position: relative; display: flex; flex: 1; min-height: 0; overflow: hidden; background: var(--bg-app); color: var(--text-primary); }
.library-main { position: relative; display: flex; flex: 1; min-width: 0; min-height: 0; }
.map-canvas { position: relative; flex: 1; min-width: 0; min-height: 0; overflow: hidden; cursor: grab; touch-action: none; }
.map-canvas:active { cursor: grabbing; }
.map-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; background: var(--bg-app); border-radius: var(--radius-xs); }
.chip-group { position: absolute; box-sizing: border-box; overflow: hidden; background: var(--bg-elevated); border: 1px solid color-mix(in srgb, color-mix(in srgb, var(--text-secondary) 38%, transparent) var(--group-border-opacity, 100%), transparent); border-radius: var(--radius-xs); pointer-events: none; }
.chip-group.is-library { background: var(--bg-surface); }
.chip-group.is-topic { background: color-mix(in srgb, var(--bg-elevated) 80%, var(--text-muted)); border-color: color-mix(in srgb, color-mix(in srgb, var(--text-secondary) 22%, transparent) var(--group-border-opacity, 100%), transparent); }
.chip-group > .group-heading { position: absolute; top: 0; left: 0; right: 0; padding: 9px 12px; overflow: hidden; color: var(--text-primary); white-space: nowrap; text-overflow: ellipsis; font-size: 18px; font-weight: var(--font-weight-medium); opacity: var(--domain-label-opacity, 0); }
.group-heading-text { display: inline-block; white-space: nowrap; }
.group-heading-text.scrolling { animation: title-scroll 6s ease-in-out infinite alternate; }
@keyframes title-scroll { 0%, 15% { transform: translateX(0); } 85%, 100% { transform: translateX(var(--scroll-distance)); } }
@media (prefers-reduced-motion: reduce) { .group-heading-text.scrolling { animation: none; } }
.chip-group.is-topic > .group-heading { padding: 5px 8px; color: var(--text-secondary); font-size: 14px; opacity: var(--topic-label-opacity, 0); }
.map-tile { position: absolute; box-sizing: border-box; min-width: 0; min-height: 0; padding: 4px; overflow: hidden; border: 0; outline: 2px solid transparent; outline-offset: 1px; border-radius: var(--radius-xs); background: color-mix(in srgb, var(--text-muted) 38%, var(--bg-hover)); color: var(--text-primary); text-align: left; cursor: pointer; transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), outline-color 200ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms cubic-bezier(0.16, 1, 0.3, 1); }
.label-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; visibility: hidden; }
.label-layer text { transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1); fill: var(--text-primary); font-family: var(--font-ui, sans-serif); font-size: 10px; }
.label-layer text.mastered { fill: var(--tree-selected-fg); }
.label-layer text.is-dimmed { opacity: .4; }
.gpu-labels { position: absolute; inset: 0; width: 100%; height: 100%; color: var(--text-primary); }
.canvas-accessibility { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.map-tile.mastered { background: color-mix(in srgb, var(--accent-primary) 50%, var(--tree-selected-bg)); }
.swatch.mastered { background: color-mix(in srgb, var(--accent-primary) 50%, var(--tree-selected-bg)); }
.map-tile:hover { outline: 1px solid var(--border-focus); outline-offset: -1px; }
.map-tile.is-dimmed { opacity: .4; }
.map-tile.is-selected { background: color-mix(in srgb, color-mix(in srgb, var(--text-muted) 38%, var(--bg-hover)) 88%, white); }
.map-tile.mastered.is-selected { background: color-mix(in srgb, color-mix(in srgb, var(--accent-primary) 50%, var(--tree-selected-bg)) 88%, white); }
.map-tile.is-prerequisite { background: color-mix(in srgb, var(--tag-orange) 45%, var(--bg-hover)); animation: relation-breathe 2s ease-in-out infinite; }
.map-tile.is-successor { background: color-mix(in srgb, var(--tag-green) 45%, var(--bg-hover)); animation: relation-breathe 2s ease-in-out infinite; }
@keyframes relation-breathe { 0%, 100% { filter: brightness(.7); } 50% { filter: brightness(1.35); } }
.map-tile:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 1px; }
.floating-info { position: absolute; z-index: 3; top: 16px; left: 18px; max-width: min(260px, calc(100% - 36px)); color: var(--text-secondary); font-size: var(--font-size-smallest); }
.floating-legend, .floating-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.knowledge-filters { display: flex; flex-direction: column; gap: 10px; width: min(260px, calc(100vw - 72px)); box-sizing: border-box; padding: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); }
.relation-info { margin-top: 8px; padding: 10px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); }
.relation-label.before { color: var(--tag-orange); }
.relation-label.after { margin-left: 12px; color: var(--tag-green); }
.relation-info p { margin: 0 0 8px; line-height: 1.5; overflow-wrap: anywhere; }
.filter-note { margin: 2px 0; color: var(--text-muted); }
.search-results { border-top: 1px solid var(--border-subtle); padding-top: 6px; }
.search-result-head { display: flex; justify-content: space-between; gap: 8px; }
.search-results ul { list-style: none; max-height: 200px; overflow: auto; margin: 6px 0 0; padding: 0; }
.search-results li button { width: 100%; padding: 7px 8px; border-radius: var(--radius-xs); color: var(--text-primary); text-align: left; overflow-wrap: anywhere; }
.search-results li button:hover { background: var(--bg-hover); }
.search-results li button:focus-visible, .dependency:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: -2px; }
.storage-error { color: var(--tag-red); }
.floating-controls { position: absolute; z-index: 3; right: 18px; bottom: 16px; gap: 4px; padding: 5px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); }
.floating-legend { position: absolute; z-index: 3; left: 18px; bottom: 16px; gap: 12px; padding: 9px 10px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); color: var(--text-secondary); font-size: var(--font-size-smallest); }
.floating-legend span { display: inline-flex; align-items: center; gap: 5px; }
.swatch { display: inline-block; width: 10px; height: 10px; flex-shrink: 0; border-radius: var(--radius-xs); }
.swatch { background: color-mix(in srgb, var(--text-muted) 38%, var(--bg-hover)); border: 1px solid var(--border-hover); }
.boundary-key { width: 14px; height: 0; border-top: 2px solid var(--text-secondary); }
.boundary-key.domain { border-top: 3px solid var(--text-primary); }
.detail-content { padding: 16px; user-select: text; }
.eyebrow { color: var(--text-muted); font-size: var(--font-size-smallest); }
.detail-path, .detail-note { margin: 8px 0; color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.6; }
.detail-content h2 { font-size: var(--font-size-larger); line-height: 1.5; }
.detail-section { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--border-subtle); }
.detail-section h3 { font-size: var(--font-size); } .detail-section h3 span { color: var(--text-muted); font-weight: normal; }
.knowledge-source { margin-top: 12px; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
.dependency { display: flex; flex-direction: column; gap: 4px; width: 100%; padding: 10px 0; border: 0; border-bottom: 1px solid var(--border-subtle); background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; font-size: var(--font-size-smaller); }
.dependency:hover { color: var(--accent-primary); } .dependency small { color: var(--text-muted); line-height: 1.5; }
@media (prefers-reduced-motion: reduce) { .map-tile, .label-layer text { transition: none; animation: none; } }
@media (max-width: 760px) { .floating-legend { bottom: 56px; } }
</style>
