<script setup>
import { computed, inject, onUnmounted, watch } from 'vue';
import MButton from '../../components/MButton.vue';

const props = defineProps({
  kind: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  meta: {
    type: String,
    default: ''
  },
  dirty: {
    type: Boolean,
    default: false
  },
  saving: {
    type: Boolean,
    default: false
  },
  saveLabel: {
    type: String,
    default: '保存'
  },
  canSave: {
    type: Boolean,
    default: true
  },
  editable: {
    type: Boolean,
    default: true
  },
  readOnlyMessage: {
    type: String,
    default: ''
  },
  submittedAt: {
    type: String,
    default: ''
  },
  reviewStatus: {
    type: String,
    default: ''
  },
  reviewedAt: {
    type: String,
    default: ''
  }
});

defineEmits(['save', 'reset']);

function formatDate(value) {
  if (!value) return '未提供';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未提供';
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}
const submittedDate = computed(() => formatDate(props.submittedAt));
const reviewedDate = computed(() => formatDate(props.reviewedAt));

const reportPanelState = inject('reportWorkbenchPanelState', null);
watch(() => [props.dirty, props.saving], ([dirty, saving]) => {
  reportPanelState?.({ dirty, saving });
}, { immediate: true, flush: 'sync' });
onUnmounted(() => reportPanelState?.({ dirty: false, saving: false }));
</script>

<template>
  <section class="workbench-panel">
    <header class="panel-head">
      <div class="head-main">
        <div class="head-title-row">
          <span class="head-kind font-mono">{{ kind }}</span>
          <h2 class="head-title">{{ title }}</h2>
          <span
            v-if="dirty"
            class="dirty-dot"
            title="有未保存的改动"
          ></span>
        </div>
        <p
          v-if="meta"
          class="head-meta font-mono"
        >
          {{ meta }}
        </p>
      </div>

      <div class="head-actions">
        <slot name="actions" />
        <MButton
          v-if="dirty && editable"
          variant="ghost"
          size="sm"
          :mono="true"
          :disabled="saving"
          @click="$emit('reset')"
        >
          放弃
        </MButton>
        <MButton
          v-if="editable"
          variant="primary"
          size="sm"
          :mono="true"
          :disabled="saving || !canSave"
          @click="$emit('save')"
        >
          {{ saving ? '保存中...' : saveLabel }}
        </MButton>
      </div>
    </header>

    <div class="panel-body" :inert="saving">
      <div v-if="!editable && readOnlyMessage" class="readonly-notice" :class="`status-${reviewStatus}`">
        <template v-if="reviewStatus === 'pending'">
          <strong>课程讲义正在审核中...</strong>
          <p>{{ readOnlyMessage }}</p>
          <div class="notice-details"><span>提交日期：{{ submittedDate }}</span><span>提交用户：未提供</span></div>
        </template>
        <template v-else-if="reviewStatus === 'rejected'">
          <strong>课程讲义被驳回了！</strong>
          <p>驳回原因：未提供；{{ readOnlyMessage }}</p>
          <div class="notice-details"><span>提交日期：{{ submittedDate }}</span><span>提交用户：未提供</span><span>驳回时间：{{ reviewedDate }}</span></div>
        </template>
        <template v-else-if="reviewStatus === 'approved'">
          <strong>课程讲义审核通过！</strong>
          <p>恭喜你🎉讲义审核通过</p>
          <p>{{ readOnlyMessage }}</p>
        </template>
        <template v-else><p>{{ readOnlyMessage }}</p></template>
      </div>
      <slot />
    </div>
  </section>
</template>

<style scoped>
.workbench-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head {
  flex-shrink: 0;
  min-height: 64px;
  padding: 12px 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.head-main {
  min-width: 0;
}

.head-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.head-kind {
  flex-shrink: 0;
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  letter-spacing: 0.6px;
}

.head-title {
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--tag-amber);
}

.head-meta {
  margin-top: 4px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 26px 80px;
}

.readonly-notice {
  margin-bottom: 20px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--tag-blue-bg);
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
}
.readonly-notice.status-rejected { background: var(--tag-red-bg); }
.readonly-notice.status-approved { background: var(--tag-teal-bg); }
.readonly-notice strong { display: block; }
.readonly-notice p { margin: 8px 0 0; }
.readonly-notice p:first-child { margin-top: 0; }
.notice-details { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 12px; color: var(--text-secondary); }
</style>
