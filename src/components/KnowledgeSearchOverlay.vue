<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { knowledgeApi } from '../api/knowledge.js';
import { getMasteredIds, subscribeMasteryChanges, toggleMastered } from '../utils/knowledge-mastery.js';
import KnowledgePointOverlay from '../views/knowledge/KnowledgePointOverlay.vue';
import KnowledgePointContent from '../views/knowledge/KnowledgePointContent.vue';

const selected = ref(null);
const detail = ref(null);
const prerequisites = ref([]);
const detailLoading = ref(false);
const detailError = ref('');
const prerequisitesError = ref('');
const mastered = ref(new Set());
const masteryLoading = ref(true);
const masterySaving = ref(false);
const masteryAvailable = ref(false);
const storageError = ref('');
const history = ref([]);
const overlay = ref(null);
const session = ref(0);
const isMastered = computed(() => Boolean(detail.value?.slug && mastered.value.has(detail.value.slug)));
let sequence = 0;
let masterySequence = 0;
let disposed = false;
let unsubscribe;
let returnFocus = null;

async function refreshMastery() {
  const current = ++masterySequence;
  try {
    const ids = await getMasteredIds();
    if (current === masterySequence && !disposed) { mastered.value = ids; masteryAvailable.value = true; storageError.value = ''; }
  } catch {
    if (current === masterySequence && !disposed) { masteryAvailable.value = false; storageError.value = '本地掌握记录读取失败，暂时无法修改。'; }
  } finally { if (current === masterySequence && !disposed) masteryLoading.value = false; }
}
async function loadPoint(node) {
  const current = ++sequence;
  selected.value = node;
  detail.value = null;
  prerequisites.value = [];
  detailError.value = '';
  prerequisitesError.value = '';
  detailLoading.value = true;
  const [point, relations] = await Promise.allSettled([knowledgeApi.get(node.id), knowledgeApi.prerequisites(node.id)]);
  if (current !== sequence || disposed) return;
  if (point.status === 'fulfilled') detail.value = point.value;
  else detailError.value = point.reason?.status === 404 ? '知识点已不可用，请重试搜索。' : '知识点详情加载失败。';
  if (relations.status === 'fulfilled') prerequisites.value = relations.value;
  else prerequisitesError.value = '前置知识加载失败。';
  detailLoading.value = false;
}
function openPoint(node, focusTarget) {
  const id = Number(node?.id);
  if (!Number.isSafeInteger(id) || id < 1) return false;
  returnFocus = focusTarget || document.activeElement;
  history.value = [];
  session.value++;
  loadPoint({ ...node, id });
  return true;
}
function follow(node) {
  if (!node?.id || !selected.value) return;
  history.value.push(selected.value);
  loadPoint(node);
}
function back() {
  const previous = history.value.pop();
  if (previous) loadPoint(previous);
}
async function toggle() {
  if (!detail.value?.slug || masterySaving.value || !masteryAvailable.value) return;
  const slug = detail.value.slug;
  masterySaving.value = true;
  storageError.value = '';
  try { await toggleMastered(slug); }
  catch { storageError.value = '掌握状态保存失败，请重试。'; }
  finally { masterySaving.value = false; }
}
function closed() {
  sequence++;
  selected.value = null;
  detail.value = null;
  history.value = [];
  nextTick(() => { if (returnFocus?.isConnected) returnFocus.focus(); returnFocus = null; });
}
onMounted(() => { unsubscribe = subscribeMasteryChanges(refreshMastery); refreshMastery(); });
onBeforeUnmount(() => { disposed = true; sequence++; masterySequence++; unsubscribe?.(); });
defineExpose({ openPoint });
</script>

<template>
  <Teleport to="body">
    <div v-if="selected" class="search-knowledge-overlay">
      <KnowledgePointOverlay ref="overlay" :key="session" :session-id="session" :source-rect="() => null" :title="detail?.title || selected.title" :node-id="selected.id" :mastered="isMastered" @closed="closed">
        <KnowledgePointContent :selected="selected" :detail="detail" :show-map-controls="false" :detail-loading="detailLoading" :detail-error="detailError" :prerequisites-error="prerequisitesError" :detail-prerequisites="prerequisites" :successors="[]" :can-return="Boolean(history.length)" :is-mastered="isMastered" :mastery-loading="masteryLoading" :mastery-saving="masterySaving" :mastery-available="masteryAvailable" :storage-error="storageError" @mastery="toggle" @retry="loadPoint(selected)" @follow="follow" @back="back" />
      </KnowledgePointOverlay>
    </div>
  </Teleport>
</template>

<style scoped>
.search-knowledge-overlay { position: fixed; inset: 0; z-index: 150; }
</style>
