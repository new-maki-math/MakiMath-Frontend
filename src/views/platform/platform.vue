<script setup>
// 超级管理员平台运维与权限管理视图
import { ref, watch, onMounted } from 'vue';
import {
  Group,
  Key,
  BookmarkSolid,
  Page,
  Plus,
  Refresh,
  Lock,
  Trash,
  Check,
  Xmark,
  User,
  Copy
} from '@iconoir/vue';
import { request } from '../../api/client.js';
import { notify } from '../../components/MNotice.vue';
import { currentUser } from '../../utils/auth.js';
import MButton from '../../components/MButton.vue';
import MInput from '../../components/MInput.vue';
import MTag from '../../components/MTag.vue';
import MModal from '../../components/MModal.vue';

// 当前激活的管理选项卡
const activeTab = ref('users');
const tabs = [
  { id: 'users', label: '用户管理', icon: Group },
  { id: 'invitations', label: '邀请码管理', icon: Key },
  { id: 'editors', label: '课程授权', icon: BookmarkSolid },
  { id: 'audit', label: '全站审计日志', icon: Page }
];

// 选项卡切换联动
watch(activeTab, (tab) => {
  if (tab === 'users') loadUsers();
  else if (tab === 'invitations') loadInvitations();
  else if (tab === 'editors') loadEditorMatrix();
  else if (tab === 'audit') loadAuditLogs();
});

// ==========================================
// 1. 用户管理模块
// ==========================================
const users = ref([]);
const isLoadingUsers = ref(false);
const userSearchKeyword = ref('');

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

// 新建用户弹窗
const isCreateUserOpen = ref(false);
const createUserForm = ref({
  username: '',
  displayName: '',
  password: '',
  role: 'editor'
});
const isCreatingUser = ref(false);

const handleOpenCreateUser = () => {
  createUserForm.value = {
    username: '',
    displayName: '',
    password: '',
    role: 'editor'
  };
  isCreateUserOpen.value = true;
};

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

// 切换用户启用与禁用状态
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

// 重置用户密码弹窗
const isResetPwdOpen = ref(false);
const currentTargetUser = ref(null);
const resetPasswordVal = ref('');
const isResettingPwd = ref(false);

const handleOpenResetPwd = (user) => {
  currentTargetUser.value = user;
  resetPasswordVal.value = '';
  isResetPwdOpen.value = true;
};

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

// 删除用户
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

// ==========================================
// 2. 邀请码管理模块
// ==========================================
const invitations = ref([]);
const isLoadingInvitations = ref(false);
const invitePage = ref(1);
const inviteTotal = ref(0);

const loadInvitations = async (page = 1) => {
  isLoadingInvitations.value = true;
  invitePage.value = page;
  try {
    const res = await request(`/api/invitations?page=${page}&limit=15`);
    if (res?.items) {
      invitations.value = res.items;
      inviteTotal.value = res.total || 0;
    }
  } catch (err) {
    notify(err.message || '加载邀请码失败', 'error');
  } finally {
    isLoadingInvitations.value = false;
  }
};

// 生成邀请码弹窗
const isCreateInviteOpen = ref(false);
const createInviteForm = ref({
  role: 'editor',
  maxUses: 1,
  expiresInDays: 7,
  note: ''
});
const isCreatingInvite = ref(false);

const handleOpenCreateInvite = () => {
  createInviteForm.value = {
    role: 'editor',
    maxUses: 1,
    expiresInDays: 7,
    note: ''
  };
  isCreateInviteOpen.value = true;
};

const handleCreateInvite = async () => {
  isCreatingInvite.value = true;
  try {
    await request('/api/invitations', {
      method: 'POST',
      body: {
        role: createInviteForm.value.role,
        maxUses: Number(createInviteForm.value.maxUses) || 1,
        expiresInDays: Number(createInviteForm.value.expiresInDays) || 0,
        note: createInviteForm.value.note.trim()
      }
    });
    notify('邀请码生成成功', 'success');
    isCreateInviteOpen.value = false;
    loadInvitations();
  } catch (err) {
    notify(err.message || '生成邀请码失败', 'error');
  } finally {
    isCreatingInvite.value = false;
  }
};

// 作废邀请码
const handleRevokeInvite = async (inv) => {
  if (!window.confirm(`确定要作废邀请码 ${inv.code} 吗？`)) return;
  try {
    await request(`/api/invitations/${inv.id}`, { method: 'DELETE' });
    notify('邀请码已作废', 'success');
    loadInvitations(invitePage.value);
  } catch (err) {
    notify(err.message || '作废邀请码失败', 'error');
  }
};

// 快捷复制文本
const handleCopy = (text) => {
  navigator.clipboard.writeText(text);
  notify('已复制到剪贴板', 'success');
};

