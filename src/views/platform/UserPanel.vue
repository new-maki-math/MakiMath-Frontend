<script setup>
// 用户管理面板组件
import { ref, onMounted } from 'vue';
import { Plus, Refresh } from '@iconoir/vue';
import { request } from '../../api/client.js';
import { notify } from '../../components/MNotice.vue';
import { currentUser } from '../../utils/auth.js';
import MButton from '../../components/MButton.vue';
import MInput from '../../components/MInput.vue';
import MTag from '../../components/MTag.vue';
import MModal from '../../components/MModal.vue';
import MTable from '../../components/MTable.vue';
import { formatDate } from './utils.js';

const users = ref([]);
const isLoadingUsers = ref(false);

// 加载系统用户列表
const loadUsers = async () => {
  isLoadingUsers.value = true;
  try {
    const res = await request('/api/users');
    if (Array.isArray(res)) {
      users.value = res;
    }
  } catch (err) {
    notify(err.message || '加载用户列表失败', 'error');
  } finally {
    isLoadingUsers.value = false;
  }
};

// 新建用户弹窗状态
const isCreateUserOpen = ref(false);
const createUserForm = ref({
  username: '',
  displayName: '',
  password: '',
  role: 'editor'
});
const isCreatingUser = ref(false);

// 打开新建用户弹窗
const handleOpenCreateUser = () => {
  createUserForm.value = {
    username: '',
    displayName: '',
    password: '',
    role: 'editor'
  };
  isCreateUserOpen.value = true;
};

// 提交新建用户
const handleCreateUser = async () => {
  if (!createUserForm.value.username.trim() || !createUserForm.value.password) {
    notify('用户名和密码为必填项', 'error');
    return;
  }
  isCreatingUser.value = true;
  try {
    await request('/api/users', {
      method: 'POST',
      body: {
        username: createUserForm.value.username.trim(),
        displayName: createUserForm.value.displayName.trim(),
        password: createUserForm.value.password,
        role: createUserForm.value.role
      }
    });
    notify('用户创建成功', 'success');
    isCreateUserOpen.value = false;
    loadUsers();
  } catch (err) {
    notify(err.message || '创建用户失败', 'error');
  } finally {
    isCreatingUser.value = false;
  }
};

// 切换用户冻结与解封状态
const toggleUserStatus = async (user) => {
  const nextStatus = user.status === 'active' ? 'disabled' : 'active';
  try {
    await request(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: { status: nextStatus }
    });
    user.status = nextStatus;
    notify(`用户已${nextStatus === 'active' ? '启用' : '禁用'}`, 'success');
  } catch (err) {
    notify(err.message || '更新状态失败', 'error');
  }
};

// 重置密码弹窗状态
const isResetPwdOpen = ref(false);
const currentTargetUser = ref(null);
const resetPasswordVal = ref('');
const isResettingPwd = ref(false);

// 打开重置密码弹窗
const handleOpenResetPwd = (user) => {
  currentTargetUser.value = user;
  resetPasswordVal.value = '';
  isResetPwdOpen.value = true;
};

// 确认重置密码
const handleConfirmResetPwd = async () => {
  if (!resetPasswordVal.value || resetPasswordVal.value.length < 6) {
    notify('新密码至少需要六位字符', 'error');
    return;
  }
  isResettingPwd.value = true;
  try {
    await request(`/api/users/${currentTargetUser.value.id}`, {
      method: 'PATCH',
      body: { password: resetPasswordVal.value }
    });
    notify('密码重置成功', 'success');
    isResetPwdOpen.value = false;
  } catch (err) {
    notify(err.message || '重置密码失败', 'error');
  } finally {
    isResettingPwd.value = false;
  }
};

// 删除指定用户
const handleDeleteUser = async (user) => {
  if (user.id === currentUser.value?.id) {
    notify('不能删除当前登录的超管账号', 'error');
    return;
  }
  if (!window.confirm(`确定要彻底删除用户 "${user.username}" 吗？此操作无法撤销。`)) {
    return;
  }
  try {
    await request(`/api/users/${user.id}`, { method: 'DELETE' });
    notify('用户已删除', 'success');
    loadUsers();
  } catch (err) {
    notify(err.message || '删除用户失败', 'error');
  }
};

