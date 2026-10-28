<script setup>
import MButton from '../../components/MButton.vue';

defineProps({
  selected: Object, detail: Object, selectedTile: Object, selectedOutsideMap: Boolean,
  locateError: String, detailLoading: Boolean, detailError: String,
  prerequisitesError: String, detailPrerequisites: Array, successors: Array,
  canReturn: Boolean, isMastered: Boolean, masteryLoading: Boolean,
  masterySaving: Boolean, masteryAvailable: Boolean, storageError: String
});
defineEmits(['back', 'locate', 'mastery', 'retry', 'follow']);
</script>

<template>
      <div v-if="selected" class="detail-content">
      <MButton v-if="canReturn" size="sm" variant="ghost" @click="$emit('back')">返回上一知识点</MButton>
      <h2>{{ detail?.title || selected.title }}</h2>
      <p v-if="!selectedTile" class="detail-note">{{ selectedOutsideMap ? '该知识点不在当前知识库范围内。' : '该知识点被当前筛选隐藏。' }} <button type="button" @click="$emit('locate')">切换范围并定位</button></p>
      <p v-if="locateError" class="storage-error" role="alert">{{ locateError }}</p>
      <p v-if="storageError" class="storage-error" role="alert">{{ storageError }}</p>
      <p class="detail-note">{{ isMastered ? '已掌握' : '未掌握' }} · 保存在本浏览器</p>
      <MButton size="sm" :disabled="masteryLoading || masterySaving || !masteryAvailable" :variant="isMastered ? 'secondary' : 'primary'" @click="$emit('mastery', selected)">{{ isMastered ? '标记为未掌握' : '标记为已掌握' }}</MButton>
      <p v-if="detailLoading" class="detail-note">正在加载知识点…</p>
      <p v-if="detailError" class="storage-error" role="alert">{{ detailError }} <button type="button" @click="$emit('retry')">重试</button></p>
      <template v-if="detail">
        <p v-if="detail.categories?.length" class="detail-note">分类：{{ detail.categories.map((category) => category.name).join('、') }}<template v-if="detail.categories.length > 1"> · 地图只展示一次</template></p>
        <section class="detail-section"><h3>正文源码</h3><pre class="knowledge-source">{{ detail.source }}</pre></section>
        <p class="detail-note">加入讲义功能待接入</p>
      </template>
      <section class="detail-section"><h3>直接前置</h3><p v-if="prerequisitesError" class="storage-error" role="alert">{{ prerequisitesError }}</p><p v-else-if="!detailLoading && !detailPrerequisites.length" class="detail-note">暂无公开前置知识点。</p><button v-for="item in detailPrerequisites" :key="item.id" class="dependency" type="button" @click="$emit('follow', item)"><span>{{ item.title }}</span></button></section>
      <section class="detail-section"><h3>当前地图范围内的直接后续</h3><p v-if="!successors.length" class="detail-note">当前范围内没有直接后续。</p><button v-for="item in successors" :key="item.node.id" class="dependency" type="button" @click="$emit('follow', item.node)"><span>{{ item.node.title }}</span></button></section>
      </div>
</template>

<style scoped>
.detail-content { max-width: 820px; margin: 0 auto; padding: 32px clamp(20px, 5vw, 56px) 64px; user-select: text; }
.detail-note { margin: 8px 0; color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.6; }
.storage-error { color: var(--tag-red); }
h2 { margin: 12px 0; font-size: var(--font-size-larger); line-height: 1.5; }
.detail-section { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--border-subtle); }
.detail-section h3 { font-size: var(--font-size); }
.knowledge-source { margin-top: 12px; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.8; }
.dependency { display: flex; width: 100%; padding: 10px 0; border: 0; border-bottom: 1px solid var(--border-subtle); background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; font-size: var(--font-size-smaller); }
.dependency:hover { color: var(--accent-primary); }
.dependency:focus-visible { outline: 2px solid var(--accent-primary); }
</style>
