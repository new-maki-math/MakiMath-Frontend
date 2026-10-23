<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ProgressBar from '../components/ProgressBar.vue';
import { getCourseCategories, getCourseChapters, getCachedCourseChapters } from '../api';
import {
  transformCourseCategories,
  registerProgressBar,
  beginNavigation,
  endNavigation,
  startProgress,
  currentUser,
  isLoggedIn,
  isSuperAdmin,
  clearAuth,
  initAuth
} from '../utils';
import { notify } from '../components/MNotice.vue';
import MUserModal from '../components/MUserModal.vue';
import {
  PlaySolid,
  HelpCircleSolid,
  DatabaseSolid,
  StarSolid,
  BookmarkSolid,
  Terminal,
  ReportsSolid,
  CubeScanSolid,
  FlaskSolid,
  NavArrowRight,
  NavArrowLeft,
  SunLight,
  HalfMoon,
  LogOut,
  UserCircle,
  Search
} from '@iconoir/vue';

const route = useRoute();
const router = useRouter();
const progressBarRef = ref(null);

// 主题模式控制
const isDark = ref(true);

const initTheme = () => {
  if (typeof window === 'undefined') return;
  const saved = localStorage.getItem('maki-theme');
  if (saved === 'light') {
    isDark.value = false;
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    isDark.value = true;
    document.documentElement.removeAttribute('data-theme');
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('maki-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('maki-theme', 'light');
  }
};

// 预初始化主题
initTheme();

// 知识库折叠状态与分类数据
const isKbOpen = ref(true);
const categories = ref([]);
const isLoadingCats = ref(false);
// 展开的分类集合
const expandedCategories = ref(new Set());

const toggleCategory = (catId) => {
  if (expandedCategories.value.has(catId)) {
    expandedCategories.value.delete(catId);
  } else {
    expandedCategories.value.add(catId);
  }
};

// 获取课程悬浮提示
const getCourseTooltip = (course) => {
  const desc = course.desc || course.title;
  return !course.live ? `[筹划中] ${desc}` : desc;
};

// 当前用户显示名称
const userDisplayName = computed(() => {
  return currentUser.value?.displayName || currentUser.value?.display_name || currentUser.value?.username || '';
});

// 用户详情弹窗展开状态
const isUserModalOpen = ref(false);

const openUserModal = () => {
  isUserModalOpen.value = true;
};

const closeUserModal = () => {
  isUserModalOpen.value = false;
};

// 处理退出登录
const handleLogout = () => {
  isUserModalOpen.value = false;
  clearAuth();
  notify('已退出登录', 'info');
  if (route.path === '/platform') {
    router.push('/start');
  }
};

// 基础页面导航项配置
const navItems = [
  { id: 'start', label: '开始', path: '/start', icon: PlaySolid, tag: 'INIT' },
  { id: 'how-to-use', label: '如何使用', path: '/how-to-use', icon: HelpCircleSolid, tag: 'DOCS' },
  { id: 'recom-lecture', label: '讲义推荐', path: '/recom-lecture', icon: StarSolid, tag: 'HOT' },
  { id: 'my-lecture', label: '我的讲义', path: '/my-lecture', icon: BookmarkSolid, tag: 'LOCAL' },
  { id: 'workbench', label: '讲义工作台', path: '/workbench', icon: FlaskSolid, tag: 'WORKBENCH' },
  { id: 'platform', label: '平台管理', path: '/platform', icon: CubeScanSolid, tag: 'PLATFORM' },
];

// 当前匹配导航项
const currentItem = computed(() => {
  const match = navItems.find(item => item.path === route.path);
  if (match) return match;

  return {
    id: route.name || 'custom',
    label: route.meta?.title || '页面',
    path: route.path,
    tag: route.meta?.tag || 'VIEW'
  };
});

// 当前课程数据
const currentCourse = computed(() => {
  const courseId = route.params.courseId;
  if (!courseId) return null;
  for (const cat of categories.value) {
    const found = cat.courses?.find(c => c.id === courseId);
    if (found) return { ...found, categoryName: cat.name };
  }
  return null;
});

// 监听课程章节树
const layoutChapters = ref([]);

watch(
  () => [route.params.courseId, route.name],
  async ([courseId, name]) => {
    if (name === 'lecture-doc' || name === 'course-home' || courseId) {
      const cid = courseId || '1';
      try {
        layoutChapters.value = await getCourseChapters(cid);
      } catch (e) {
        layoutChapters.value = [];
      }
    }
  },
  { immediate: true }
);

// 计算面包屑路径
const currentBreadcrumbs = computed(() => {
  if (route.name === 'lecture-doc') {
    const courseId = route.params.courseId || '1';
    const courseTitle = currentCourse.value?.title || (courseId === '1' ? '考研数学' : courseId);
    const chapters = layoutChapters.value.length ? layoutChapters.value : getCachedCourseChapters(courseId);
    const sectionId = String(route.params.sectionId || '').trim();

    let chapterName = '';
    let sectionName = '';

    for (const chap of chapters) {
      const sec = chap.sections?.find(s => String(s.id) === sectionId || (s.slug && String(s.slug) === sectionId));
      if (sec) {
        chapterName = chap.tag ? `${chap.tag} ${chap.title}` : chap.title;
        sectionName = sec.title;
        break;
      }
    }

    if (!sectionName && chapters.length > 0) {
      const firstChap = chapters[0];
      chapterName = firstChap.tag ? `${firstChap.tag} ${firstChap.title}` : firstChap.title;
      sectionName = firstChap.sections?.[0]?.title || '讲义阅读';
    }

    const crumbs = ['APP', '知识库', courseTitle];
    if (chapterName) crumbs.push(chapterName);
    if (sectionName) crumbs.push(sectionName);
    return crumbs;
  }
  if (route.name === 'course-home' || route.params.courseId) {
    const courseTitle = currentCourse.value?.title || route.params.courseId || '课程';
    return ['APP', '知识库', courseTitle];
  }
  return ['APP', currentItem.value.label];
});

// 控制视口头部显示
const showViewportHeader = computed(() => {
  return (
    route.path !== '/start' &&
    route.name !== 'start' &&
    route.name !== 'workbench' &&
    route.name !== 'platform' &&
    route.path !== '/platform'
  );
});

// 锁定视口外层滚动
const isViewportLocked = computed(() => {
  return (
    route.name === 'workbench' ||
    route.name === 'platform' ||
    route.path === '/platform' ||
    route.name === 'start' ||
    route.path === '/start'
  );
});

// 判断是否为欢迎页
const isStartRoute = computed(() => route.path === '/start' || route.name === 'start');

// 侧边栏折叠状态
const isSidebarCollapsed = ref(localStorage.getItem('maki_sidebar_collapsed') === 'true');

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  localStorage.setItem('maki_sidebar_collapsed', String(isSidebarCollapsed.value));
};

