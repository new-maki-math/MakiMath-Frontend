<script setup>
import { ref, inject, watch } from 'vue';
import ViewportHeader from '../components/ViewportHeader.vue';
import SearchBar from '../components/SearchBar.vue';
import MDrawer from '../components/MDrawer.vue';
import MTag from '../components/MTag.vue';
import MButton from '../components/MButton.vue';
import { useLayoutState } from './useLayoutState.js';
import {
  Menu,
  Xmark,
  Terminal,
  Search,
  SunLight,
  HalfMoon,
  HelpCircle,
  UserCircle,
  LogOut
} from '@iconoir/vue';

// 注入共享布局状态
const state = inject('layoutState', null) || useLayoutState();

const {
  route,
  isDark,
  toggleTheme,
  isLoggedIn,
  userDisplayName,
  isUserModalOpen,
  isHelpModalOpen,
  openHelpModal,
  openUserModal,
  handleLogout,
  navigationGroups,
  currentItem,
  currentCourse,
  currentBreadcrumbs,
  showViewportHeader,
  isStartRoute,
  isItemActive,
  navigateTo,
  docRefreshKey,
  handleRefreshDoc
} = state;

// 移动端专属 UI 交互状态
const isDrawerOpen = ref(false);
const isSearchOpen = ref(false);

const openDrawer = () => {
  isDrawerOpen.value = true;
};

const closeDrawer = () => {
  isDrawerOpen.value = false;
};

const openSearch = () => {
  isSearchOpen.value = true;
};

const closeSearch = () => {
  isSearchOpen.value = false;
};

const handleNavClick = (path) => {
  closeDrawer();
  navigateTo(path);
};

// 路由变化时自动收起抽屉和搜索
watch(
  () => route.path,
  () => {
    isDrawerOpen.value = false;
    isSearchOpen.value = false;
  }
);
</script>

<template>
  <div class="maki-mobile-layout">
    <!-- 移动端顶部轻量工具栏 (Mobile Topbar) -->
    <header class="mobile-topbar">
      <div class="topbar-left">
        <!-- 汉堡包侧边栏呼出按钮 (44px 舒适触控区) -->
        <button
          type="button"
          class="mobile-icon-btn hamburger-btn"
          title="打开导航目录"
          aria-label="打开导航目录"
          @click="openDrawer"
        >
          <Menu width="20" height="20" />
        </button>

        <!-- 品牌标识 -->
        <div class="mobile-brand" @click="handleNavClick('/start')">
          <Terminal width="16" height="16" class="brand-icon" />
          <span class="brand-name">MAKI</span>
          <span class="brand-sep">//</span>
          <span class="brand-sub">MATH</span>
        </div>
      </div>

      <div class="topbar-right">
        <!-- 搜索呼出按钮（欢迎页中央已有大搜索舱，此处自适应隐藏） -->
        <button
          v-if="!isStartRoute"
          type="button"
          class="mobile-icon-btn"
          title="搜索数学节点或公式"
          aria-label="搜索数学节点或公式"
          @click="openSearch"
        >
          <Search width="20" height="20" />
        </button>

        <!-- 深浅主题切换 -->
        <button
          type="button"
          class="mobile-icon-btn"
          :title="isDark ? '切换至浅色模式' : '切换至深色模式'"
          aria-label="切换浅色/深色模式"
          @click="toggleTheme"
        >
          <SunLight v-if="isDark" width="20" height="20" />
          <HalfMoon v-else width="20" height="20" />
        </button>

        <!-- 用户登录状态 / 头像 -->
        <button
          type="button"
          class="mobile-icon-btn user-btn"
          :class="{ active: isUserModalOpen }"
          :title="isLoggedIn ? '个人中心' : '登录或注册'"
          :aria-label="isLoggedIn ? '个人中心' : '登录或注册'"
          @click="openUserModal"
        >
          <UserCircle width="20" height="20" />
        </button>
        <button
          type="button"
          class="mobile-icon-btn"
          :class="{ active: isHelpModalOpen }"
          title="如何使用"
          aria-label="如何使用"
          @click="openHelpModal"
        >
          <HelpCircle width="20" height="20" />
        </button>
      </div>
    </header>

    <!-- 移动端侧滑导航抽屉 (Mobile Navigation Drawer) -->
    <MDrawer
      :open="isDrawerOpen"
      placement="left"
      title="MAKI MATH // 导航"
      width="300px"
      @close="closeDrawer"
    >
      <div class="drawer-nav-container">
        <!-- 基础导航分组 -->
        <nav class="drawer-nav-list">
          <button
            v-for="item in navigationGroups[0]"
            :key="item.id"
            class="drawer-nav-item"
            :class="{ active: isItemActive(item) }"
            @click="handleNavClick(item.path)"
          >
            <component :is="item.icon" width="18" height="18" class="item-icon" />
            <span class="item-text">{{ item.label }}</span>
          </button>

          <button
            v-for="item in navigationGroups[1]"
            :key="item.id"
            class="drawer-nav-item"
            :class="{ active: isItemActive(item) }"
            @click="handleNavClick(item.path)"
          >
            <component :is="item.icon" width="18" height="18" class="item-icon" />
            <span class="item-text">{{ item.label }}</span>
          </button>

          <div class="drawer-divider"></div>

          <button
            v-for="item in navigationGroups[2]"
            :key="item.id"
            class="drawer-nav-item"
            :class="{ active: isItemActive(item) }"
            @click="handleNavClick(item.path)"
          >
            <component :is="item.icon" width="18" height="18" class="item-icon" />
            <span class="item-text">{{ item.label }}</span>
            <MTag v-if="item.desktopOnly" variant="muted" size="sm">电脑端</MTag>
          </button>

        </nav>

        <!-- 抽屉底部用户账户栏 -->
        <div v-if="isLoggedIn" class="drawer-user-footer">
          <div class="user-info font-mono" @click="openUserModal">
            <UserCircle width="18" height="18" class="user-avatar" />
            <span class="user-label">{{ userDisplayName }}</span>
          </div>
          <button
            class="mobile-icon-btn logout-btn"
            title="退出登录"
            @click="handleLogout"
          >
            <LogOut width="16" height="16" />
          </button>
        </div>
      </div>
    </MDrawer>

    <!-- 移动端全屏搜索舱浮层 (Mobile Search Overlay) -->
    <Transition name="search-overlay">
      <div v-if="isSearchOpen" class="mobile-search-overlay">
        <div class="search-overlay-header">
          <div class="search-box-wrap">
            <SearchBar variant="hero" :auto-focus="true" @navigate="closeSearch" />
          </div>
          <button
            type="button"
            class="close-search-btn"
            title="关闭搜索"
            @click="closeSearch"
          >
            <Xmark width="20" height="20" />
          </button>
        </div>
        <div class="search-overlay-backdrop" @click="closeSearch"></div>
      </div>
    </Transition>

    <!-- 移动端主内容视口 (全屏单列，原生平滑滚动) -->
    <main class="mobile-viewport">
      <ViewportHeader
        v-if="showViewportHeader && !currentItem.desktopOnly"
        :title="currentCourse ? currentCourse.title : currentItem.label"
        :breadcrumbs="currentBreadcrumbs"
        @refresh="handleRefreshDoc"
      />

      <div class="mobile-content-container">
        <div v-if="currentItem.desktopOnly" class="desktop-only-notice">
          <span class="desktop-only-label font-mono">DESKTOP ONLY</span>
          <h2>请在电脑端使用</h2>
          <p>{{ currentItem.label }}暂不支持移动端，请使用电脑访问。</p>
          <MButton size="sm" @click="handleNavClick('/start')">返回首页</MButton>
        </div>
        <slot v-else :current-item="currentItem">
          <router-view :key="docRefreshKey" />
        </slot>
      </div>
    </main>
  </div>
