<script setup>
// 用户中心模态窗口组件
import { ref, computed, watch } from 'vue';
import { UserCircle, User, Lock, Xmark } from '@iconoir/vue';
import { request } from '../api/client.js';
import { notify } from './MNotice.vue';
import { setAuth, getAuthToken, invalidateSession } from '../utils/auth.js';
import MBackdrop from './MBackdrop.vue';
import MInput from './MInput.vue';
import MButton from './MButton.vue';
import MTag from './MTag.vue';

// 声明组件属性与事件
const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close', 'updated']);

// 侧边标签栏列表
const tabs = [
  { id: 'info', label: '基本信息', icon: User },
  { id: 'security', label: '账号安全', icon: Lock }
];

// 当前选中的 Tab 项
const currentTab = ref('info');

// 基本信息表单状态
const profileForm = ref({
  username: '',
  displayName: ''
});
const isSavingProfile = ref(false);

// 账号安全密码表单状态
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});
const isSavingPassword = ref(false);

// 同步初始化表单数据
watch(
  () => props.open,
  (val) => {
    if (val) {
      currentTab.value = 'info';
      profileForm.value = {
        username: props.user?.username || '',
        displayName: props.user?.displayName || props.user?.display_name || ''
      };
      passwordForm.value = {
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
    }
  },
  { immediate: true }
);

// 用户角色标签配置
const roleMeta = computed(() => {
  if (props.user?.role === 'super_admin') {
    return { label: '超级管理员', variant: 'purple' };
  }
  if (props.user?.role === 'admin') {
    return { label: '管理员', variant: 'blue' };
  }
  return { label: '普通用户', variant: 'gray' };
});

// 保存基本信息修改
const handleSaveProfile = async () => {
  if (!profileForm.value.displayName.trim()) {
    notify('昵称不能为空', 'error');
    return;
  }
  isSavingProfile.value = true;
  try {
    const res = await request('/api/auth/profile', {
      method: 'PATCH',
      body: { display_name: profileForm.value.displayName.trim() }
    });
    if (res?.user) {
      const token = getAuthToken();
      setAuth(token, res.user);
      notify('基本信息已更新', 'success');
      emit('updated', res.user);
    }
  } catch (err) {
    notify(err.message || '更新基本信息失败', 'error');
  } finally {
    isSavingProfile.value = false;
  }
};

// 修改密码
const handleSavePassword = async () => {
  if (!passwordForm.value.oldPassword) {
    notify('请输入原密码', 'error');
    return;
  }
  if (passwordForm.value.newPassword.length < 8 || new TextEncoder().encode(passwordForm.value.newPassword).length > 72) {
    notify('新密码至少需要八位字符且不能超过七十二字节', 'error');
    return;
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    notify('两次输入的新密码不一致', 'error');
    return;
  }
  isSavingPassword.value = true;
  try {
    await request('/api/auth/password', {
      method: 'PATCH',
      body: {
        old_password: passwordForm.value.oldPassword,
        new_password: passwordForm.value.newPassword
      }
    });
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
    emit('close');
    invalidateSession();
    notify('密码修改成功，请重新登录', 'success');
  } catch (err) {
    notify(err.message || '修改密码失败', 'error');
  } finally {
    isSavingPassword.value = false;
  }
};

</script>

<template>
  <MBackdrop :open="open" teleport fixed :z-index="120" @close="emit('close')">
    <transition name="modal-pop" appear>
      <div v-if="open" class="user-modal-panel font-mono" @click.stop>
        <div class="user-modal-sidebar">
          <div class="sidebar-brand">
            <UserCircle width="18" height="18" class="brand-icon" />
            <span class="brand-title">ACCOUNT</span>
          </div>
          <nav class="sidebar-tab-list">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="sidebar-tab-btn"
              :class="{ active: currentTab === tab.id }"
              @click="currentTab = tab.id"
            >
              <component :is="tab.icon" width="16" height="16" class="tab-icon" />
              <span class="tab-text">{{ tab.label }}</span>
            </button>
          </nav>
        </div>

        <div class="user-modal-content">
          <div class="content-header">
            <div class="header-left">
              <span class="header-section-name">
                {{ tabs.find((t) => t.id === currentTab)?.label }}
              </span>
            </div>
            <button class="header-close-btn" title="关闭窗口" @click="emit('close')">
              <Xmark width="16" height="16" />
            </button>
          </div>

          <div class="content-body">
            <section v-if="currentTab === 'info'" class="tab-pane">
              <form class="pane-form" @submit.prevent="handleSaveProfile">
                <div class="field-item">
                  <span class="field-label">账号角色</span>
                  <div class="field-static-row">
                    <MTag :variant="roleMeta.variant" size="md">{{ roleMeta.label }}</MTag>
                    <span class="role-desc">Role: {{ user?.role || 'user' }}</span>
                  </div>
                </div>

                <MInput
                  v-model="profileForm.username"
                  label="登录账号"
                  placeholder="用户名不可修改"
                  :disabled="true"
                />

                <MInput
                  v-model="profileForm.displayName"
                  label="用户昵称"
                  placeholder="请输入您的昵称"
                  :disabled="isSavingProfile"
                />

                <div class="pane-action">
                  <MButton
                    variant="primary"
                    type="submit"
                    size="sm"
                    :mono="true"
                    :disabled="isSavingProfile"
                  >
                    {{ isSavingProfile ? '保存中...' : '保存修改' }}
                  </MButton>
                </div>
              </form>
            </section>

            <section v-else-if="currentTab === 'security'" class="tab-pane">
              <form class="pane-form" @submit.prevent="handleSavePassword">
                <MInput
                  v-model="passwordForm.oldPassword"
                  label="当前密码"
                  type="password"
                  placeholder="请输入原登录密码"
                  :disabled="isSavingPassword"
                />

                <MInput
                  v-model="passwordForm.newPassword"
                  label="新密码"
                  type="password"
                  placeholder="至少六位新密码"
                  :disabled="isSavingPassword"
                />

                <MInput
                  v-model="passwordForm.confirmPassword"
                  label="确认新密码"
                  type="password"
                  placeholder="请再次输入新密码"
                  :disabled="isSavingPassword"
                />

                <div class="pane-action">
                  <MButton
                    variant="primary"
                    type="submit"
                    size="sm"
                    :mono="true"
                    :disabled="isSavingPassword"
                  >
                    {{ isSavingPassword ? '提交中...' : '确认修改密码' }}
                  </MButton>
                </div>
              </form>
            </section>


          </div>
        </div>
      </div>
    </transition>
  </MBackdrop>
</template>

<style scoped>
.user-modal-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 680px;
  max-width: calc(100vw - 32px);
  height: 440px;
  max-height: calc(100vh - 48px);
  display: flex;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.user-modal-sidebar {
  width: 170px;
  flex-shrink: 0;
  background-color: var(--bg-app);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.brand-icon {
  color: var(--accent-primary);
}

.brand-title {
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 1px;
}

.sidebar-tab-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
}

.sidebar-tab-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-xs);
  background-color: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  cursor: pointer;
  transition: all 140ms ease;
}

.sidebar-tab-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-tab-btn.active {
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.tab-icon {
  flex-shrink: 0;
}

.user-modal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: var(--bg-surface);
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.header-section-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.header-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-xs);
  background-color: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 120ms ease;
}

.header-close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.content-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.pane-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 400px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  display: block;
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.field-static-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.role-desc {
  font-size: var(--font-size-smallest);
  color: var(--text-secondary);
}

.pane-action {
  padding-top: 6px;
}

.logs-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}

.logs-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-smallest);
}

.logs-table th {
  text-align: left;
  padding: 8px 10px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
  font-weight: var(--font-weight-medium);
}

.logs-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  white-space: nowrap;
}

.log-time {
  color: var(--text-muted);
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

.log-path {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot.status-ok {
  color: #98c379;
}

.status-dot.status-err {
  color: #e06c75;
}

.log-duration {
  color: var(--text-muted);
}

.modal-pop-enter-active,
.modal-pop-leave-active {
  transition: opacity 160ms cubic-bezier(0.16, 1, 0.3, 1), transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-pop-enter-from,
.modal-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% - 8px)) scale(0.98);
}
</style>