// 导航项点击处理
const handleNavClick = (item) => {
  if (isSidebarCollapsed.value) {
    isSidebarCollapsed.value = false;
    localStorage.setItem('maki_sidebar_collapsed', 'false');
    return;
  }
  navigateTo(item.path);
};

// 知识库菜单点击处理
const handleKbClick = () => {
  if (isSidebarCollapsed.value) {
    isSidebarCollapsed.value = false;
    isKbOpen.value = true;
    localStorage.setItem('maki_sidebar_collapsed', 'false');
    return;
  }
  toggleKb();
};

// 判断知识库是否激活
const isKbActive = computed(() => {
  return (
    route.name === 'course-home' ||
    route.name === 'lecture-doc' ||
    route.path.startsWith('/course/')
  );
});

// 判断导航项是否激活
const isItemActive = (item) => {
  return route.path === item.path;
};

// 判断课程是否激活
const isCourseActive = (courseId) => {
  return (route.name === 'course-home' || route.name === 'lecture-doc' || route.path.startsWith('/course/')) && route.params.courseId === courseId;
};

// 切换知识库折叠
const toggleKb = () => {
  isKbOpen.value = !isKbOpen.value;
};

// 路由跳转
const navigateTo = (targetPath) => {
  if (route.path === targetPath) return;
  router.push(targetPath);
};

// 导航至课程首页
const selectCourse = (course) => {
  navigateTo(`/course/${course.id}`);
};

// 加载分类
const loadCategories = async () => {
  isLoadingCats.value = true;
  try {
    const rawCats = await getCourseCategories();
    const transformed = transformCourseCategories(rawCats);
    categories.value = transformed;
    // 默认展开所有大类
    expandedCategories.value = new Set(transformed.map(c => c.id));
  } finally {
    isLoadingCats.value = false;
  }
};

// 挂载路由守卫与加载分类
onMounted(() => {
  initAuth();
  if (progressBarRef.value) {
    registerProgressBar(progressBarRef.value);
  }
  loadCategories();

  router.beforeEach((to, from, next) => {
    isUserModalOpen.value = false;
    if (to.path !== from.path) {
      beginNavigation();
    }
    next();
  });

  router.afterEach(() => {
    endNavigation();
  });
});

