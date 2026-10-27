import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCourseCategories, getCourseChapters, getCachedCourseChapters, invalidateCourseCaches } from '../api';
import {
  registerProgressBar,
  beginNavigation,
  endNavigation,
  startProgress,
  currentUser,
  isLoggedIn,
  isSuperAdmin,
  logout,
  initAuth
} from '../utils';
import { notify } from '../components/MNotice.vue';
import { workbenchPanelState } from '../utils/workbench-state.js';
import {
  PlaySolid,
  DatabaseSolid,
  StarSolid,
  BookmarkSolid,
  FlaskSolid,
  CubeScanSolid
} from '@iconoir/vue';

// 基础页面导航项配置
export const navItems = [
  { id: 'start', label: '开始', path: '/start', icon: PlaySolid, tag: 'INIT', group: 'primary' },
  { id: 'knowledge', label: '知识库', path: '/knowledge', icon: DatabaseSolid, tag: 'KNOWLEDGE', group: 'primary' },
  { id: 'recom-lecture', label: '讲义推荐', path: '/recom-lecture', icon: StarSolid, tag: 'HOT', group: 'reader' },
  { id: 'my-lecture', label: '我的讲义', path: '/my-lecture', icon: BookmarkSolid, tag: 'LOCAL', group: 'reader' },
  { id: 'knowledge-workbench', label: '知识点工作台', path: '/knowledge-workbench', icon: FlaskSolid, tag: 'WORKBENCH', group: 'management', desktopOnly: true, adminOnly: true },
  { id: 'lecture-workbench', label: '讲义工作台', path: '/lecture-workbench', icon: FlaskSolid, tag: 'WORKBENCH', group: 'management', desktopOnly: true },
  { id: 'platform', label: '平台管理', path: '/platform', icon: CubeScanSolid, tag: 'PLATFORM', group: 'management', desktopOnly: true, adminOnly: true },
];