onMounted(() => {
  loadUsers();
});
</script>

<template>
  <section class="section-pane font-mono">
    <div class="pane-toolbar">
      <div class="toolbar-title-wrap">
        <h1 class="pane-title font-mono">USERS // 用户管理</h1>
        <p class="pane-subtitle">管理全站注册用户账号，执行角色分配、登录凭据重置与账号状态管控。</p>
      </div>
      <div class="toolbar-actions">
        <MButton variant="primary" size="sm" :mono="true" @click="handleOpenCreateUser">
          <template #icon><Plus width="14" height="14" /></template>
          新建用户
        </MButton>
        <button class="icon-action-btn" title="刷新列表" @click="loadUsers">
          <Refresh width="14" height="14" />
        </button>
      </div>
    </div>

    <MTable :data="users" :loading="isLoadingUsers">
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
        <tr v-for="user in data" :key="user.id">
          <td class="col-dim">#{{ user.id }}</td>
          <td class="col-bold">{{ user.username }}</td>
          <td>{{ user.display_name || '-' }}</td>
          <td>
            <MTag :variant="user.role === 'super_admin' ? 'purple' : 'blue'" size="sm">
              {{ user.role === 'super_admin' ? '超级管理员' : '编者' }}
            </MTag>
          </td>
          <td>
            <span
              class="status-pill"
              :class="user.status === 'active' ? 'status-active' : 'status-disabled'"
            >
              {{ user.status === 'active' ? '正常' : '已冻结' }}
            </span>
          </td>
          <td class="col-dim">{{ formatDate(user.created_at) }}</td>
          <td>
            <div class="table-actions">
              <MButton
                variant="secondary"
                size="sm"
                :mono="true"
                :title="user.status === 'active' ? '禁用账号' : '解封账号'"
                @click="toggleUserStatus(user)"
              >
                {{ user.status === 'active' ? '冻结' : '解封' }}
              </MButton>
              <MButton
                variant="secondary"
                size="sm"
                :mono="true"
                title="重置登录密码"
                @click="handleOpenResetPwd(user)"
              >
                改密
              </MButton>
              <MButton
                v-if="user.id !== currentUser?.id"
                variant="danger"
                size="sm"
                :mono="true"
                title="删除用户"
                @click="handleDeleteUser(user)"
              >
                删除
              </MButton>
            </div>
          </td>
        </tr>
      </template>
    </MTable>

    <!-- 新建用户弹窗 -->
    <MModal
      :open="isCreateUserOpen"
      title="新建系统用户"
      confirm-text="确认创建"
      :busy="isCreatingUser"
      @close="isCreateUserOpen = false"
      @confirm="handleCreateUser"
    >
      <div class="form-grid">
        <MInput
          v-model="createUserForm.username"
          label="用户名"
          placeholder="例如 editor_math"
        />
        <MInput
          v-model="createUserForm.displayName"
          label="用户昵称"
          placeholder="例如 高等数学编者"
        />
        <MInput
          v-model="createUserForm.password"
          label="初始密码"
          type="password"
          placeholder="至少六位密码"
        />
        <div class="field-item">
          <span class="field-label">账号角色</span>
          <div class="role-selector">
            <button
              type="button"
              class="role-opt"
              :class="{ active: createUserForm.role === 'editor' }"
              @click="createUserForm.role = 'editor'"
            >
              编者 (editor)
            </button>
            <button
              type="button"
              class="role-opt"
              :class="{ active: createUserForm.role === 'super_admin' }"
              @click="createUserForm.role = 'super_admin'"
            >
              超级管理员 (super_admin)
            </button>
          </div>
        </div>
      </div>
    </MModal>

    <!-- 重置密码弹窗 -->
    <MModal
      :open="isResetPwdOpen"
      :title="`重置用户密码 - ${currentTargetUser?.username}`"
      confirm-text="确认重置"
      confirm-variant="primary"
      :busy="isResettingPwd"
      @close="isResetPwdOpen = false"
      @confirm="handleConfirmResetPwd"
    >
      <form autocomplete="off" @submit.prevent="handleConfirmResetPwd">
        <MInput
          v-model="resetPasswordVal"
          label="设置新密码"
          type="password"
          placeholder="请输入新密码（至少六位）"
        />
      </form>
    </MModal>
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