// 局部刷新内容视图
const docRefreshKey = ref(0);
const handleRefreshDoc = () => {
  startProgress();
  docRefreshKey.value++;
};
</script>

<template>
  <div class="maki-layout">
    <!-- 顶部全局加载进度条 -->
    <ProgressBar ref="progressBarRef" />

    <!-- 顶部全局工具栏 (Header Bar) -->
    <header class="maki-topbar">
      <div class="topbar-left">
        <div class="brand-badge" @click="navigateTo('/start')">
          <Terminal width="18" height="18" />
          <span class="brand-text">MAKI</span>
          <span class="brand-sep">//</span>
          <span class="brand-sub">MATH</span>
        </div>
      </div>

      <div class="topbar-center" :class="{ 'is-hidden-on-start': isStartRoute }">
        <SearchBar variant="topbar" />
      </div>

      <div class="topbar-right">
        <div v-if="isLoggedIn" class="user-profile-anchor font-mono">
          <span class="user-name" :title="userDisplayName">{{ userDisplayName }}</span>
          <button
            class="topbar-action-btn"
            :class="{ active: isUserModalOpen }"
            title="用户设置与详情"
            aria-label="查看用户设置与详情"
            @click="openUserModal"
          >
            <UserCircle width="16" height="16" />
          </button>
        </div>

        <button
          v-if="isLoggedIn"
          class="topbar-action-btn"
          title="退出登录"
          aria-label="退出登录"
          @click="handleLogout"
        >
          <LogOut width="16" height="16" />
        </button>

        <button
          class="topbar-action-btn"
          :title="isDark ? '切换至浅色模式' : '切换至深色模式'"
          aria-label="切换浅色/深色模式"
          @click="toggleTheme"
        >
          <SunLight v-if="isDark" width="16" height="16" />
          <HalfMoon v-else width="16" height="16" />
        </button>
      </div>
    </header>

    <!-- 主体区域：左侧导航 + 工作区 -->
    <div class="maki-main">
      <!-- 页面内侧边栏 (In-Page Navigation Sidebar) -->
      <aside class="maki-sidebar" :class="{ 'is-collapsed': isSidebarCollapsed }">
        <div class="sidebar-header" :class="{ 'is-collapsed': isSidebarCollapsed }">
          <MCollapse horizontal :open="!isSidebarCollapsed">
            <span class="sidebar-section-title font-mono">NAVIGATION</span>
          </MCollapse>
          <button
            class="sidebar-collapse-btn"
            :title="isSidebarCollapsed ? '展开导航栏' : '收起导航栏'"
            @click="toggleSidebar"
          >
            <component :is="isSidebarCollapsed ? NavArrowRight : NavArrowLeft" width="13" height="13" />
          </button>
        </div>

        <nav class="sidebar-nav">
          <!-- 1. 开始 -->
          <button
            class="nav-button"
            :class="{ active: isItemActive(navItems[0]) }"
            :title="isSidebarCollapsed ? navItems[0].label : undefined"
            @click="handleNavClick(navItems[0])"
          >
            <div class="nav-icon-wrap">
              <component :is="navItems[0].icon" width="18" height="18" class="nav-icon" />
            </div>
            <MCollapse horizontal :open="!isSidebarCollapsed" class="nav-label-collapse">
              <span class="nav-label">{{ navItems[0].label }}</span>
            </MCollapse>
          </button>

          <!-- 2. 如何使用 -->
          <button
            class="nav-button"
            :class="{ active: isItemActive(navItems[1]) }"
            :title="isSidebarCollapsed ? navItems[1].label : undefined"
            @click="handleNavClick(navItems[1])"
          >
            <div class="nav-icon-wrap">
              <component :is="navItems[1].icon" width="18" height="18" class="nav-icon" />
            </div>
            <MCollapse horizontal :open="!isSidebarCollapsed" class="nav-label-collapse">
              <span class="nav-label">{{ navItems[1].label }}</span>
            </MCollapse>
          </button>

          <!-- 3. 知识库折叠组（无直达路由，点击展开/折叠分类与课程） -->
          <div class="kb-nav-group">
            <button
              class="nav-button kb-toggle-button"
              :class="{
                'is-open': isKbOpen && !isSidebarCollapsed,
                active: isKbActive
              }"
              :title="isSidebarCollapsed ? '知识库' : undefined"
              @click="handleKbClick"
            >
              <div class="nav-icon-wrap">
                <DatabaseSolid width="18" height="18" class="nav-icon" />
              </div>
              <MCollapse horizontal :open="!isSidebarCollapsed" class="nav-label-collapse">
                <div class="kb-label-group">
                  <span class="nav-label">知识库</span>
                  <div class="kb-chevron-wrap" :class="{ 'is-open': isKbOpen }">
                    <NavArrowRight width="13" height="13" class="kb-chevron-icon" />
                  </div>
                </div>
              </MCollapse>
            </button>

            <!-- 知识库展开子分类与课程树 (VS Code Explorer 树状目录风格) -->
            <MCollapse :open="isKbOpen && !isSidebarCollapsed">
              <div class="kb-tree-container">
                <div v-if="isLoadingCats" class="kb-loading font-mono">
                  LOADING CATEGORIES...
                </div>

                <div
                  v-for="cat in categories"
                  :key="cat.id"
                  class="kb-category-group"
                >
                  <!-- 大类条目（可点击折叠/展开当前大类） -->
                  <div
                    class="kb-category-row"
                    :class="{ 'is-open': expandedCategories.has(cat.id) }"
                    @click="toggleCategory(cat.id)"
                  >
                    <div class="kb-cat-chevron" :class="{ 'is-open': expandedCategories.has(cat.id) }">
                      <NavArrowRight width="11" height="11" class="kb-cat-chevron-icon" />
                    </div>
                    <span class="kb-cat-name">{{ cat.name }}</span>
                  </div>

                  <!-- 该大类下的课程列表 -->
                  <MCollapse :open="expandedCategories.has(cat.id)">
                    <div class="kb-course-list">
                      <div
                        v-for="course in cat.courses"
                        :key="course.id"
                        class="kb-course-row"
                        :class="{
                          'is-offline': !course.live,
                          active: isCourseActive(course.id)
                        }"
                        :title="getCourseTooltip(course)"
                        @click="selectCourse(course)"
                      >
                        <span class="course-name">{{ course.title }}</span>
                      </div>
                    </div>
                  </MCollapse>
                </div>
              </div>
            </MCollapse>
          </div>

          <!-- 4. 讲义推荐 -->
          <button
            class="nav-button"
            :class="{ active: isItemActive(navItems[2]) }"
            :title="isSidebarCollapsed ? navItems[2].label : undefined"
            @click="handleNavClick(navItems[2])"
          >
            <div class="nav-icon-wrap">
              <component :is="navItems[2].icon" width="18" height="18" class="nav-icon" />
            </div>
            <MCollapse horizontal :open="!isSidebarCollapsed" class="nav-label-collapse">
              <span class="nav-label">{{ navItems[2].label }}</span>
            </MCollapse>
          </button>

          <!-- 5. 我的讲义 -->
          <button
            class="nav-button"
            :class="{ active: isItemActive(navItems[3]) }"
            :title="isSidebarCollapsed ? navItems[3].label : undefined"
            @click="handleNavClick(navItems[3])"
          >
            <div class="nav-icon-wrap">
              <component :is="navItems[3].icon" width="18" height="18" class="nav-icon" />
            </div>
            <MCollapse horizontal :open="!isSidebarCollapsed" class="nav-label-collapse">
              <span class="nav-label">{{ navItems[3].label }}</span>
            </MCollapse>
          </button>

          <!-- 6. 讲义工作台 -->
          <button
            class="nav-button"
            :class="{ active: isItemActive(navItems[4]) }"
            :title="isSidebarCollapsed ? navItems[4].label : undefined"
            @click="handleNavClick(navItems[4])"
          >
            <div class="nav-icon-wrap">
              <component :is="navItems[4].icon" width="18" height="18" class="nav-icon" />
            </div>
            <MCollapse horizontal :open="!isSidebarCollapsed" class="nav-label-collapse">
              <span class="nav-label">{{ navItems[4].label }}</span>
            </MCollapse>
          </button>

          <!-- 7. 平台管理 -->
          <button
            v-if="isSuperAdmin"
            class="nav-button"
            :class="{ active: isItemActive(navItems[5]) }"
            :title="isSidebarCollapsed ? navItems[5].label : undefined"
            @click="handleNavClick(navItems[5])"
          >
            <div class="nav-icon-wrap">
              <component :is="navItems[5].icon" width="18" height="18" class="nav-icon" />
            </div>
            <MCollapse horizontal :open="!isSidebarCollapsed" class="nav-label-collapse">
              <span class="nav-label">{{ navItems[5].label }}</span>
            </MCollapse>
          </button>
        </nav>

        <MCollapse horizontal :open="!isSidebarCollapsed">
          <div class="sidebar-footer">
            <div class="palette-indicator">
              <span class="palette-box base"></span>
              <span class="palette-box surface"></span>
              <span class="palette-box elevated"></span>
              <span class="palette-box accent"></span>
            </div>
            <div class="footer-meta font-mono">SOLID ICONS / VUE_ROUTER</div>
          </div>
        </MCollapse>
      </aside>

      <!-- 工作视口 -->
      <main class="maki-viewport" :class="{ 'is-locked': isViewportLocked }">
        <!-- 视图顶端状态与上下文条 -->
        <ViewportHeader
          v-if="showViewportHeader"
          :title="currentCourse ? currentCourse.title : currentItem.label"
          :breadcrumbs="currentBreadcrumbs"
          @refresh="handleRefreshDoc"
        />

        <!-- 页面视图内容插槽 -->
        <slot :current-item="currentItem">
          <router-view :key="docRefreshKey" />
        </slot>
      </main>
    </div>

    <!-- 全局轻量浮动通知组件 -->
    <MNotice />

    <!-- 全局用户详情与安全设置弹窗 -->
    <MUserModal
      :open="isUserModalOpen"
      :user="currentUser"
      @close="closeUserModal"
    />
  </div>
