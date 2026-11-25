<script setup>
import { inject, ref, watch } from 'vue';
import { RouterView } from 'vue-router';

import UserDataBackup from '../components/account/UserDataBackup.vue';
import MLanguageSwitcher from '../components/app/MLanguageSwitcher.vue';
import MThemeSwitcher from '../components/app/MThemeSwitcher.vue';
import MUpdateLog from '../components/app/MUpdateLog.vue';
import SearchBar from '../components/app/SearchBar.vue';
import ViewportHeader from '../components/app/ViewportHeader.vue';
import MTag from '../components/display/MTag.vue';
import MPageStatus from '../components/feedback/MPageStatus.vue';
import MButton from '../components/form/MButton.vue';
import { HelpCircle, LogOut, Menu, Search, UserCircle, Xmark } from '../components/icons/icons.js';
import MDrawer from '../components/overlay/MDrawer.vue';
import { t } from '../i18n.js';
import { canUseAi } from '../utils/ai-access.js';
import NavigationIcon from './NavigationIcon.vue';
import { useLayoutState } from './useLayoutState.js';

defineProps({
  documentScroll: Boolean
});

// 注入共享布局状态
const state = inject('layoutState', null) || useLayoutState();

const {
  route,
  currentTheme,
  setTheme,
  isLoggedIn,
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
  isItemActive,
  navigateTo,
  docRefreshKey,
  handleRefreshDoc
} = state;

// 移动端专属 UI 交互状态
const isDrawerOpen = ref(false);
const isSearchOpen = ref(false);

const toggleDrawer = () => {
  isDrawerOpen.value = !isDrawerOpen.value;
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
  <div
    class="maki-mobile-layout"
    :class="{
      'uses-document-scroll': documentScroll
    }"
  >
    <!-- 移动端顶部轻量工具栏 -->
    <header class="mobile-topbar">
      <button
        type="button"
        class="mobile-icon-btn"
        :title="t(isDrawerOpen ? '收起导航栏' : '打开导航目录')"
        :aria-label="t(isDrawerOpen ? '收起导航栏' : '打开导航目录')"
        :aria-expanded="isDrawerOpen"
        aria-controls="mobile-navigation-drawer"
        @click="toggleDrawer"
      >
        <component
          :is="isDrawerOpen ? Xmark : Menu"
          width="20"
          height="20"
        />
      </button>

      <div class="topbar-right">
        <!-- 搜索呼出按钮 -->
        <button
          type="button"
          class="mobile-icon-btn"
          :title="t('搜索数学节点或公式')"
          :aria-label="t('搜索数学节点或公式')"
          @click="openSearch"
        >
          <Search
            width="20"
            height="20"
          />
        </button>

        <button
          type="button"
          class="mobile-icon-btn user-btn"
          :class="{
            active: isUserModalOpen
          }"
          :title="t(isLoggedIn ? '个人中心' : '登录或注册')"
          :aria-label="t(isLoggedIn ? '个人中心' : '登录或注册')"
          @click="openUserModal"
        >
          <UserCircle
            width="20"
            height="20"
          />
        </button>
        <button
          v-if="isLoggedIn"
          type="button"
          class="mobile-icon-btn"
          :title="t('退出登录')"
          :aria-label="t('退出登录')"
          @click="handleLogout"
        >
          <LogOut
            width="20"
            height="20"
          />
        </button>
        <button
          type="button"
          class="mobile-icon-btn"
          :class="{
            active: isHelpModalOpen
          }"
          :title="t('如何使用')"
          :aria-label="t('如何使用')"
          @click="openHelpModal"
        >
          <HelpCircle
            width="20"
            height="20"
          />
        </button>
        <MLanguageSwitcher />
        <MThemeSwitcher
          :model-value="currentTheme"
          @update:model-value="setTheme"
        />
        <MUpdateLog />
      </div>
    </header>

    <!-- 移动端侧滑导航抽屉 -->
    <div class="mobile-navigation-layer">
      <MDrawer
        id="mobile-navigation-drawer"
        :open="isDrawerOpen"
        placement="left"
        :show-close="false"
        width="300px"
        @close="closeDrawer"
      >
        <div class="drawer-nav-container">
          <!-- 基础导航分组 -->
          <nav class="drawer-nav-list">
            <template
              v-for="(group, index) in navigationGroups"
              :key="index"
            >
              <div
                v-if="index"
                class="drawer-divider"
                aria-hidden="true"
              ></div>
              <button
                v-for="item in group"
                :key="item.id"
                class="drawer-nav-item"
                :class="{
                  active: isItemActive(item)
                }"
                @click="handleNavClick(item.path)"
              >
                <NavigationIcon
                  :name="item.id"
                  width="18"
                  height="18"
                  class="item-icon"
                />
                <span class="item-text">{{ item.label }}</span>
                <MTag
                  v-if="item.desktopOnly"
                  variant="muted"
                  size="sm"
                  >{{ t('电脑端') }}</MTag
                >
              </button>
            </template>
          </nav>

          <!-- 抽屉底部用户账户栏 -->
          <div
            v-if="isLoggedIn"
            class="drawer-user-footer"
          >
            <div
              class="user-info font-mono"
              @click="openUserModal"
            >
              <UserCircle
                width="18"
                height="18"
                class="user-avatar"
              />
              <span class="user-label">{{ t('个人中心') }}</span>
            </div>
            <button
              class="mobile-icon-btn logout-btn"
              :title="t('退出登录')"
              @click="handleLogout"
            >
              <LogOut
                width="16"
                height="16"
              />
            </button>
          </div>
        </div>
        <template #footer>
          <UserDataBackup />
        </template>
      </MDrawer>
    </div>

    <!-- 移动端全屏搜索舱浮层 -->
    <Transition name="search-overlay">
      <div
        v-if="isSearchOpen"
        class="mobile-search-overlay"
      >
        <div class="search-overlay-header">
          <div class="search-box-wrap">
            <SearchBar
              variant="hero"
              :auto-focus="true"
              @select="closeSearch"
              @navigate="closeSearch"
            />
          </div>
          <button
            type="button"
            class="close-search-btn"
            :title="t('关闭搜索')"
            @click="closeSearch"
          >
            <Xmark
              width="20"
              height="20"
            />
          </button>
        </div>
        <div
          class="search-overlay-backdrop"
          @click="closeSearch"
        ></div>
      </div>
    </Transition>

    <!-- 移动端主内容视口 (全屏单列，原生平滑滚动) -->
    <main
      class="mobile-viewport"
      :class="{
        'is-lecture-shelf': route.name === 'my-lecture' || route.name === 'ai-lab',
        'is-reading': route.name === 'lecture-doc' || route.name === 'local-lecture-doc'
      }"
    >
      <ViewportHeader
        v-if="showViewportHeader && !currentItem.desktopOnly"
        :title="currentLecture ? currentLecture.title : currentItem.label"
        :breadcrumbs="currentBreadcrumbs"
        @refresh="handleRefreshDoc"
      />

      <div class="mobile-content-container">
        <div
          v-if="currentItem.desktopOnly"
          class="desktop-only-notice"
        >
          <span class="desktop-only-label font-mono">DESKTOP ONLY</span>
          <h2>{{ t('请在电脑端使用') }}</h2>
          <p>
            {{
              t('移动端不支持', {
                name: currentItem.label
              })
            }}
          </p>
          <MButton
            size="sm"
            @click="handleNavClick('/my-lecture')"
            >{{ t('返回首页') }}</MButton
          >
        </div>
        <slot :current-item="currentItem">
          <RouterView v-slot="{ Component, route: viewRoute }">
            <KeepAlive v-if="canUseAi">
              <component
                :is="Component"
                v-if="viewRoute.name === 'ai-lab' && !currentItem.desktopOnly"
              />
            </KeepAlive>
            <MPageStatus
              v-if="viewRoute.name === 'ai-lab' && !canUseAi"
              text="正在验证登录状态"
            />
            <component
              :is="Component"
              v-if="viewRoute.name !== 'ai-lab' && !currentItem.desktopOnly"
              :key="docRefreshKey"
            />
          </RouterView>
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
  height: 100%;
  color: var(--text-primary);
  overflow: hidden;
  position: relative;
}

