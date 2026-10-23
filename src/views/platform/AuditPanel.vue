<script setup>
// 全站审计日志面板组件
import { ref, onMounted } from 'vue';
import { Refresh } from '@iconoir/vue';
import { request } from '../../api/client.js';
import { notify } from '../../components/MNotice.vue';
import MTag from '../../components/MTag.vue';
import MTable from '../../components/MTable.vue';
import { formatDate } from './utils.js';

const auditLogs = ref([]);
const isLoadingAudit = ref(false);
const auditTotal = ref(0);
const auditPage = ref(1);

// 加载审计日志流水
const loadAuditLogs = async (page = 1) => {
  isLoadingAudit.value = true;
  auditPage.value = page;
  try {
    const res = await request(`/api/audit-logs?page=${page}&limit=20`);
    if (res?.items) {
      auditLogs.value = res.items;
      auditTotal.value = res.total || 0;
    }
  } catch (err) {
    notify(err.message || '加载全站日志失败', 'error');
  } finally {
    isLoadingAudit.value = false;
  }
};

onMounted(() => {
  loadAuditLogs(1);
});
</script>

<template>
  <section class="section-pane font-mono">
    <div class="pane-toolbar">
      <div class="toolbar-title-wrap">
        <h1 class="pane-title font-mono">AUDIT // 全站操作审计日志</h1>
        <p class="pane-subtitle">实时留痕全站所有需鉴权管理与讲义编撰接口的调用流水，保障系统运维安全。</p>
      </div>
      <div class="toolbar-actions">
        <button class="icon-action-btn" title="刷新日志" @click="loadAuditLogs(auditPage)">
          <Refresh width="14" height="14" />
        </button>
      </div>
    </div>

    <MTable :data="auditLogs" :loading="isLoadingAudit">
      <template #header>
        <th>时间</th>
        <th>操作者</th>
        <th>角色</th>
        <th>方法</th>
        <th>API 路由</th>
        <th>状态</th>
        <th>耗时</th>
        <th>IP 地址</th>
      </template>
      <template #rows="{ data }">
        <tr v-for="log in data" :key="log.id">
          <td class="col-dim">{{ formatDate(log.created_at) }}</td>
          <td class="col-bold">{{ log.username || '匿名/系统' }}</td>
          <td>
            <MTag :variant="log.user_role === 'super_admin' ? 'purple' : 'gray'" size="sm">
              {{ log.user_role || '-' }}
            </MTag>
          </td>
          <td>
            <span class="method-tag" :class="`is-${log.method.toLowerCase()}`">
              {{ log.method }}
            </span>
          </td>
          <td class="col-path" :title="log.path">{{ log.path }}</td>
          <td>
            <span
              class="status-dot"
              :class="log.status_code < 400 ? 'status-ok' : 'status-err'"
            >
              {{ log.status_code }}
            </span>
          </td>
          <td class="col-dim">{{ log.duration_ms }}ms</td>
          <td class="col-dim">{{ log.ip_address || '-' }}</td>
        </tr>
      </template>
    </MTable>
  </section>
</template>

<style scoped>
.section-pane {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1200px;
}

.pane-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pane-title {
  font-size: var(--font-size-largest);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  letter-spacing: 0.5px;
  margin: 0;
}

.pane-subtitle {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 120ms ease;
}

.icon-action-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.col-dim {
  color: var(--text-muted);
}

.col-bold {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.method-tag {
  display: inline-block;
  padding: 2px 5px;
  border-radius: var(--radius-xs);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  background-color: var(--bg-hover);
}

.method-tag.is-post {
  color: #98c379;
}

.method-tag.is-patch,
.method-tag.is-put {
  color: #e5c07b;
}

.method-tag.is-delete {
  color: #e06c75;
}

.method-tag.is-get {
  color: #61afef;
}

.col-path {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot.status-ok {
  color: #98c379;
}

.status-dot.status-err {
  color: #e06c75;
}
</style>
