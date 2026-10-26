<script setup>
import { ref, inject, watch } from 'vue';
import { useRoute } from 'vue-router';
import ViewportHeader from '../components/ViewportHeader.vue';
import SearchBar from '../components/SearchBar.vue';
import MDrawer from '../components/MDrawer.vue';
import MCollapse from '../components/MCollapse.vue';
import MTag from '../components/MTag.vue';
import { useLayoutState } from './useLayoutState.js';
import {
  Menu,
  Xmark,
  Terminal,
  Search,
  SunLight,
  HalfMoon,
  UserCircle,
  LogOut,
  DatabaseSolid,
  NavArrowRight
} from '@iconoir/vue';

// 注入共享布局状态
const state = inject('layoutState', null) || useLayoutState();

const {
  route,
  isDark,
  toggleTheme,
  categories,
  isLoadingCats,
  expandedCategories,
  toggleCategory,
  getCourseTooltip,
  currentUser,
  isLoggedIn,
  isSuperAdmin,
  userDisplayName,
  isUserModalOpen,
  openUserModal,
  handleLogout,
  navItems,
  currentItem,
  currentCourse,
  currentBreadcrumbs,
  showViewportHeader,
  isStartRoute,
  isKbActive,
  isItemActive,
  isCourseActive,
  navigateTo,
  selectCourse,
  docRefreshKey,
  handleRefreshDoc
} = state;

// 移动端专属 UI 交互状态
const isDrawerOpen = ref(false);
const isSearchOpen = ref(false);
const isKbExpanded = ref(true);

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

