<script setup>
// 邀请码管理面板组件
import { ref, onMounted } from 'vue';
import { Plus, Refresh, Copy } from '@iconoir/vue';
import { request } from '../../api/client.js';
import { notify } from '../../components/MNotice.vue';
import MButton from '../../components/MButton.vue';
import MInput from '../../components/MInput.vue';
import MTag from '../../components/MTag.vue';
import MModal from '../../components/MModal.vue';
import MTable from '../../components/MTable.vue';
import { formatDate } from './utils.js';

const invitations = ref([]);
const isLoadingInvitations = ref(false);
const invitePage = ref(1);
const inviteTotal = ref(0);

// 加载注册邀请码列表
const loadInvitations = async (page = 1) => {
  isLoadingInvitations.value = true;
  invitePage.value = page;
  try {
    const res = await request('/api/invitations');
    invitations.value = Array.isArray(res) ? res : [];
    inviteTotal.value = invitations.value.length;
  } catch (err) {
    notify(err.message || '加载邀请码失败', 'error');
  } finally {
    isLoadingInvitations.value = false;
  }
};

// 生成邀请码弹窗状态
const isCreateInviteOpen = ref(false);
const createInviteForm = ref({
  role: 'editor',
  maxUses: 1,
  expiresInDays: 7,
  note: ''
});
const isCreatingInvite = ref(false);

// 打开生成邀请码弹窗
const handleOpenCreateInvite = () => {
  createInviteForm.value = {
    role: 'editor',
    maxUses: 1,
    expiresInDays: 7,
    note: ''
  };
  isCreateInviteOpen.value = true;
};

// 提交生成邀请码
const handleCreateInvite = async () => {
  isCreatingInvite.value = true;
  try {
    const days = Number(createInviteForm.value.expiresInDays);
    if (!Number.isFinite(days) || days < 0) throw new Error('有效期天数不正确');
    await request('/api/invitations', {
      method: 'POST',
      body: {
        role: createInviteForm.value.role,
        max_uses: Number(createInviteForm.value.maxUses) || 1,
        expires_at: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
        note: createInviteForm.value.note.trim()
      }
    });
    notify('邀请码生成成功', 'success');
    isCreateInviteOpen.value = false;
    loadInvitations(1);
  } catch (err) {
    notify(err.message || '生成邀请码失败', 'error');
  } finally {
    isCreatingInvite.value = false;
  }
};

// 作废指定邀请码
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

// 复制文本到剪贴板
const handleCopy = (text) => {
  navigator.clipboard.writeText(text);
  notify('已复制到剪贴板', 'success');
};

onMounted(() => {
  loadInvitations(1);
});
</script>

<template>
  <section class="section-pane font-mono">
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
        <MButton variant="secondary" icon-only title="刷新列表" aria-label="刷新列表" @click="loadInvitations(invitePage)">
          <Refresh width="14" height="14" />
        </MButton>
      </div>
    </div>

    <MTable :data="invitations" :loading="isLoadingInvitations">
      <template #header>
        <th>邀请码</th>
        <th>角色</th>
        <th>使用次数</th>
        <th>状态</th>
        <th>备注</th>
        <th>有效期至</th>
        <th>生成时间</th>
        <th>操作</th>
      </template>
      <template #rows="{ data }">
        <tr v-for="inv in data" :key="inv.id">
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
            <MButton
              v-if="inv.status === 'active'"
              variant="danger"
              size="sm"
              :mono="true"
              title="废弃此邀请码"
              @click="handleRevokeInvite(inv)"
            >
              作废
            </MButton>
            <span v-else class="col-dim">-</span>
          </td>
        </tr>
      </template>
    </MTable>

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