// ==========================================
// 3. 课程协作者模块
// ==========================================
const courses = ref([]);
const selectedCourseId = ref(null);
const courseEditors = ref([]);
const isLoadingEditors = ref(false);
const isAssignEditorOpen = ref(false);
const assignUserId = ref('');
const isAssigning = ref(false);

const loadEditorMatrix = async () => {
  try {
    const res = await request('/api/courses');
    if (Array.isArray(res)) {
      courses.value = res;
      if (res.length > 0 && !selectedCourseId.value) {
        selectedCourseId.value = res[0].id;
        loadCourseEditors(res[0].id);
      }
    }
  } catch (err) {
    notify(err.message || '加载课程失败', 'error');
  }
};

const handleSelectCourse = (course) => {
  selectedCourseId.value = course.id;
  loadCourseEditors(course.id);
};

const loadCourseEditors = async (courseId) => {
  isLoadingEditors.value = true;
  try {
    const res = await request(`/api/courses/${courseId}/editors`);
    courseEditors.value = Array.isArray(res) ? res : [];
  } catch (err) {
    notify(err.message || '加载协作者列表失败', 'error');
  } finally {
    isLoadingEditors.value = false;
  }
};

const handleAssignEditor = async () => {
  if (!assignUserId.value) {
    notify('请选择要指派的编者用户', 'error');
    return;
  }
  isAssigning.value = true;
  try {
    await request(`/api/courses/${selectedCourseId.value}/editors`, {
      method: 'POST',
      body: { userId: Number(assignUserId.value) }
    });
    notify('协作者指派成功', 'success');
    isAssignEditorOpen.value = false;
    assignUserId.value = '';
    loadCourseEditors(selectedCourseId.value);
  } catch (err) {
    notify(err.message || '指派协作者失败', 'error');
  } finally {
    isAssigning.value = false;
  }
};

const handleRemoveEditor = async (editor) => {
  if (!window.confirm(`确定要移除 ${editor.username} 对此课程的编辑权限吗？`)) return;
  try {
    await request(`/api/courses/${selectedCourseId.value}/editors/${editor.id}`, {
      method: 'DELETE'
    });
    notify('已收回协作者权限', 'success');
    loadCourseEditors(selectedCourseId.value);
  } catch (err) {
    notify(err.message || '移除协作者失败', 'error');
  }
};

// ==========================================
// 4. 全站审计日志模块
// ==========================================
const auditLogs = ref([]);
const isLoadingAudit = ref(false);
const auditTotal = ref(0);
const auditPage = ref(1);

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

