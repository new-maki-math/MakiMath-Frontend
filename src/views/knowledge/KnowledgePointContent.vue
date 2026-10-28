<script setup>
import { computed, ref, watch } from 'vue';
import MButton from '../../components/MButton.vue';
import { notify } from '../../components/MNotice.vue';
import TypstDoc from '../../components/Renderer/TypstDoc.vue';
import KnowledgeAddToLecture from './KnowledgeAddToLecture.vue';

const props = defineProps({
  selected: Object, detail: Object, selectedTile: Object, selectedOutsideMap: Boolean,
  locateError: String, detailLoading: Boolean, detailError: String,
  prerequisitesError: String, detailPrerequisites: Array, successors: Array,
  canReturn: Boolean, isMastered: Boolean, masteryLoading: Boolean,
  masterySaving: Boolean, masteryAvailable: Boolean, storageError: String,
  showMapControls: { type: Boolean, default: true }
});
defineEmits(['back', 'locate', 'mastery', 'retry', 'follow', 'relations']);
const referenceSlug = computed(() => props.detail?.slug || props.selected?.slug || '');
const addOpen = ref(false);
watch(() => props.selected?.id, () => { addOpen.value = false; });
async function copyReference() {
  try {
    await navigator.clipboard.writeText(`#mm-knowledge(slug: "${referenceSlug.value}")`);
    notify('引用代码已复制', 'success');
  } catch { notify('复制失败，请手动复制引用代码', 'error'); }
}
</script>

<template>
  <article v-if="selected" class="detail-content">
    <MButton v-if="canReturn" class="back-button" size="sm" variant="ghost" @click="$emit('back')">返回上一知识点</MButton>
    <header class="detail-header">
      <h2>{{ detail?.title || selected.title }}</h2>
      <div class="detail-meta">
        <span class="mastery-status" :class="{ 'is-mastered': isMastered }"><i aria-hidden="true"></i>{{ isMastered ? '已掌握' : '未掌握' }}</span>
        <span>保存在本浏览器</span>
        <span v-if="detail?.categories?.length">{{ detail.categories.map((category) => category.name).join(' / ') }}</span>
      </div>
      <div class="detail-actions">
        <MButton size="sm" :disabled="masteryLoading || masterySaving || !masteryAvailable" :variant="isMastered ? 'secondary' : 'primary'" @click="$emit('mastery', selected)">{{ isMastered ? '标记为未掌握' : '标记为已掌握' }}</MButton>
        <MButton size="sm" variant="secondary" :disabled="!detail || detailLoading || !referenceSlug" @click="addOpen = true">添加到我的讲义</MButton>
        <MButton v-if="showMapControls" size="sm" variant="secondary" :disabled="!selectedTile || detailLoading" @click="$emit('relations')">查看引用关系</MButton>
      </div>
      <p v-if="showMapControls && !selectedTile" class="detail-note">{{ selectedOutsideMap ? '该知识点不在当前知识库范围内。' : '该知识点被当前筛选隐藏。' }} <button class="text-action" type="button" @click="$emit('locate')">切换范围并定位</button></p>
      <p v-if="locateError" class="storage-error" role="alert">{{ locateError }}</p>
      <p v-if="storageError" class="storage-error" role="alert">{{ storageError }}</p>
    </header>

    <p v-if="detailLoading" class="detail-note content-state">正在加载知识点…</p>
    <p v-if="detailError" class="storage-error content-state" role="alert">{{ detailError }} <button class="text-action" type="button" @click="$emit('retry')">重试</button></p>
    <section v-if="detail" class="detail-body">
      <TypstDoc :source="detail.source || ''" :box-title="detail.title || ''" :allow-knowledge-references="false" />
      <div v-if="referenceSlug" class="reference-code"><code>#mm-knowledge(slug: "{{ referenceSlug }}")</code><MButton size="sm" @click="copyReference">复制</MButton></div>
      <p v-else class="detail-note">知识点标识未提供，暂无法生成引用代码。</p>
    </section>

    <div class="relations" :class="{ 'without-map': !showMapControls }">
      <section class="relation-section">
        <h3>直接前置</h3>
        <p v-if="prerequisitesError" class="storage-error" role="alert">{{ prerequisitesError }}</p>
        <p v-else-if="!detailLoading && !detailPrerequisites.length" class="detail-note">暂无公开前置知识点。</p>
        <button v-for="item in detailPrerequisites" :key="item.id" class="dependency" type="button" @click="$emit('follow', item)">{{ item.title }}<span aria-hidden="true">→</span></button>
      </section>
      <section v-if="showMapControls" class="relation-section">
        <h3>当前地图范围内的直接后续</h3>
        <p v-if="!successors.length" class="detail-note">当前范围内没有直接后续。</p>
        <button v-for="item in successors" :key="item.node.id" class="dependency" type="button" @click="$emit('follow', item.node)">{{ item.node.title }}<span aria-hidden="true">→</span></button>
      </section>
    </div>
    <KnowledgeAddToLecture :open="addOpen" :knowledge-slug="referenceSlug" @close="addOpen = false" />
  </article>
</template>

<style scoped>
.detail-content { max-width: 820px; margin: 0 auto; padding: 32px clamp(20px, 5vw, 56px) 64px; user-select: text; }
.back-button { margin: 0 0 12px -8px; }
.detail-header h2 { margin: 12px 0; color: var(--text-primary); font-size: var(--font-size-larger); line-height: 1.5; overflow-wrap: anywhere; }
.detail-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 16px; color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.6; }
.mastery-status { display: inline-flex; align-items: center; gap: 6px; color: var(--text-primary); }
.mastery-status i { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); }
.mastery-status.is-mastered i { background: var(--accent-primary); }
.detail-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.detail-note { margin: 8px 0 0; color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.6; }
.storage-error { margin: 8px 0 0; color: var(--tag-red); line-height: 1.6; }
.text-action { color: var(--accent-primary); cursor: pointer; }
.text-action:hover { text-decoration: underline; }
.detail-body, .content-state { margin-top: 32px; }
.reference-code { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 24px; padding: 10px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); }
.reference-code code { min-width: 0; overflow-wrap: anywhere; color: var(--text-secondary); }
.relations { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border-subtle); }
.relations.without-map { grid-template-columns: 1fr; }
.relation-section { min-width: 0; }
.relation-section h3 { margin: 0 0 12px; color: var(--text-primary); font-size: var(--font-size-smaller); font-weight: var(--font-weight-semibold); }
.dependency { display: flex; justify-content: space-between; gap: 12px; width: 100%; padding: 10px 0; border: 0; border-bottom: 1px solid var(--border-subtle); background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; font-size: var(--font-size-smaller); overflow-wrap: anywhere; }
.dependency span { flex: none; color: var(--text-muted); }
.dependency:hover, .dependency:hover span { color: var(--accent-primary); }
.dependency:focus-visible, .text-action:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
@media (max-width: 600px) { .relations { grid-template-columns: 1fr; } }
</style>
