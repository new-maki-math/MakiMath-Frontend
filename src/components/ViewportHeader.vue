<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { Refresh } from '@iconoir/vue';

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  path: {
    type: String,
    default: ''
  },
  breadcrumbs: {
    type: Array,
    default: null
  },
  showActions: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['refresh']);

const route = useRoute();
const isRefreshing = ref(false);

const displayTitle = computed(() => {
  return props.title || route.meta?.title || '页面';
});

const resolvedBreadcrumbs = computed(() => {
  if (props.breadcrumbs && Array.isArray(props.breadcrumbs) && props.breadcrumbs.length > 0) {
    return props.breadcrumbs;
  }
  return ['APP', displayTitle.value];
});

const handleRefresh = () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  emit('refresh');
  setTimeout(() => {
    isRefreshing.value = false;
  }, 600);
};
</script>

<template>
  <div class="viewport-header">
    <div class="breadcrumb font-mono">
      <template v-for="(seg, idx) in resolvedBreadcrumbs" :key="idx">
        <span v-if="idx > 0" class="crumb-sep">/</span>
        <span :class="{ 'crumb-active': idx === resolvedBreadcrumbs.length - 1 }">{{ seg }}</span>
      </template>
    </div>

    <div v-if="showActions" class="viewport-actions">
      <slot name="actions">
        <MButton
          variant="secondary"
          size="sm"
          class="header-refresh-btn"
          title="刷新内容区域"
          @click="handleRefresh"
        >
          <template #icon>
            <Refresh
              width="13"
              height="13"
              :class="{ 'spin-icon': isRefreshing }"
            />
          </template>
          <span>刷新</span>
        </MButton>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.viewport-header {
  height: 46px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-app);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 30;
  flex-shrink: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
}

.crumb-sep {
  color: var(--text-muted);
}

.crumb-active {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.viewport-actions {
  display: flex;
  align-items: center;
}

.header-refresh-btn {
  gap: 6px;
  font-size: var(--font-size-smallest);
  color: var(--text-secondary);
}

.header-refresh-btn:hover {
  color: var(--text-primary);
}

.spin-icon {
  animation: spin 600ms linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