// 格式化时间
const formatDate = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  const pad = (n) => String(n).padStart(2, '0');
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${month}-${day} ${hours}:${minutes}:${seconds}`;
};

onMounted(() => {
  loadUsers();
});
</script>

<template>
  <div class="platform-layout font-mono">
    <aside class="platform-sidebar">
      <div class="sidebar-head">
        <span class="head-title">PLATFORM ADMIN</span>
      </div>
      <nav class="sidebar-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="nav-tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" width="16" height="16" class="tab-icon" />
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </nav>
    </aside>

    <main class="platform-content">
      <!-- 用户管理面板 -->
      <section v-if="activeTab === 'users'" class="section-pane">
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

        <div class="data-table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>显示昵称</th>
                <th>系统角色</th>
                <th>账号状态</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
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
                    <button
                      class="row-action-btn"
                      :title="user.status === 'active' ? '禁用账号' : '解封账号'"
                      @click="toggleUserStatus(user)"
                    >
                      {{ user.status === 'active' ? '冻结' : '解封' }}
                    </button>
                    <button
                      class="row-action-btn"
                      title="重置登录密码"
                      @click="handleOpenResetPwd(user)"
                    >
                      改密
                    </button>
                    <button
                      v-if="user.id !== currentUser?.id"
                      class="row-action-btn is-danger"
                      title="删除用户"
                      @click="handleDeleteUser(user)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 邀请码管理面板 -->
      <section v-else-if="activeTab === 'invitations'" class="section-pane">
        <div class="pane-toolbar">
          <div class="toolbar-title-wrap">
            <h1 class="pane-title font-mono">INVITATIONS // 邀请码管理</h1>
            <p class="pane-subtitle">生成系统准入注册邀请码，设定授权角色、限制使用频次与监控使用进度。</p>
          </div>
          <div class="toolbar-actions">
            <MButton variant="primary" size="sm" :mono="true" @click="handleOpenCreateInvite">
              <template #icon><Plus width="14" height="14" /></template>
              生成邀请码
            </MButton>
            <button class="icon-action-btn" title="刷新列表" @click="loadInvitations(invitePage)">
              <Refresh width="14" height="14" />
            </button>
          </div>
        </div>

        <div class="data-table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>邀请码</th>
                <th>角色</th>
                <th>使用次数</th>
                <th>状态</th>
                <th>备注</th>
                <th>有效期至</th>
                <th>生成时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in invitations" :key="inv.id">
                <td class="col-code">
                  <span>{{ inv.code }}</span>
                  <button class="copy-inline-btn" title="复制邀请码" @click="handleCopy(inv.code)">
                    <Copy width="12" height="12" />
                  </button>
                </td>
                <td>
                  <MTag :variant="inv.role === 'super_admin' ? 'purple' : 'gray'" size="sm">
                    {{ inv.role }}
                  </MTag>
                </td>
                <td class="col-dim">{{ inv.used_count }} / {{ inv.max_uses }}</td>
                <td>
                  <span
                    class="status-pill"
                    :class="{
                      'status-active': inv.status === 'active',
                      'status-exhausted': inv.status === 'exhausted',
                      'status-disabled': inv.status === 'revoked'
                    }"
                  >
                    {{ inv.status === 'active' ? '有效' : inv.status === 'exhausted' ? '已耗尽' : '已作废' }}
                  </span>
                </td>
                <td class="col-dim">{{ inv.note || '-' }}</td>
                <td class="col-dim">{{ inv.expires_at ? formatDate(inv.expires_at) : '永久有效' }}</td>
                <td class="col-dim">{{ formatDate(inv.created_at) }}</td>
                <td>
                  <button
                    v-if="inv.status === 'active'"
                    class="row-action-btn is-danger"
                    title="废弃此邀请码"
                    @click="handleRevokeInvite(inv)"
                  >
                    作废
                  </button>
                  <span v-else class="col-dim">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 课程协作者授权面板 -->
      <section v-else-if="activeTab === 'editors'" class="section-pane">
        <div class="pane-toolbar">
          <div class="toolbar-title-wrap">
            <h1 class="pane-title font-mono">EDITORS // 课程协作者授权</h1>
            <p class="pane-subtitle">将特定课程的讲义编撰与排版发布权指派给指定编者，精细化管理创作团队。</p>
          </div>
          <div class="toolbar-actions">
            <MButton
              v-if="selectedCourseId"
              variant="primary"
              size="sm"
              :mono="true"
              @click="isAssignEditorOpen = true"
            >
              <template #icon><Plus width="14" height="14" /></template>
              指派新编者
            </MButton>
          </div>
        </div>

        <div class="split-editor-box">
          <div class="course-picker-list">
            <div class="list-head">课程目录</div>
            <div
              v-for="c in courses"
              :key="c.id"
              class="course-picker-item"
              :class="{ active: selectedCourseId === c.id }"
              @click="handleSelectCourse(c)"
            >
              <span class="c-title">{{ c.title }}</span>
              <span class="c-slug">{{ c.slug }}</span>
            </div>
          </div>

          <div class="editors-display-pane">
            <div class="pane-inner-head">
              <span>已授权编者列表</span>
              <button
                class="icon-action-btn"
                title="刷新"
                @click="loadCourseEditors(selectedCourseId)"
              >
                <Refresh width="14" height="14" />
              </button>
            </div>

            <div v-if="isLoadingEditors" class="empty-holder">正在拉取协作者...</div>
            <div v-else-if="courseEditors.length === 0" class="empty-holder">
              当前课程尚未指派协作者，所有超级管理员均具备完全编辑权。
            </div>
            <div v-else class="data-table-card">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>昵称</th>
                    <th>角色</th>
                    <th>授权时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ed in courseEditors" :key="ed.id">
                    <td class="col-bold">{{ ed.username }}</td>
                    <td>{{ ed.display_name || '-' }}</td>
                    <td>
                      <MTag variant="gray" size="sm">{{ ed.role }}</MTag>
                    </td>
                    <td class="col-dim">{{ formatDate(ed.assigned_at) }}</td>
                    <td>
                      <button
                        class="row-action-btn is-danger"
                        title="收回编辑权"
                        @click="handleRemoveEditor(ed)"
                      >
                        移除
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- 全站审计日志面板 -->
      <section v-else-if="activeTab === 'audit'" class="section-pane">
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

        <div class="data-table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作者</th>
                <th>角色</th>
                <th>方法</th>
                <th>API 路由</th>
                <th>状态</th>
                <th>耗时</th>
                <th>IP 地址</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in auditLogs" :key="log.id">
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
            </tbody>
          </table>
        </div>
      </section>
    </main>

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
      <MInput
        v-model="resetPasswordVal"
        label="设置新密码"
        type="password"
        placeholder="请输入新密码（至少六位）"
      />
    </MModal>

    <!-- 生成邀请码弹窗 -->
    <MModal
      :open="isCreateInviteOpen"
      title="生成注册邀请码"
      confirm-text="生成"
      :busy="isCreatingInvite"
      @close="isCreateInviteOpen = false"
      @confirm="handleCreateInvite"
    >
      <div class="form-grid">
        <MInput
          v-model="createInviteForm.maxUses"
          label="允许使用次数"
          type="number"
          placeholder="默认为 1 次"
        />
        <MInput
          v-model="createInviteForm.expiresInDays"
          label="有效期天数"
          type="number"
          placeholder="填 0 为永久有效，默认 7 天"
        />
        <MInput
          v-model="createInviteForm.note"
          label="用途备注"
          placeholder="例如：指派给微积分课程团队"
        />
        <div class="field-item">
          <span class="field-label">注册绑定角色</span>
          <div class="role-selector">
            <button
              type="button"
              class="role-opt"
              :class="{ active: createInviteForm.role === 'editor' }"
              @click="createInviteForm.role = 'editor'"
            >
              编者
            </button>
            <button
              type="button"
              class="role-opt"
              :class="{ active: createInviteForm.role === 'super_admin' }"
              @click="createInviteForm.role = 'super_admin'"
            >
              超级管理员
            </button>
          </div>
        </div>
      </div>
    </MModal>

    <!-- 指派编者弹窗 -->
    <MModal
      :open="isAssignEditorOpen"
      title="指派课程协作者"
      confirm-text="确认指派"
      :busy="isAssigning"
      @close="isAssignEditorOpen = false"
      @confirm="handleAssignEditor"
    >
      <div class="form-grid">
        <div class="field-item">
          <span class="field-label">选择编者用户</span>
          <select v-model="assignUserId" class="native-select">
            <option value="" disabled>-- 请选择编者 --</option>
            <option
              v-for="u in users.filter((u) => u.status === 'active')"
              :key="u.id"
              :value="u.id"
            >
              {{ u.username }} ({{ u.display_name || '无昵称' }}) - {{ u.role }}
            </option>
          </select>
        </div>
      </div>
    </MModal>
  </div>
</template>

<style scoped>
.platform-layout {
  display: flex;
  width: 100%;
  height: calc(100vh - var(--topbar-height, 54px));
  background-color: var(--bg-app);
  overflow: hidden;
}

.platform-sidebar {
  width: 200px;
  flex-shrink: 0;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
}

.sidebar-head {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.head-title {
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 1px;
  color: var(--text-muted);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
}

.nav-tab-btn {
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

.nav-tab-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.nav-tab-btn.active {
  background-color: var(--bg-elevated);
  color: var(--text-primary);
}

.tab-icon {
  flex-shrink: 0;
}

.platform-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-y: auto;
  padding: 24px 32px;
}

.section-pane {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.pane-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pane-title {
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  letter-spacing: 0.5px;
  margin: 0;
}

.pane-subtitle {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  margin: 4px 0 0 0;
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

.data-table-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-smaller);
}

.data-table th {
  text-align: left;
  padding: 10px 14px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
  font-weight: var(--font-weight-medium);
  background-color: var(--bg-surface-elevated, var(--bg-surface));
}

.data-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  white-space: nowrap;
}

.data-table tbody tr:hover {
  background-color: var(--bg-hover);
}

.col-dim {
  color: var(--text-muted);
}

.col-bold {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.col-code {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent-primary);
  font-weight: var(--font-weight-semibold);
}

.copy-inline-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-xs);
}

.copy-inline-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
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

.status-exhausted {
  background-color: rgba(171, 178, 191, 0.15);
  color: var(--text-muted);
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.row-action-btn {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: transparent;
  border: 1px solid var(--border-subtle);
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 120ms ease;
}

.row-action-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.row-action-btn.is-danger:hover {
  color: #e06c75;
  border-color: rgba(224, 108, 117, 0.35);
}

.split-editor-box {
  display: flex;
  gap: 16px;
  height: 520px;
}

.course-picker-list {
  width: 240px;
  flex-shrink: 0;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.list-head {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  font-weight: var(--font-weight-semibold);
}

.course-picker-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background-color 120ms ease;
}

.course-picker-item:hover {
  background-color: var(--bg-hover);
}

.course-picker-item.active {
  background-color: var(--bg-elevated);
  border-left: 2px solid var(--accent-primary);
}

.c-title {
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-medium);
}

.c-slug {
  color: var(--text-muted);
  font-size: 11px;
}

.editors-display-pane {
  flex: 1;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  padding: 14px;
}

.pane-inner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.empty-holder {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
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

.native-select {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
  outline: none;
}
</style>