</template>

<style scoped>
.maki-mobile-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: var(--bg-app);
  color: var(--text-primary);
  overflow: hidden;
  position: relative;
}

/* 移动端顶栏 */
.mobile-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 10px;
  background-color: var(--bg-topbar);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  z-index: 60;
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mobile-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
  flex-shrink: 0;
}

.mobile-icon-btn:hover,
.mobile-icon-btn:active {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.mobile-icon-btn.active {
  color: var(--accent-primary);
}

.mobile-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-xs);
  user-select: none;
}

.brand-icon {
  color: var(--text-primary);
}

.brand-name {
  font-size: var(--font-size);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.brand-sep {
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}

.brand-sub {
  color: var(--accent-primary);
  font-size: var(--font-size);
  font-weight: var(--font-weight-semibold);
}

/* 抽屉导航内容结构 */
.drawer-nav-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 0 20px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.drawer-nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 10px;
  flex: 1;
}

.drawer-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 42px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: var(--font-size);
  transition: background-color 140ms ease, color 140ms ease;
}

.drawer-nav-item:hover,
.drawer-nav-item:active {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.drawer-nav-item.active {
  background-color: var(--bg-hover);
  color: var(--accent-primary);
  font-weight: var(--font-weight-semibold);
}

.item-icon {
  flex-shrink: 0;
  color: inherit;
}

.item-text {
  flex: 1;
  white-space: nowrap;
}

.drawer-divider {
  height: 1px;
  background-color: var(--border-subtle);
  margin: 8px 0;
}

.drawer-user-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 0;
  border-top: 1px solid var(--border-subtle);
  margin-top: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-smaller);
  color: var(--text-primary);
  cursor: pointer;
  max-width: 190px;
}

.user-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 移动端全屏搜索浮层 */
.mobile-search-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.search-overlay-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background-color: var(--bg-app);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.search-box-wrap {
  flex: 1;
  min-width: 0;
}

.close-search-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
}

.close-search-btn:active {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.search-overlay-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
}

.search-overlay-enter-active,
.search-overlay-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.search-overlay-enter-from,
.search-overlay-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 主视口区域 */
.mobile-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  min-width: 0;
  height: calc(100vh - 48px);
}

.mobile-content-container {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  position: relative;
}

.desktop-only-notice { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; text-align: center; }
.desktop-only-label { margin-bottom: 16px; color: var(--text-muted); font-size: var(--font-size-smaller); letter-spacing: 0.08em; }
.desktop-only-notice h2 { margin: 0; color: var(--text-primary); font-size: var(--font-size-larger); font-weight: var(--font-weight-medium); }
.desktop-only-notice p { margin: 12px 0 20px; color: var(--text-secondary); font-size: var(--font-size); line-height: 1.6; }
</style>
