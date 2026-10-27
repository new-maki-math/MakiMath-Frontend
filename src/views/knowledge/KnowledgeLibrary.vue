<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { knowledgeApi } from '../../api/knowledge.js';
import { getMasteredIds, setMastered } from '../../utils/knowledge-mastery.js';
import KnowledgeMapCanvas from '../../components/KnowledgeMapCanvas.vue';
import TypstSource from '../../components/TypstSource.vue';
import MButton from '../../components/MButton.vue';

const graph = ref(null);
const map = ref({ categories: [], nodes: [], edges: [] });
const categoryId = ref('');
const query = ref('');
const masteryFilter = ref('all');
const masteredIds = ref(new Set());
const masteryError = ref('');
const masteryLoading = ref(true);
const masterySaving = ref(false);
const loading = ref(false);
const error = ref('');
const selectedId = ref(null);
const detail = ref(null);
const detailLoading = ref(false);
const detailError = ref('');
const prerequisites = ref([]);
const prerequisitesError = ref('');
let mapRequest = 0;
let detailRequest = 0;

const categories = computed(() => {
  const items = map.value.categories;
  const ids = new Set(items.map((item) => item.id));
  const children = new Map();
  for (const item of items) {
    const parent = ids.has(item.parent_id) && item.parent_id !== item.id ? item.parent_id : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(item);
  }
  const result = [];
  const visited = new Set();
  const append = (item, depth) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    result.push({ ...item, depth });
    for (const child of children.get(item.id) || []) append(child, depth + 1);
  };
  for (const item of children.get(null) || []) append(item, 0);
  for (const item of items) append(item, 0);
  return result;
});
const visibleNodes = computed(() => {
  const term = query.value.trim().toLocaleLowerCase();
  return map.value.nodes.filter((node) => {
    const matchesText = !term || `${node.title} ${node.summary || ''}`.toLocaleLowerCase().includes(term);
    const mastered = masteredIds.value.has(node.id);
    return matchesText && (masteryFilter.value === 'all' || (masteryFilter.value === 'mastered' ? mastered : !mastered));
  });
});
const visibleIds = computed(() => new Set(visibleNodes.value.map((node) => node.id)));
const masteredCount = computed(() => map.value.nodes.reduce((count, node) => count + Number(masteredIds.value.has(node.id)), 0));
const searchResults = computed(() => query.value.trim() ? visibleNodes.value.slice(0, 30) : []);

async function loadMap() {
  const request = ++mapRequest;
  loading.value = true;
  error.value = '';
  map.value = { categories: map.value.categories, nodes: [], edges: [] };
  selectedId.value = null;
  detailRequest++;
  try {
    const result = await knowledgeApi.map(categoryId.value);
    if (request !== mapRequest) return;
    map.value = result;
  } catch (err) {
    if (request !== mapRequest) return;
    map.value = { categories: map.value.categories, nodes: [], edges: [] };
    error.value = err.status === 404 ? '分类不存在或已归档，请选择其他分类' : '知识地图加载失败，请重试';
  } finally {
    if (request === mapRequest) loading.value = false;
  }
}

async function selectNode(id, focus = false) {
  selectedId.value = id;
  if (focus) graph.value?.focus(id);
  const request = ++detailRequest;
  detail.value = null;
  detailError.value = '';
  prerequisites.value = [];
  prerequisitesError.value = '';
  detailLoading.value = true;
  const [point, relations] = await Promise.allSettled([knowledgeApi.get(id), knowledgeApi.prerequisites(id)]);
  if (request !== detailRequest) return;
  if (point.status === 'fulfilled') detail.value = point.value;
  else detailError.value = point.reason?.status === 404 ? '知识点已不可用，请刷新地图' : '知识点详情加载失败';
  if (relations.status === 'fulfilled') prerequisites.value = relations.value;
  else prerequisitesError.value = '前置知识加载失败';
  detailLoading.value = false;
}

function closeDetail() {
  detailRequest++;
  selectedId.value = null;
  detail.value = null;
}

async function toggleMastery() {
  if (masteryLoading.value || masterySaving.value || masteryError.value || selectedId.value === null) return;
  const id = selectedId.value;
  const previous = masteredIds.value;
  const next = new Set(previous);
  const mastered = !next.has(id);
  if (mastered) next.add(id);
  else next.delete(id);
  masteredIds.value = next;
  masterySaving.value = true;
  try {
    await setMastered(id, mastered);
  } catch {
    masteredIds.value = previous;
    masteryError.value = '掌握状态保存失败，请重新加载本地记录';
  } finally {
    masterySaving.value = false;
  }
}

async function loadMastery() {
  masteryLoading.value = true;
  try {
    masteredIds.value = await getMasteredIds();
    masteryError.value = '';
  } catch {
    masteryError.value = '本地掌握记录读取失败，暂时无法修改';
  } finally {
    masteryLoading.value = false;
  }
}

watch(categoryId, loadMap);
onMounted(() => { loadMastery(); loadMap(); });
onBeforeUnmount(() => { mapRequest++; detailRequest++; });
</script>