.maki-mobile-layout.uses-document-scroll {
  height: auto;
  min-height: inherit;
  overflow: visible;
}

.mobile-navigation-layer {
  position: absolute;
  inset: var(--layout-mobile-topbar-height) 0 0;
  z-index: 50;
  pointer-events: none;
}

.uses-document-scroll .mobile-navigation-layer {
  position: fixed;
}

.uses-document-scroll .mobile-navigation-layer :deep(.m-backdrop) {
  touch-action: none;
}

.uses-document-scroll .mobile-topbar {
  position: sticky;
  top: 0;
}

/* 移动端顶栏 */
.mobile-topbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--layout-mobile-topbar-height);
  padding: env(safe-area-inset-top, 0px) 10px 0;
  background-color: var(--bg-topbar);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  z-index: 60;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 1 auto;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.topbar-right > * {
  flex: none;
}
.topbar-right::-webkit-scrollbar {
  display: none;
}
.mobile-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    color 140ms ease;
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

/* 抽屉导航内容结构 */
.drawer-nav-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 0 20px;
  overflow-y: auto;
  overscroll-behavior-y: contain;
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
  border-radius: var(--radius);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: var(--font-size);
  transition:
    background-color 140ms ease,
    color 140ms ease;
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
  box-shadow: 0 4px 20px var(--overlay-backdrop);
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
  border-radius: var(--radius);
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
  background: var(--search-overlay);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

.search-overlay-enter-active,
.search-overlay-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
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
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  min-width: 0;
  min-height: 0;
}

.mobile-viewport.is-lecture-shelf,
.mobile-viewport.is-reading {
  overflow: hidden;
}
.mobile-viewport.is-lecture-shelf .mobile-content-container,
.mobile-viewport.is-reading .mobile-content-container {
  min-height: 0;
  overflow: hidden;
}

.mobile-content-container {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  position: relative;
}

.uses-document-scroll .mobile-viewport,
.uses-document-scroll .mobile-viewport .mobile-content-container,
.uses-document-scroll :deep(.lecture-doc-view),
.uses-document-scroll :deep(.reading-viewport),
.uses-document-scroll :deep(.my-lecture) {
  overflow: visible;
}

.desktop-only-notice {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  text-align: center;
}
.desktop-only-label {
  margin-bottom: 16px;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
  letter-spacing: 0.08em;
}
.desktop-only-notice h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-medium);
}
.desktop-only-notice p {
  margin: 12px 0 20px;
  color: var(--text-secondary);
  font-size: var(--font-size);
  line-height: 1.6;
}
</style>
