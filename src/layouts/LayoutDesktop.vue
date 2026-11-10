<script setup>
import { inject, ref } from 'vue';
import { RouterView } from 'vue-router';

import UserDataBackup from '../components/account/UserDataBackup.vue';
import MThemeSwitcher from '../components/app/MThemeSwitcher.vue';
import MUpdateLog from '../components/app/MUpdateLog.vue';
import SearchBar from '../components/app/SearchBar.vue';
import ViewportHeader from '../components/app/ViewportHeader.vue';
import {
  HelpCircle,
  LogOut,
  NavArrowLeft,
  NavArrowRight,
  Terminal,
  UserCircle
} from '../components/icons/icons.js';
import MCollapse from '../components/overlay/MCollapse.vue';
import NavigationIcon from './NavigationIcon.vue';
import { useLayoutState } from './useLayoutState.js';

// 复用根布局的共享状态
const state = inject('layoutState', null) || useLayoutState();

const {
  currentTheme,
  setTheme,
  isLoggedIn,
  userDisplayName,
  isUserModalOpen,
  isHelpModalOpen,
  openHelpModal,
  openUserModal,
  handleLogout,
  navigationGroups,
  currentItem,
  currentLecture,
  currentBreadcrumbs,
  showViewportHeader,
  isViewportLocked,
  isItemActive,
  navigateTo,
  docRefreshKey,
  handleRefreshDoc
} = state;

// 桌面端侧边栏折叠状态
const isSidebarCollapsed = ref(localStorage.getItem('maki_sidebar_collapsed') === 'true');

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  localStorage.setItem('maki_sidebar_collapsed', String(isSidebarCollapsed.value));
};

const handleNavClick = (item) => {
  if (isSidebarCollapsed.value) {
    isSidebarCollapsed.value = false;
    localStorage.setItem('maki_sidebar_collapsed', 'false');
    return;
  }
  navigateTo(item.path);
};
</script>

<template>
  <div class="maki-layout">
    <!-- 顶部全局工具栏 -->
    <header class="maki-topbar">
      <div class="topbar-left">
        <div
          class="brand-badge"
          @click="navigateTo('/my-lecture')"
        >
          <Terminal
            width="18"
            height="18"
          />
          <span class="brand-text">MAKI</span>
          <span class="brand-sep">//</span>
          <span class="brand-sub">MATH</span>
        </div>
      </div>

      <div class="topbar-center">
        <SearchBar variant="topbar" />
      </div>

      <div class="topbar-right">
        <div class="user-profile-anchor font-mono">
          <span
            v-if="isLoggedIn"
            class="user-name"
            :title="userDisplayName"
            >{{ userDisplayName }}</span
          >
          <button
            class="topbar-action-btn"
            :class="{
              active: isUserModalOpen
            }"
            :title="isLoggedIn ? '用户设置与详情' : '登录或注册'"
            :aria-label="isLoggedIn ? '查看用户设置与详情' : '登录或注册'"
            @click="openUserModal"
          >
            <UserCircle
              width="20"
              height="20"
            />
          </button>
        </div>

        <button
          v-if="isLoggedIn"
          class="topbar-action-btn"
          title="退出登录"
          aria-label="退出登录"
          @click="handleLogout"
        >
          <LogOut
            width="20"
            height="20"
          />
        </button>

        <button
          type="button"
          class="topbar-action-btn"
          :class="{
            active: isHelpModalOpen
          }"
          title="如何使用"
          aria-label="如何使用"
          @click="openHelpModal"
        >
          <HelpCircle
            width="20"
            height="20"
          />
        </button>

        <MThemeSwitcher
          :model-value="currentTheme"
          @update:model-value="setTheme"
        />
        <MUpdateLog />
      </div>
    </header>

    <!-- 主体区域：左侧导航 + 工作区 -->
    <div class="maki-main">
      <!-- 桌面端侧边栏 -->
      <aside
        class="maki-sidebar"
        :class="{
          'is-collapsed': isSidebarCollapsed
        }"
      >
        <div
          class="sidebar-header"
          :class="{
            'is-collapsed': isSidebarCollapsed
          }"
        >
          <MCollapse
            horizontal
            :open="!isSidebarCollapsed"
          >
            <span class="sidebar-section-title font-mono">NAVIGATION</span>
          </MCollapse>
          <button
            class="sidebar-collapse-btn"
            :title="isSidebarCollapsed ? '展开导航栏' : '收起导航栏'"
            @click="toggleSidebar"
          >
            <component
              :is="isSidebarCollapsed ? NavArrowRight : NavArrowLeft"
              width="13"
              height="13"
            />
          </button>
        </div>

        <nav class="sidebar-nav">
          <template
            v-for="(group, index) in navigationGroups"
            :key="index"
          >
            <div
              v-if="index"
              class="sidebar-divider"
              aria-hidden="true"
            ></div>
            <button
              v-for="item in group"
              :key="item.id"
              :data-navigation-id="item.id"
              class="nav-button"
              :class="{
                active: isItemActive(item)
              }"
              :title="isSidebarCollapsed ? item.label : undefined"
              @click="handleNavClick(item)"
            >
              <div class="nav-icon-wrap">
                <NavigationIcon
                  :name="item.id"
                  width="18"
                  height="18"
                  class="nav-icon"
                />
              </div>
              <MCollapse
                horizontal
                :open="!isSidebarCollapsed"
                class="nav-label-collapse"
              >
                <span class="nav-label">{{ item.label }}</span>
              </MCollapse>
            </button>
          </template>
        </nav>

        <div class="sidebar-footer">
          <UserDataBackup />
        </div>
      </aside>

      <!-- 工作视口 -->
      <main
        class="maki-viewport"
        :class="{
          'is-locked': isViewportLocked
        }"
      >
        <ViewportHeader
          v-if="showViewportHeader"
          :title="currentLecture ? currentLecture.title : currentItem.label"
          :breadcrumbs="currentBreadcrumbs"
          @refresh="handleRefreshDoc"
        />

        <slot :current-item="currentItem">
          <RouterView :key="docRefreshKey" />
        </slot>
      </main>
    </div>
  </div>
