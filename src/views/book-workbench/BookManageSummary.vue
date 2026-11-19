<script setup>
import { t } from '../../i18n.js';
import MButton from '../../components/form/MButton.vue';
import WorkbenchPanel from '../../components/workbench/WorkbenchPanel.vue';

defineProps({
  item: Object,
  loading: Boolean,
  error: {
    type: String,
    default: ''
  }
});
defineEmits(['retry', 'open']);

function publicationStatus(value) {
  return t(
    {
      published: '已上架',
      unpublished: '未上架',
      withdrawn: '已下架',
      archived: '已归档'
    }[value] || '状态未知'
  );
}
function revisionStatus(value) {
  return t(
    {
      draft: '草稿',
      pending: '审核中',
      approved: '已通过',
      rejected: '已驳回'
    }[value] || '状态未知'
  );
}
function revisionLabel(revision) {
  if (!revision) {
    return t('暂无版本');
  }
  const kind = t(
    {
      working_draft: '草稿版本',
      snapshot: '快照版本'
    }[revision.kind] || '版本类型未知');
  return revision.revision_no == null
    ? t('{kind} · 版本号未提供', { kind })
    : `${kind} · V${revision.revision_no}`;
}
</script>

<template>
  <WorkbenchPanel
    kind="BOOK"
    :title="item?.latest_revision?.title || t('图书信息')"
    :editable="false"
  >
    <p
      v-if="loading"
      class="summary-note"
    >
      {{ t('正在加载图书信息…') }}
    </p>
    <p
      v-else-if="error"
      class="summary-error"
      role="alert"
    >
      {{ error }}
      <MButton
        size="sm"
        variant="ghost"
        @click="$emit('retry')"
        >重试</MButton
      >
    </p>
    <div
      v-else-if="item"
      class="summary-fields"
    >
      <div>
        <span>{{ t('所有者') }}</span><strong>{{ item.owner_username || t('未提供') }}</strong>
      </div>
      <div>
        <span>{{ t('图书状态') }}</span><strong>{{ publicationStatus(item.publication_status) }}</strong>
      </div>
      <div>
        <span>{{ t('最新版本') }}</span><strong>{{ revisionLabel(item.latest_revision) }}</strong>
      </div>
      <div v-if="item.latest_revision">
        <span>{{ t('版本审核状态') }}</span><strong>{{ revisionStatus(item.latest_revision.status) }}</strong>
      </div>
      <MButton
        v-if="item.latest_revision"
        @click="$emit('open')"
        >{{ t('打开图书') }}</MButton
      >
    </div>
  </WorkbenchPanel>
</template>

<style scoped>
.summary-fields {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
}
.summary-fields > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.summary-fields span,
.summary-note {
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
}
.summary-fields strong {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}
.summary-error {
  color: var(--tag-red);
}
</style>
