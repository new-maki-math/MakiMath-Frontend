<script setup>
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { commandServiceKey } from '../../commands/index.js';
import { hierarchy, treemap, treemapBinary, treemapSquarify } from 'd3';
import { knowledgeApi } from '../../api/knowledge.js';
import { managementApi } from '../../api/management.js';
import { getMasteredIds, setMastered, setMasteredBatch, subscribeMasteryChanges } from '../../utils/knowledge-mastery.js';
import MButton from '../../components/MButton.vue';
import KnowledgePointOverlay from './KnowledgePointOverlay.vue';
import KnowledgePointContent from './KnowledgePointContent.vue';
import MInput from '../../components/MInput.vue';
import MSelect from '../../components/MSelect.vue';
import MLoadingMask from '../../components/MLoadingMask.vue';
import MCollapse from '../../components/MCollapse.vue';
import KnowledgeCanvas2D from './KnowledgeCanvas2D.vue';

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
const filtersOpen = ref(false);
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
const canvas2dRef = ref(null);
const reading = ref(false);
const readingClosing = ref(false);
const overlaySession = ref(0);
const readingOverlay = ref(null);
let returnFocus = null;
let disposed = false;
const worldSize = 2000;
const selected = ref(null);
watch(selected, (node) => { if (!node && reading.value) closeReading(); });
const focusedId = ref('');
const showingRelations = ref(false);
const openingColor = ref('');
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
    canvas2dRef.value?.fit();
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
watch(searchQuery, () => { showingRelations.value = false; });
watch(categoryId, () => { if (!suppressCategoryWatch && categoryId.value) { returnStack.value = []; searchQuery.value = ''; loadMap(); } });
onMounted(() => {
  unregisterCommands = commandService?.registerKnowledgeContext({ unavailableReason: masteryCommandUnavailableReason, updateMastery: updateLibraryMastery });
  unsubscribeMastery = subscribeMasteryChanges(loadMastery);
  loadMastery();
  loadLibraries();
});
onUnmounted(() => {
  disposed = true;
  masteryReadSequence++;
  unsubscribeMastery?.();
  unregisterCommands?.();
  mapSequence++;
  librariesSequence++;
  detailSequence++;
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
function handleOverlayPan(event) { canvas2dRef.value?.handlePan(event); }
function handleBackgroundClick(event) {
  if (event.defaultPrevented || reading.value || !showingRelations.value) return;
  showingRelations.value = false;
}
function showRelations() {
  if (!selectedTile.value) return;
  showingRelations.value = true;
  readingOverlay.value?.dismiss();
}
function focusTile(tile) {
  focusedId.value = tile.node.id;
  canvas2dRef.value?.focusTile(tile);
}
const nodeStates = computed(() => Object.fromEntries(chipLayout.value.tiles.map((tile) => [tile.node.id, relationClass(tile.node)])));
const selectedTile = computed(() => selected.value && chipLayout.value.tiles.find((tile) => tile.node.id === selected.value.id));
const selectedOutsideMap = computed(() => selected.value && !graph.value.nodes.some((node) => node.id === selected.value.id));

function followDependency(node) {
  if (selected.value) {
    returnStack.value.push({
      node: selected.value, categoryId: categoryId.value, query: searchQuery.value,
      transform: canvas2dRef.value?.getTransform()
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
  if (previous.transform) canvas2dRef.value?.setTransform(previous.transform);
}

function activateNode(node) {
  if (reading.value && !readingClosing.value) return;
  if (showingRelations.value && relationClass(node) === 'is-dimmed') {
    showingRelations.value = false;
    return;
  }
  openingColor.value = canvas2dRef.value?.sourceRect(node.id)?.color || '';
  showingRelations.value = false;
  readingClosing.value = false;
  overlaySession.value++;
  returnFocus = document.activeElement;
  searchQuery.value = '';
  selectNode(node);
  reading.value = true;
}
function readingSourceRect() {
  return selected.value ? canvas2dRef.value?.sourceRect(selected.value.id) : null;
}
function closeReading(sessionId) {
  if (sessionId != null && sessionId !== overlaySession.value) return;
  readingClosing.value = false;
  reading.value = false;
  nextTick(() => { if (returnFocus?.isConnected && returnFocus !== document.body) returnFocus.focus(); });
}
</script>

<template>
  <section class="knowledge-library">
    <MLoadingMask :visible="mapLoading" text="正在加载知识地图…" :z-index="50" />
    <main class="library-main" @click="handleBackgroundClick">
      <div class="floating-info" :inert="reading">
        <button class="filter-toggle" type="button" :aria-expanded="filtersOpen" aria-controls="knowledge-filters" @click="filtersOpen = !filtersOpen"><span>{{ currentLibraryName }}</span><span>{{ filtersOpen ? '收起' : '筛选与搜索' }}</span></button>
        <MCollapse id="knowledge-filters" :open="filtersOpen" :inert="!filtersOpen">
        <div class="knowledge-filters">
          <MSelect v-model="categoryId" aria-label="选择知识库" :options="librarySelectOptions" />
          <MInput v-model="searchQuery" aria-label="搜索知识点标题" type="search" placeholder="搜索知识点标题" />
          <p v-if="librariesLoading" class="filter-note">正在加载知识库分类…</p>
          <p v-else-if="librariesError" class="storage-error" role="alert">{{ librariesError }} <button type="button" @click="loadLibraries">重试</button></p>
          <p v-else-if="!categoryOptions.length" class="filter-note">暂无可选择的一级知识库分类</p>
          <div v-if="searchQuery.trim()" class="search-results">
            <div class="search-result-head"><span>{{ searchResults.length }} 条结果</span><button type="button" @click="searchQuery = ''">清空</button></div>
            <ul v-if="searchResults.length"><li v-for="item in searchResults.slice(0, 50)" :key="item.id"><button type="button" @click="selectSearchResult(item); filtersOpen = false">{{ item.title }}</button></li></ul>
            <p v-else class="filter-note">当前范围没有匹配的知识点</p>
            <p v-if="searchResults.length > 50" class="filter-note">显示前 50 条，请继续输入缩小范围</p>
          </div>
        </div>
        </MCollapse>
        <p v-if="mapError" class="storage-error" role="alert">{{ mapError }} <button v-if="!scopeError" type="button" @click="loadMap()">重试</button></p>
        <p v-else-if="categoryId && !mapLoading && !learningNodes.length" class="detail-note">当前分类暂无公开知识点</p>
        <p v-else-if="categoryId && !mapLoading && !chipNodes.length" class="detail-note">当前筛选没有匹配的知识点</p>
        <p v-if="storageError" class="storage-error" role="alert">{{ storageError }}</p>
        <div v-if="showingRelations && selected" class="relation-info">
          <p>正在查看：{{ selected.title }}</p>
          <p><span class="relation-label before">前置</span><span class="relation-label after">后续</span></p>
          <p>前置和后续仅在当前地图范围内高亮</p>
          <p v-if="prerequisitesError" class="storage-error" role="alert">{{ prerequisitesError }}</p>
          <MButton size="sm" @click="showingRelations = false">退出关系查看</MButton>
        </div>
      </div>
      <KnowledgeCanvas2D ref="canvas2dRef" :layout="chipLayout" :mastered="mastered" :states="nodeStates" :pulse="showingRelations" :world-size="worldSize" :category-id="categoryId" @activate="activateNode" @background="showingRelations = false" @focus="focusedId = $event.id" @blur="focusedId = ''" />
      <div class="floating-legend" :inert="reading"><span><i class="swatch" />未掌握</span><span><i class="swatch mastered" />已掌握</span><span><i class="boundary-key domain" />分区</span><span><i class="boundary-key topic" />子分区</span><span>{{ totalStats.done }} / {{ totalStats.total }}</span></div>
      <KnowledgePointOverlay v-if="reading && selected" ref="readingOverlay" :key="overlaySession" :session-id="overlaySession" :source-rect="readingSourceRect" :animation-title="selected.title" :title="detail?.title || selected.title" :node-id="selected.id" :canvas2d-enabled="true" :mastered="mastered.has(selected.slug)" :opening-color="openingColor" @closing="readingClosing = true" @closed="closeReading" @zoom="canvas2dRef?.onWheel($event)" @pan="handleOverlayPan">
        <KnowledgePointContent :selected="selected" :detail="detail" :selected-tile="selectedTile" :selected-outside-map="selectedOutsideMap" :locate-error="locateError" :detail-loading="detailLoading" :detail-error="detailError" :prerequisites-error="prerequisitesError" :detail-prerequisites="detailPrerequisites" :successors="successors" :can-return="Boolean(returnStack.length)" :is-mastered="mastered.has(selected.slug)" :mastery-loading="masteryLoading" :mastery-saving="masterySaving" :mastery-available="masteryAvailable" :storage-error="storageError" @relations="showRelations" @back="returnToPrevious" @locate="locateSelected" @mastery="toggleMastery" @retry="selectNode(selected, true)" @follow="followDependency" />
      </KnowledgePointOverlay>
    </main>

  </section>
</template>

<style scoped>
.knowledge-library { position: relative; display: flex; flex: 1; min-height: 0; overflow: hidden; background: var(--bg-app); color: var(--text-primary); }
.library-main { position: relative; display: flex; flex: 1; min-width: 0; min-height: 0; }
.swatch.mastered { background: color-mix(in srgb, var(--accent-primary) 50%, var(--tree-selected-bg)); }
.floating-info { position: absolute; z-index: 3; top: 16px; left: 18px; max-width: min(260px, calc(100% - 36px)); color: var(--text-secondary); font-size: var(--font-size-smallest); }
.filter-toggle { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: min(260px, calc(100vw - 36px)); min-height: 38px; padding: 0 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); background: var(--bg-surface); color: var(--text-primary); text-align: left; cursor: pointer; }
.filter-toggle span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.filter-toggle span:last-child { flex: none; color: var(--text-secondary); }
.filter-toggle:hover { background: var(--bg-hover); }
.filter-toggle:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
.floating-legend { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.knowledge-filters { display: flex; flex-direction: column; gap: 10px; width: min(260px, calc(100vw - 36px)); box-sizing: border-box; margin-top: 4px; padding: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); }
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
@media (prefers-reduced-motion: reduce) { #knowledge-filters, #knowledge-filters :deep(.m-collapse-inner) { transition-duration: 0ms; } }
@media (max-width: 760px) {
  .floating-info { top: 10px; left: 10px; max-width: calc(100% - 20px); }
  .filter-toggle { width: min(260px, calc(100vw - 20px)); min-height: 44px; }
  .knowledge-filters { width: min(320px, calc(100vw - 20px)); max-height: min(55dvh, 400px); overflow-y: auto; overscroll-behavior: contain; }
  .knowledge-filters :deep(input), .knowledge-filters :deep(select) { min-height: 44px; font-size: 16px; }
  .search-results ul { max-height: min(30dvh, 200px); }
  .search-results li button, .search-result-head button { min-height: 44px; }
  .floating-legend { left: 10px; bottom: calc(max(10px, env(safe-area-inset-bottom)) + 60px); max-width: calc(100% - 20px); gap: 6px 10px; padding: 7px 9px; }
}
</style>