</template>

<style scoped>
/* 应用全局布局 */
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

/* 顶栏搜索栏 */
/* 顶栏搜索栏淡入淡出 */
.topbar-center {
  flex: 1;
  max-width: 500px;
  margin: 0 20px;
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1), transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 1;
  transform: translateY(0);
}

.topbar-center.is-hidden-on-start {
  opacity: 0;
  transform: translateY(-4px);
  pointer-events: none;
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
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  background-color: transparent;
  border: none;
  transition: background-color 140ms ease, color 140ms ease;
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
  min-width: var(--sidebar-min-width, 220px);
  max-width: var(--sidebar-max-width, 420px);
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  z-index: 40;
  transition: width 160ms cubic-bezier(0.2, 0, 0, 1), min-width 160ms cubic-bezier(0.2, 0, 0, 1), max-width 160ms cubic-bezier(0.2, 0, 0, 1);
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
  border-radius: var(--radius-xs);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
}

.sidebar-header.is-collapsed .sidebar-collapse-btn {
  margin: 0 auto;
}

.sidebar-collapse-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-subtle);
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

.maki-sidebar.is-collapsed .sidebar-nav {
  padding: 0;
  width: 100%;
  align-items: center;
}

.maki-sidebar.is-collapsed .kb-nav-group {
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
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 140ms ease, color 140ms ease;
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
  border-radius: 0 2px 2px 0;
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

.kb-label-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

/* 知识库折叠组 */
.kb-nav-group {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.kb-toggle-button {
  user-select: none;
}

.kb-chevron-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  width: 16px;
  height: 16px;
}

.kb-chevron-icon,
.kb-cat-chevron-icon {
  display: block;
  transform-origin: center;
  transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
}

.kb-chevron-wrap.is-open .kb-chevron-icon,
.kb-cat-chevron.is-open .kb-cat-chevron-icon {
  transform: rotate(90deg);
}

.kb-tree-container {
  display: flex;
  flex-direction: column;
  margin: 2px 0 6px 14px;
  padding-left: 10px;
  border-left: 1px solid var(--border-subtle);
  gap: 2px;
}

.kb-loading {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  padding: 6px 8px;
}

.kb-category-group {
  display: flex;
  flex-direction: column;
}

.kb-category-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  user-select: none;
  color: var(--text-muted);
  transition: background-color 120ms ease, color 120ms ease;
}

.kb-category-row:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.kb-cat-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  width: 12px;
  flex-shrink: 0;
}

.kb-cat-name {
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-medium);
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kb-course-list {
  display: flex;
  flex-direction: column;
  margin-left: 14px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.04);
  gap: 1px;
}

.kb-course-row {
  display: flex;
  align-items: center;
  height: 27px;
  padding: 0 8px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.kb-course-row:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.kb-course-row.is-offline {
  opacity: 0.45;
  cursor: default;
}

.kb-course-row.active {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.kb-course-row.active .course-name {
  color: var(--accent-primary);
}

.course-name {
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.palette-indicator {
  display: flex;
  gap: 6px;
}

.palette-box {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-xs);
}

.palette-box.base { background-color: var(--bg-topbar); }
.palette-box.surface { background-color: var(--bg-sidebar); }
.palette-box.elevated { background-color: var(--bg-surface); }
.palette-box.accent { background-color: var(--accent-primary); }

.footer-meta {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  letter-spacing: 0.5px;
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