const handleCourseClick = (course) => {
  closeDrawer();
  selectCourse(course);
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
          <Search width="18" height="18" />
        </button>

        <!-- 深浅主题切换 -->
        <button
          type="button"
          class="mobile-icon-btn"
          :title="isDark ? '切换至浅色模式' : '切换至深色模式'"
          aria-label="切换浅色/深色模式"
          @click="toggleTheme"
        >
          <SunLight v-if="isDark" width="18" height="18" />
          <HalfMoon v-else width="18" height="18" />
        </button>

        <!-- 用户登录状态 / 头像 -->
        <button
          v-if="isLoggedIn"
          type="button"
          class="mobile-icon-btn user-btn"
          :class="{ active: isUserModalOpen }"
          title="个人中心"
          aria-label="个人中心"
          @click="openUserModal"
        >
          <UserCircle width="18" height="18" />
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
          <!-- 1. 开始 -->
          <button
            class="drawer-nav-item"
            :class="{ active: isItemActive(navItems[0]) }"
            @click="handleNavClick(navItems[0].path)"
          >
            <component :is="navItems[0].icon" width="18" height="18" class="item-icon" />
            <span class="item-text">{{ navItems[0].label }}</span>
          </button>

          <!-- 2. 如何使用 -->
          <button
            class="drawer-nav-item"
            :class="{ active: isItemActive(navItems[1]) }"
            @click="handleNavClick(navItems[1].path)"
          >
            <component :is="navItems[1].icon" width="18" height="18" class="item-icon" />
            <span class="item-text">{{ navItems[1].label }}</span>
          </button>

          <!-- 3. 知识库折叠分类树 -->
          <div class="drawer-kb-section">
            <button
              class="drawer-nav-item kb-parent-btn"
              :class="{ active: isKbActive }"
              @click="isKbExpanded = !isKbExpanded"
            >
              <DatabaseSolid width="18" height="18" class="item-icon" />
              <span class="item-text">知识库</span>
              <NavArrowRight
                width="14"
                height="14"
                class="kb-arrow"
                :class="{ 'is-open': isKbExpanded }"
              />
            </button>

            <MCollapse :open="isKbExpanded">
              <div class="drawer-kb-tree">
                <div v-if="isLoadingCats" class="drawer-kb-loading font-mono">
                  加载知识库分类...
                </div>

                <div
                  v-for="cat in categories"
                  :key="cat.id"
                  class="drawer-cat-block"
                >
                  <div
                    class="drawer-cat-title"
                    @click="toggleCategory(cat.id)"
                  >
                    <NavArrowRight
                      width="12"
                      height="12"
                      class="cat-arrow"
                      :class="{ 'is-open': expandedCategories.has(cat.id) }"
                    />
                    <span>{{ cat.name }}</span>
                  </div>

                  <MCollapse :open="expandedCategories.has(cat.id)">
                    <div class="drawer-course-sublist">
                      <div
                        v-for="course in cat.courses"
                        :key="course.id"
                        class="drawer-course-item"
                        :class="{
                          'is-offline': !course.live,
                          active: isCourseActive(course.id)
                        }"
                        @click="handleCourseClick(course)"
                      >
                        <span class="course-title">{{ course.title }}</span>
                        <MTag v-if="!course.live" variant="muted" size="sm">待上线</MTag>
                      </div>
                    </div>
                  </MCollapse>
                </div>
              </div>
            </MCollapse>
          </div>

          <!-- 4. 讲义推荐 -->
          <button
            class="drawer-nav-item"
            :class="{ active: isItemActive(navItems[2]) }"
            @click="handleNavClick(navItems[2].path)"
          >
            <component :is="navItems[2].icon" width="18" height="18" class="item-icon" />
            <span class="item-text">{{ navItems[2].label }}</span>
          </button>

          <!-- 5. 我的讲义 -->
          <button
            class="drawer-nav-item"
            :class="{ active: isItemActive(navItems[3]) }"
            @click="handleNavClick(navItems[3].path)"
          >
            <component :is="navItems[3].icon" width="18" height="18" class="item-icon" />
            <span class="item-text">{{ navItems[3].label }}</span>
          </button>

          <!-- 分割线 -->
          <div class="drawer-divider"></div>

          <!-- 6. 讲义工作台 (附带电脑端提示标签) -->
          <button
            class="drawer-nav-item"
            :class="{ active: isItemActive(navItems[4]) }"
            @click="handleNavClick(navItems[4].path)"
          >
            <component :is="navItems[4].icon" width="18" height="18" class="item-icon" />
            <span class="item-text">{{ navItems[4].label }}</span>
            <span class="pc-badge font-mono">电脑端</span>
          </button>

          <!-- 7. 平台管理 -->
          <button
            v-if="isSuperAdmin"
            class="drawer-nav-item"
            :class="{ active: isItemActive(navItems[5]) }"
            @click="handleNavClick(navItems[5].path)"
          >
            <component :is="navItems[5].icon" width="18" height="18" class="item-icon" />
            <span class="item-text">{{ navItems[5].label }}</span>
            <span class="pc-badge font-mono">电脑端</span>
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
        v-if="showViewportHeader"
        :title="currentCourse ? currentCourse.title : currentItem.label"
        :breadcrumbs="currentBreadcrumbs"
        @refresh="handleRefreshDoc"
      />

      <div class="mobile-content-container">
        <slot :current-item="currentItem">
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

.pc-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
}

.kb-parent-btn {
  justify-content: space-between;
}

.kb-arrow {
  color: var(--text-muted);
  transition: transform 160ms ease;
}

.kb-arrow.is-open {
  transform: rotate(90deg);
}

.drawer-kb-section {
  display: flex;
  flex-direction: column;
}

.drawer-kb-tree {
  margin: 2px 0 4px 18px;
  padding-left: 10px;
  border-left: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawer-kb-loading {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 12px;
}

.drawer-cat-block {
  display: flex;
  flex-direction: column;
}

.drawer-cat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-xs);
  user-select: none;
}

.drawer-cat-title:hover {
  color: var(--text-primary);
}

.cat-arrow {
  transition: transform 160ms ease;
}

.cat-arrow.is-open {
  transform: rotate(90deg);
}

.drawer-course-sublist {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 16px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
}

.drawer-course-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  cursor: pointer;
}

.drawer-course-item:hover,
.drawer-course-item:active {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.drawer-course-item.active {
  color: var(--accent-primary);
  font-weight: var(--font-weight-medium);
  background-color: var(--bg-hover);
}

.drawer-course-item.is-offline {
  opacity: 0.45;
  cursor: default;
}

.course-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
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
</style>
