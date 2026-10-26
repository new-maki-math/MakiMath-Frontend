import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
import {
  PlaySolid,
  HelpCircleSolid,
  StarSolid,
  BookmarkSolid,
  FlaskSolid,
  CubeScanSolid
} from '@iconoir/vue';

// 基础页面导航项配置
export const navItems = [
  { id: 'start', label: '开始', path: '/start', icon: PlaySolid, tag: 'INIT' },
  { id: 'how-to-use', label: '如何使用', path: '/how-to-use', icon: HelpCircleSolid, tag: 'DOCS' },
  { id: 'recom-lecture', label: '讲义推荐', path: '/recom-lecture', icon: StarSolid, tag: 'HOT' },
  { id: 'my-lecture', label: '我的讲义', path: '/my-lecture', icon: BookmarkSolid, tag: 'LOCAL' },
  { id: 'workbench', label: '讲义工作台', path: '/workbench', icon: FlaskSolid, tag: 'WORKBENCH' },
  { id: 'platform', label: '平台管理', path: '/platform', icon: CubeScanSolid, tag: 'PLATFORM' },
];

export function useLayoutState() {
  const route = useRoute();
  const router = useRouter();
  const progressBarRef = ref(null);

  // 1. 移动端断点响应式监听 (<768px 为手机端)
  const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const updateBreakpoint = () => {
    if (typeof window !== 'undefined') {
      isMobile.value = window.innerWidth < 768;
    }
  };

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
  const isLoadingCats = ref(false);
  const expandedCategories = ref(new Set());

  const toggleCategory = (catId) => {
    if (expandedCategories.value.has(catId)) {
      expandedCategories.value.delete(catId);
    } else {
      expandedCategories.value.add(catId);
    }
  };

  const getCourseTooltip = (course) => {
    const desc = course.desc || course.title;
    return !course.live ? `[筹划中] ${desc}` : desc;
  };

  const loadCategories = async () => {
    isLoadingCats.value = true;
    try {
      const rawCats = await getCourseCategories();
      const transformed = transformCourseCategories(rawCats);
      categories.value = transformed;
      expandedCategories.value = new Set(transformed.map(c => c.id));
    } finally {
      isLoadingCats.value = false;
    }
  };

  // 4. 用户信息与弹窗状态
  const userDisplayName = computed(() => {
    return currentUser.value?.displayName || currentUser.value?.display_name || currentUser.value?.username || '';
  });

  const isUserModalOpen = ref(false);

  const openUserModal = () => {
    isUserModalOpen.value = true;
  };

  const closeUserModal = () => {
    isUserModalOpen.value = false;
  };

  const handleLogout = () => {
    isUserModalOpen.value = false;
    clearAuth();
    notify('已退出登录', 'info');
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
      const found = cat.courses?.find(c => c.id === courseId);
      if (found) return { ...found, categoryName: cat.name };
    }
    return null;
  });

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

  const showViewportHeader = computed(() => {
    return (
      route.path !== '/start' &&
      route.name !== 'start' &&
      route.name !== 'workbench' &&
      route.name !== 'platform' &&
      route.path !== '/platform'
    );
  });

  const isViewportLocked = computed(() => {
    return (
      route.name === 'workbench' ||
      route.name === 'platform' ||
      route.path === '/platform' ||
      route.name === 'start' ||
      route.path === '/start' ||
      route.name === 'my-lecture' ||
      route.path === '/my-lecture'
    );
  });

  const isStartRoute = computed(() => route.path === '/start' || route.name === 'start');

  const isKbActive = computed(() => {
    return (
      route.name === 'course-home' ||
      route.name === 'lecture-doc' ||
      route.path.startsWith('/course/')
    );
  });

  const isItemActive = (item) => route.path === item.path;

  const isCourseActive = (courseId) => {
    return (
      (route.name === 'course-home' || route.name === 'lecture-doc' || route.path.startsWith('/course/')) &&
      route.params.courseId === courseId
    );
  };

  const navigateTo = (targetPath) => {
    if (route.path === targetPath) return;
    router.push(targetPath);
  };

  const selectCourse = (course) => {
    navigateTo(`/course/${course.id}`);
  };

  // 6. 讲义刷新 Key 控制
  const docRefreshKey = ref(0);
  const handleRefreshDoc = () => {
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

  onUnmounted(() => {
    window.removeEventListener('resize', updateBreakpoint);
  });

  return {
    route,
    router,
    isMobile,
    progressBarRef,
    isDark,
    toggleTheme,
    categories,
    isLoadingCats,
    expandedCategories,
    toggleCategory,
    getCourseTooltip,
    loadCategories,
    currentUser,
    isLoggedIn,
    isSuperAdmin,
    userDisplayName,
    isUserModalOpen,
    openUserModal,
    closeUserModal,
    handleLogout,
    navItems,
    currentItem,
    currentCourse,
    layoutChapters,
    currentBreadcrumbs,
    showViewportHeader,
    isViewportLocked,
    isStartRoute,
    isKbActive,
    isItemActive,
    isCourseActive,
    navigateTo,
    selectCourse,
    docRefreshKey,
    handleRefreshDoc
  };
}
