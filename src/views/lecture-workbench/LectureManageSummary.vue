<script setup>
import WorkbenchPanel from './WorkbenchPanel.vue';
import MButton from '../../components/MButton.vue';

defineProps({ item: Object, loading: Boolean, error: { type: String, default: '' } });
defineEmits(['retry', 'open']);

function publicationStatus(value) {
  return { published: '已上架', unpublished: '未上架', withdrawn: '已下架', archived: '已归档' }[value] || '状态未知';
}
function revisionStatus(value) {
  return { draft: '草稿', pending: '审核中', approved: '已通过', rejected: '已驳回' }[value] || '状态未知';
}
function revisionLabel(revision) {
  if (!revision) return '暂无版本';
  const kind = { working_draft: '草稿版本', snapshot: '快照版本' }[revision.kind] || '版本类型未知';
  return revision.revision_no == null ? `${kind} · 版本号未提供` : `${kind} · V${revision.revision_no}`;
}
</script>

<template>
  <WorkbenchPanel kind="LECTURE" :title="item?.latest_revision?.title || '讲义信息'" :editable="false">
    <p v-if="loading" class="summary-note">正在加载讲义信息…</p>
    <p v-else-if="error" class="summary-error" role="alert">{{ error }} <MButton size="sm" variant="ghost" @click="$emit('retry')">重试</MButton></p>
    <div v-else-if="item" class="summary-fields">
      <div><span>所有者</span><strong>{{ item.owner_username || '未提供' }}</strong></div>
      <div><span>讲义状态</span><strong>{{ publicationStatus(item.publication_status) }}</strong></div>
      <div><span>最新版本</span><strong>{{ revisionLabel(item.latest_revision) }}</strong></div>
      <div v-if="item.latest_revision"><span>版本审核状态</span><strong>{{ revisionStatus(item.latest_revision.status) }}</strong></div>
      <MButton v-if="item.latest_revision" @click="$emit('open')">打开讲义</MButton>
    </div>
  </WorkbenchPanel>
</template>

<style scoped>
.summary-fields { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
.summary-fields > div { display: flex; flex-direction: column; gap: 6px; }
.summary-fields span, .summary-note { color: var(--text-secondary); font-size: var(--font-size-smaller); }
.summary-fields strong { color: var(--text-primary); font-weight: var(--font-weight-medium); }
.summary-error { color: var(--tag-red); }
</style>
