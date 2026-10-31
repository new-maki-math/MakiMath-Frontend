<script setup>
import { Refresh } from '@iconoir/vue';
import { onMounted, ref } from 'vue';

import { request } from '../../api/client.js';
import MButton from '../../components/MButton.vue';
import { notify } from '../../components/MNotice.vue';
import MTable from '../../components/MTable.vue';
import MTag from '../../components/MTag.vue';
import { currentUser } from '../../utils/auth.js';
import { formatDate } from './utils.js';

const users = ref([]);
const loading = ref(false);
const changingId = ref(null);

const loadUsers = async () => {
  loading.value = true;
  try {
    users.value = await request('/api/users');
  } catch (err) {
    notify(err.message || '加载用户列表失败', 'error');
  } finally {
    loading.value = false;
  }
};

const toggleUserStatus = async (user) => {
  if (changingId.value !== null || user.id === currentUser.value?.id) {
    return;
  }
  changingId.value = user.id;
  try {
    const updated = await request(`/api/users/${user.id}/status`, {
      method: 'PATCH',
      body: {
        status: user.status === 'active' ? 'disabled' : 'active'
      }
    });
    Object.assign(user, updated);
    notify('账号状态已更新', 'success');
  } catch (err) {
    notify(err.message || '更新账号状态失败', 'error');
  } finally {
    changingId.value = null;
  }
};

onMounted(loadUsers);
</script>

<template>
  <section class="section-pane font-mono">
    <div class="pane-toolbar">
      <div class="toolbar-title-wrap">
        <h1 class="pane-title font-mono">USERS // 用户管理</h1>
        <p class="pane-subtitle">查看用户并管理账号状态</p>
      </div>
      <MButton
        variant="secondary"
        icon-only
        title="刷新列表"
        aria-label="刷新列表"
        @click="loadUsers"
      >
        <Refresh
          width="14"
          height="14"
        />
      </MButton>
    </div>
    <MTable
      :data="users"
      :loading="loading"
    >
      <template #header>
        <th>ID</th>
        <th>用户名</th>
        <th>显示昵称</th>
        <th>系统角色</th>
        <th>账号状态</th>
        <th>注册时间</th>
        <th>操作</th>
      </template>
      <template #rows="{ data }">
        <tr
          v-for="user in data"
          :key="user.id"
        >
          <td class="col-dim">#{{ user.id }}</td>
          <td class="col-bold">{{ user.username }}</td>
          <td>{{ user.display_name || '-' }}</td>
          <td>
            <MTag
              :variant="user.role === 'super_admin' ? 'purple' : 'blue'"
              size="sm"
              >{{ user.role === 'super_admin' ? '超级管理员' : '编者' }}</MTag
            >
          </td>
          <td>
            <span
              class="status-pill"
              :class="user.status === 'active' ? 'status-active' : 'status-disabled'"
              >{{ user.status === 'active' ? '正常' : '已禁用' }}</span
            >
          </td>
          <td class="col-dim">{{ formatDate(user.created_at) }}</td>
          <td>
            <MButton
              size="sm"
              :disabled="changingId !== null || user.id === currentUser?.id"
              @click="toggleUserStatus(user)"
              >{{ user.status === 'active' ? '禁用' : '启用' }}</MButton
            >
          </td>
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

.col-dim {
  color: var(--text-muted);
}

.col-bold {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.status-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: 11px;
}

.status-active {
  background-color: rgba(152, 195, 121, 0.15);
  color: #98c379;
}

.status-disabled {
  background-color: rgba(224, 108, 117, 0.15);
  color: #e06c75;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
}

.role-selector {
  display: flex;
  gap: 8px;
}

.role-opt {
  flex: 1;
  padding: 8px 12px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  cursor: pointer;
  transition: all 120ms ease;
}

.role-opt.active {
  border-color: var(--accent-primary);
  background-color: var(--bg-elevated);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}
</style>