<template>
  <section class="knowledge-library">
    <KnowledgeMapCanvas ref="graph" :nodes="map.nodes" :edges="map.edges" :visible-ids="visibleIds" :mastered-ids="masteredIds" :selected-id="selectedId" @select="selectNode" />
    <aside class="map-panel filters">
      <h1>知识地图</h1>
      <label for="map-search">搜索当前地图的标题和简介</label>
      <input id="map-search" v-model="query" type="search" placeholder="搜索知识点" />
      <label for="map-category">知识分类</label>
      <select id="map-category" v-model="categoryId">
        <option value="">全部分类</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">{{ '　'.repeat(category.depth) }}{{ category.name }}</option>
      </select>
      <label for="map-mastery">掌握状态</label>
      <select id="map-mastery" v-model="masteryFilter">
        <option value="all">显示全部</option>
        <option value="mastered">已掌握</option>
        <option value="unmastered">未掌握</option>
      </select>
      <p>当前分类范围：已掌握 {{ masteredCount }} / {{ map.nodes.length }}<span v-if="map.nodes.length">（{{ Math.round(masteredCount / map.nodes.length * 100) }}%）</span></p>
      <div class="legend"><span><i class="dot idle" />未掌握</span><span><i class="dot mastered" />已掌握</span></div>
      <p>箭头指向后续知识</p>
      <div class="controls"><MButton size="sm" aria-label="缩小" @click="graph?.zoomBy(0.8)">−</MButton><MButton size="sm" aria-label="放大" @click="graph?.zoomBy(1.25)">+</MButton><MButton size="sm" @click="graph?.fit()">全览</MButton></div>
      <div v-if="masteryError" role="alert">{{ masteryError }} <MButton size="sm" @click="loadMastery">重试</MButton></div>
      <p v-if="loading">正在加载地图</p>
      <div v-else-if="error"><p role="alert">{{ error }}</p><MButton size="sm" @click="loadMap">重试</MButton></div>
      <p v-else-if="!map.nodes.length">当前范围暂无知识点</p>
      <p v-else-if="!visibleNodes.length">没有符合条件的知识点</p>
      <div v-if="searchResults.length" class="search-results">
        <p>匹配 {{ visibleNodes.length }} 项，显示前 {{ searchResults.length }} 项</p>
        <button v-for="node in searchResults" :key="node.id" type="button" @click="selectNode(node.id, true)">{{ node.title }}</button>
      </div>
    </aside>
    <aside v-if="selectedId !== null" class="map-panel detail">
      <div class="detail-heading"><strong>知识点详情</strong><MButton size="sm" variant="ghost" @click="closeDetail">关闭</MButton></div>
      <p v-if="detailLoading">正在加载详情</p>
      <div v-else-if="detailError"><p role="alert">{{ detailError }}</p><MButton size="sm" @click="selectNode(selectedId)">重试</MButton></div>
      <template v-else-if="detail">
        <h2>{{ detail.title }}</h2>
        <p v-if="detail.summary">{{ detail.summary }}</p>
        <p class="version">当前公开版本 {{ detail.revision_no || detail.revision_id }}</p>
        <MButton :disabled="masteryLoading || masterySaving || !!masteryError" @click="toggleMastery">{{ masteredIds.has(selectedId) ? '标记为未掌握' : '标记为已掌握' }}</MButton>
        <h3>前置知识</h3>
        <p v-if="prerequisitesError">{{ prerequisitesError }} <MButton size="sm" @click="selectNode(selectedId)">重试</MButton></p>
        <p v-else-if="!prerequisites.length">暂无公开前置知识</p>
        <ul v-else><li v-for="item in prerequisites" :key="item.id">{{ item.title }} <span>{{ masteredIds.has(item.id) ? '已掌握' : '未掌握' }}</span></li></ul>
        <TypstSource :source="detail.source || ''" />
        <p class="pending">加入讲义功能待新工作台接入</p>
      </template>
    </aside>
  </section>
</template>

<style scoped>
.knowledge-library { position: relative; height: calc(100vh - 120px); min-height: 520px; overflow: hidden; background: var(--bg-app); }
.map-panel { position: absolute; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-primary); }
.filters { top: 16px; left: 16px; width: 270px; padding: 16px; display: flex; flex-direction: column; gap: 8px; max-height: calc(100% - 32px); overflow: auto; }
h1 { font-size: 18px; margin: 0 0 8px; }
label, .version, .pending, .filters p, .detail p, .legend { color: var(--text-secondary); font-size: 12px; }
input, select { width: 100%; padding: 8px; color: var(--text-primary); background: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); }
.search-results { display: flex; flex-direction: column; gap: 4px; }
.search-results button { text-align: left; padding: 6px; border: 0; border-radius: var(--radius-sm); background: var(--bg-app); color: var(--text-primary); cursor: pointer; }
.search-results button:hover { background: var(--bg-hover); }
.detail { top: 16px; right: 16px; bottom: 16px; width: min(420px, calc(100% - 32px)); padding: 16px; overflow: auto; }
.detail-heading { display: flex; justify-content: space-between; align-items: center; }
.detail h2 { margin: 16px 0 8px; font-size: 20px; }
.detail h3 { margin: 20px 0 8px; font-size: 14px; }
.detail ul { padding-left: 18px; font-size: 13px; }
.detail li span { color: var(--text-muted); }
.pending { margin-top: 24px; }
.legend, .controls { display: flex; align-items: center; gap: 12px; }
.controls { gap: 6px; }
.dot { display: inline-block; width: 8px; height: 8px; margin-right: 5px; border-radius: 50%; }
.idle { background: #858b91; }
.mastered { background: #20a997; }
@media (max-width: 700px) {
  .knowledge-library { height: calc(100vh - 100px); }
  .filters { width: 220px; max-height: 42%; }
  .detail { top: auto; bottom: 16px; max-height: 55%; }
  .legend { font-size: 11px; }
}
</style>