export function useLayoutState() {
  const route = useRoute();
  const router = useRouter();
  let removeBeforeHook;
  let removeAfterHook;
  const progressBarRef = ref(null);
  const navigationGroups = computed(() => {
    const visible = navItems.filter((item) => !item.adminOnly || isSuperAdmin.value);
    return ['primary', 'reader', 'management'].map((group) => visible.filter((item) => item.group === group));
  });

  // 1. 移动端断点响应式监听 (<768px 为手机端)
  const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const updateBreakpoint = () => {
    if (typeof window !== 'undefined') {
      if (['lecture-workbench', 'knowledge-workbench'].includes(route.name) && (workbenchPanelState.value.dirty || workbenchPanelState.value.saving)) return;
      isMobile.value = window.innerWidth < 768;
    }
  };
  watch(workbenchPanelState, updateBreakpoint);
  watch(() => route.name, updateBreakpoint);

  // 2. 主题模式控制
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

  // 3. 知识库分类数据
  const categories = ref([]);

  const loadCategories = async () => {
    categories.value = await getCourseCategories();
  };

  // 4. 用户信息与弹窗状态
  const userDisplayName = computed(() => {
    return currentUser.value?.displayName || currentUser.value?.display_name || currentUser.value?.username || '';
  });

  const isUserModalOpen = ref(false);
  const userModalMode = ref('login');
  const isHelpModalOpen = ref(false);

  const openHelpModal = () => {
    isHelpModalOpen.value = true;
  };

  const closeHelpModal = () => {
    isHelpModalOpen.value = false;
  };

  const openUserModal = () => {
    userModalMode.value = isLoggedIn.value ? 'profile' : 'login';
    isUserModalOpen.value = true;
  };

  const closeUserModal = () => {
    isUserModalOpen.value = false;
  };

  const handleLogout = async () => {
    if (route.name === 'lecture-workbench') {
      const result = await router.push('/start');
      if (result) return;
    }
    isUserModalOpen.value = false;
    try {
      const revoked = await logout();
      notify(revoked ? '已退出登录' : '已在本地退出，服务端会话状态未确认', revoked ? 'info' : 'warn');
    } catch {
      notify('已在本地退出，服务端会话撤销失败', 'warn');
    }
    if (route.path === '/platform') {
      router.push('/start');
    }
  };

  // 5. 导航状态与计算属性
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

  const currentCourse = computed(() => {
    const courseId = route.params.courseId;
    if (!courseId) return null;
    for (const cat of categories.value) {
      const found = cat.courses?.find(c => c.id === courseId || c.slug === courseId);
      if (found) return { ...found, categoryName: cat.name };
    }
    return null;
  });

  const layoutChapters = ref([]);

  watch(
    () => [route.params.courseId, route.name],
    async ([courseId, name], oldValue, onCleanup) => {
      let active = true;
      onCleanup(() => { active = false; });
      if (name === 'lecture-doc' || name === 'course-home' || courseId) {
        try {
          const chapters = await getCourseChapters(courseId);
          if (active) layoutChapters.value = chapters;
        } catch (e) {
          if (active) layoutChapters.value = [];
        }
      } else {
        layoutChapters.value = [];
      }
    },
    { immediate: true }
  );

  const currentBreadcrumbs = computed(() => {
    if (route.name === 'lecture-doc') {
      const courseId = route.params.courseId;
      const courseTitle = currentCourse.value?.title || courseId;
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

      const crumbs = ['APP', '讲义', courseTitle];
      if (chapterName) crumbs.push(chapterName);
      if (sectionName) crumbs.push(sectionName);
      return crumbs;
    }
    if (route.name === 'course-home' || route.params.courseId) {
      const courseTitle = currentCourse.value?.title || route.params.courseId || '课程';
      return ['APP', '讲义', courseTitle];
    }
    return ['APP', currentItem.value.label];
  });

  const showViewportHeader = computed(() => {
    return (
      route.path !== '/start' &&
      route.name !== 'start' &&
      route.name !== 'knowledge-library' &&
      route.name !== 'knowledge-workbench' &&
      route.name !== 'lecture-workbench' &&
      route.name !== 'platform' &&
      route.path !== '/platform'
    );
  });

  const isViewportLocked = computed(() => {
    return (
      route.name === 'lecture-workbench' ||
      route.name === 'platform' ||
      route.path === '/platform' ||
      route.name === 'start' ||
      route.path === '/start' ||
      route.name === 'my-lecture' ||
      route.path === '/my-lecture'
    );
  });

  const isStartRoute = computed(() => route.path === '/start' || route.name === 'start');

  const isItemActive = (item) => route.path === item.path || (item.id === 'knowledge' && route.name === 'knowledge');

  const navigateTo = (targetPath) => {
    if (route.path === targetPath) return;
    router.push(targetPath);
  };

  // 6. 讲义刷新 Key 控制
  const docRefreshKey = ref(0);
  const handleRefreshDoc = () => {
    invalidateCourseCaches();
    startProgress();
    docRefreshKey.value++;
  };

  // 挂载生命周期
  onMounted(() => {
    initTheme();
    initAuth();
    loadCategories();
    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);

    if (progressBarRef.value) {
      registerProgressBar(progressBarRef.value);
    }

    removeBeforeHook = router.beforeEach((to, from, next) => {
      isUserModalOpen.value = false;
      isHelpModalOpen.value = false;
      if (to.path !== from.path) {
        beginNavigation();
      }
      next();
    });

    removeAfterHook = router.afterEach((to, from, failure) => {
      endNavigation();
      if (!failure && ['lecture-workbench', 'platform'].includes(from.name)) loadCategories();
    });
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateBreakpoint);
    removeBeforeHook?.();
    removeAfterHook?.();
  });

  return {
    route,
    router,
    isMobile,
    progressBarRef,
    isDark,
    toggleTheme,
    categories,
    loadCategories,
    currentUser,
    isLoggedIn,
    isSuperAdmin,
    userDisplayName,
    isUserModalOpen,
    userModalMode,
    isHelpModalOpen,
    openHelpModal,
    closeHelpModal,
    openUserModal,
    closeUserModal,
    handleLogout,
    navItems,
    navigationGroups,
    currentItem,
    currentCourse,
    layoutChapters,
    currentBreadcrumbs,
    showViewportHeader,
    isViewportLocked,
    isStartRoute,
    isItemActive,
    navigateTo,
    docRefreshKey,
    handleRefreshDoc
  };
}