</template>

<style scoped>
.maki-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: var(--bg-app);
  color: var(--text-primary);
  overflow: hidden;
}

/* 顶栏容器 */
.maki-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--topbar-height);
  padding: 0 16px;
  background-color: var(--bg-topbar);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  position: relative;
  z-index: 90;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-larger);
  letter-spacing: 0.5px;
  cursor: pointer;
  user-select: none;
}

.brand-text {
  color: var(--text-primary);
}

.brand-sep {
  color: var(--text-muted);
}

.brand-sub {
  color: var(--accent-primary);
}

/* 顶栏搜索栏淡入淡出 */
.topbar-center {
  flex: 1;
  max-width: 500px;
  margin: 0 20px;
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 1;
  transform: translateY(0);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-profile-anchor {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: transparent;
  border: none;
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
}

.user-name {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius);
  color: var(--text-secondary);
  background-color: transparent;
  border: none;
  transition:
    background-color 140ms ease,
    color 140ms ease;
  flex-shrink: 0;
  cursor: pointer;
}

.topbar-action-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* 主体分栏 */
.maki-main {
  display: flex;
  flex: 1;
  height: calc(100vh - var(--topbar-height));
  overflow: hidden;
}

/* 侧边栏容器 */
.maki-sidebar {
  width: var(--sidebar-width, max-content);
  min-width: var(--sidebar-min-width);
  max-width: var(--sidebar-max-width);
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  z-index: 40;
  transition:
    width 160ms cubic-bezier(0.2, 0, 0, 1),
    min-width 160ms cubic-bezier(0.2, 0, 0, 1),
    max-width 160ms cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden;
}

.maki-sidebar.is-collapsed {
  width: 52px;
  min-width: 52px;
  max-width: 52px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px 8px 16px;
  min-height: 42px;
  gap: 8px;
  flex-shrink: 0;
}

.sidebar-header.is-collapsed {
  justify-content: center;
  padding: 12px 0 8px;
  gap: 0;
  width: 100%;
}

.sidebar-header.is-collapsed .m-collapse {
  display: none;
}

.sidebar-section-title {
  font-size: var(--font-size-smallest);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 1px;
  color: var(--text-muted);
  white-space: nowrap;
}

.sidebar-collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius);
  background: transparent;
  border: 0;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.sidebar-header.is-collapsed .sidebar-collapse-btn {
  margin: 0 auto;
}

.sidebar-collapse-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-collapse-btn:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 8px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-divider {
  flex: none;
  align-self: stretch;
  height: 1px;
  margin: 6px 8px;
  background: var(--border-subtle);
}

.maki-sidebar.is-collapsed .sidebar-divider {
  width: 24px;
  align-self: center;
  margin: 6px 0;
}

.maki-sidebar.is-collapsed .sidebar-nav {
  padding: 0;
  width: 100%;
  align-items: center;
}

.nav-button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 140ms ease,
    color 140ms ease;
  position: relative;
  flex-shrink: 0;
}

.maki-sidebar.is-collapsed .nav-button {
  width: 36px;
  height: 36px;
  padding: 0;
  margin: 0 auto;
  justify-content: center;
  gap: 0;
}

.maki-sidebar.is-collapsed .nav-label-collapse {
  display: none;
}

.maki-sidebar.is-collapsed .nav-icon-wrap {
  margin: 0 auto;
}

.nav-button:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.nav-button.active {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

/* 激活指示条 */
.nav-button.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  background-color: var(--accent-primary);
  border-radius: var(--radius-none) var(--radius) var(--radius) var(--radius-none);
}

.maki-sidebar.is-collapsed .nav-button.active::before {
  left: 0;
  top: 8px;
  bottom: 8px;
}

.nav-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: inherit;
  flex-shrink: 0;
}

.nav-label {
  font-size: var(--font-size);
  flex: 1 1 auto;
  white-space: nowrap;
}

.nav-label-collapse {
  flex: 1 1 auto;
  min-width: 0;
}

.sidebar-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
}

.maki-sidebar.is-collapsed .sidebar-footer {
  justify-content: center;
}
.maki-sidebar.is-collapsed .sidebar-footer :deep(.backup-actions) {
  flex-direction: column;
}

/* 主视口区域 */
.maki-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-app);
  overflow-y: auto;
  min-width: 0;
}

/* 锁定外层滚动 */
.maki-viewport.is-locked {
  overflow: hidden;
}
</style>
