<script setup>
import { inject, onUnmounted, watch } from 'vue';
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
  }
});

defineEmits(['save', 'reset']);

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
          v-if="dirty"
          variant="ghost"
          size="sm"
          :mono="true"
          :disabled="saving"
          @click="$emit('reset')"
        >
          放弃
        </MButton>
        <MButton
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
</style>
