<script setup>
// 平台运维与管理控制台总视图
import { ref, onMounted } from 'vue';
import {
  Group,
  Key,
  BookmarkSolid,
  Page
} from '@iconoir/vue';
import { isSuperAdmin, initAuth } from '../../utils/auth.js';
import PlatformAuth from './PlatformAuth.vue';
import UserPanel from './UserPanel.vue';
import InvitationPanel from './InvitationPanel.vue';
import EditorPanel from './EditorPanel.vue';
import AuditPanel from './AuditPanel.vue';

// 当前激活的选项卡
const activeTab = ref('users');
const tabs = [
  { id: 'users', label: '用户管理', icon: Group },
  { id: 'invitations', label: '邀请码管理', icon: Key },
  { id: 'editors', label: '课程授权', icon: BookmarkSolid },
  { id: 'audit', label: '全站审计日志', icon: Page }
];

// 认证成功回调处理
const handleAuthSuccess = () => {
  activeTab.value = 'users';
};

onMounted(() => {
  initAuth();
});
</script>

<template>
  <PlatformAuth v-if="!isSuperAdmin" @success="handleAuthSuccess" />

  <div v-else class="platform-layout font-mono">
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
      <UserPanel v-if="activeTab === 'users'" />
      <InvitationPanel v-else-if="activeTab === 'invitations'" />
      <EditorPanel v-else-if="activeTab === 'editors'" />
      <AuditPanel v-else-if="activeTab === 'audit'" />
    </main>
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
  padding: 28px;
}
</style>
