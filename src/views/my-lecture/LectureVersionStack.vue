<script setup>
import { computed, ref, watch } from 'vue';
import { NavArrowRight, Xmark } from '@iconoir/vue';
import MLectureCover from '../../components/MLectureCover.vue';

const props = defineProps({ lecture: { type: Object, required: true } });
defineEmits(['open', 'retry']);
const expanded = ref(false);
watch(() => props.lecture.id, () => { expanded.value = false; });
const sortedVersions = computed(() => {
  const versions = props.lecture.versions || [];
  return [
    ...versions.filter((version) => version.is_public && !version.invalidDraft),
    ...versions.filter((version) => !version.is_public && version.kind === 'working_draft' && !version.invalidDraft),
    ...versions.filter((version) => version.invalidDraft || (!version.is_public && version.kind !== 'working_draft'))
  ];
});

function versionName(version) {
  if (version.invalidDraft) return '版本数据异常';
  if (version.kind === 'working_draft') return '草稿版本';
  return version.revision_no == null ? '版本号未提供' : `V${version.revision_no}`;
}

function versionStatus(version) {
  if (version.invalidDraft) return '请联系管理员处理';
  if (version.is_public) return '当前公开';
  if (version.kind === 'working_draft') return '编辑中';
  return { pending: '审核中', approved: '已通过', rejected: '已驳回' }[version.status] || '状态未知';
}

</script>

<template>
  <div class="version-stack" :class="{ 'has-versions': lecture.versions?.length > 1 }">
    <MLectureCover :title="lecture.title" :subtitle="lecture.subtitle || ''" :aria-expanded="expanded" @click="expanded = !expanded" />
    <div v-if="expanded" class="version-list" @wheel.stop>
      <div class="version-head"><span>讲义版本</span><button type="button" aria-label="收起版本" @click="expanded = false"><Xmark width="15" height="15" /></button></div>
      <p v-if="lecture.versionsLoading" class="version-message">正在加载版本…</p>
      <template v-else-if="lecture.versionsError"><p class="version-message">版本加载失败</p><button class="version-retry" type="button" @click="$emit('retry', lecture)">重试</button></template>
      <p v-else-if="!lecture.versions?.length" class="version-message">暂无可查看版本</p>
      <button v-for="version in sortedVersions" :key="version.revision_id" class="version-item" :class="{ 'is-public': version.is_public && !version.invalidDraft }" type="button" :disabled="version.invalidDraft" :title="version.invalidDraft ? '版本记录异常，请联系管理员处理' : undefined" @click="$emit('open', lecture, version)">
        <span class="version-name">{{ versionName(version) }}</span>
        <span class="version-meta">{{ versionStatus(version) }}</span>
        <NavArrowRight v-if="!version.invalidDraft" class="version-arrow" width="14" height="14" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.version-stack { position: relative; flex: 0 0 auto; height: 100%; max-height: 255px; aspect-ratio: 210 / 297; margin-right: 8px; }
.version-stack.has-versions::before, .version-stack.has-versions::after { content: ''; position: absolute; top: 4px; bottom: 4px; width: 100%; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); background: var(--bg-elevated); }
.version-stack.has-versions::before { left: 8px; }
.version-stack.has-versions::after { left: 4px; }
.version-stack :deep(.lecture-cover) { position: relative; z-index: 1; width: 100%; height: 100%; }
.version-list { position: absolute; z-index: 2; inset: 0; display: flex; flex-direction: column; overflow-y: auto; padding: 13px 10px; box-sizing: border-box; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); background: var(--bg-surface); color: var(--text-primary); overscroll-behavior: contain; }
.version-head { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 8px; padding: 0 2px 10px 6px; color: var(--text-muted); font-size: var(--font-size-smallest); font-weight: var(--font-weight-medium); }
.version-head button { display: inline-flex; align-items: center; justify-content: center; width: 25px; height: 25px; padding: 0; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-muted); cursor: pointer; }
.version-item { display: flex; flex: none; align-items: center; gap: 6px; width: 100%; min-width: 0; padding: 10px 8px; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-primary); font-size: var(--font-size-smaller); font-weight: normal; text-align: left; cursor: pointer; }
.version-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-size-smaller); font-weight: var(--font-weight-medium); line-height: 1.4; }
.version-meta { flex: none; color: var(--text-muted); font-size: var(--font-size-smallest); line-height: 1.4; }
.version-item.is-public .version-meta { color: var(--accent-primary); }
.version-arrow { flex: none; width: 14px; color: var(--text-muted); opacity: 0; transition: opacity 140ms ease; }
.version-item:hover:not(:disabled), .version-head button:hover { background: var(--bg-hover); }
.version-item:hover .version-arrow, .version-item:focus-visible .version-arrow { opacity: 1; }
.version-item:disabled { cursor: not-allowed; }
.version-item:disabled .version-name { color: var(--tag-red); }
.version-message { margin: 8px 6px; color: var(--text-secondary); font-size: var(--font-size-smallest); line-height: 1.5; overflow-wrap: anywhere; }
.version-retry { align-self: flex-start; border: 0; background: transparent; color: var(--accent-primary); cursor: pointer; }
.version-item:focus-visible, .version-head button:focus-visible, .version-retry:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: -2px; }
@media (hover: none) { .version-arrow { opacity: 1; } }

</style>
