import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { invalidateCourseRequests, toChapters } from '../api/courses.js';
import { notify } from '../components/feedback/MNotice.vue';
import { workbenchPanelState } from '../composables/useWorkbenchGuard.js';
import {
  authStatus,
  currentUser,
  initAuth,
  isLoggedIn,
  isSuperAdmin,
  logout
} from '../utils/auth.js';
import { lectureLocation, lectureNavigationOrigin } from '../utils/lecture-route.js';
import {
  beginNavigation,
  endNavigation,
  registerProgressBar,
  startProgress
} from '../utils/progress.js';
import { fetchShelfLectureTree } from '../utils/shelf-lecture.js';

// 基础页面导航项配置
export const navItems = [
  {
    id: 'my-lecture',
    label: '我的书架',
    path: '/my-lecture',
    tag: 'LOCAL',
    group: 'primary'
  },
  {
    id: 'knowledge',
    label: '知识库',
    path: '/knowledge',
    tag: 'KNOWLEDGE',
    group: 'library'
  },
  {
    id: 'question-bank',
    label: '题库',
    path: '/question-bank',
    tag: 'QUESTIONS',
    group: 'library'
  },
  {
    id: 'mistake-book',
    label: '错题本',
    path: '/mistake-book',
    tag: 'MISTAKES',
    group: 'primary',
    sidebarHidden: true
  },
  {
    id: 'recom-lecture',
    label: '图书推荐',
    path: '/recom-lecture',
    tag: 'HOT',
    group: 'reader'
  },
  {
    id: 'resource-center',
    label: '资源中心',
    path: '/resource-center',
    tag: 'RESOURCES',
    group: 'reader'
  },
  {
    id: 'knowledge-workbench',
    label: '知识库工作台',
    path: '/knowledge-workbench',
    tag: 'WORKBENCH',
    group: 'management',
    desktopOnly: true,
    adminOnly: true
  },
  {
    id: 'question-workbench',
    label: '题库工作台',
    path: '/question-workbench',
    tag: 'WORKBENCH',
    group: 'management',
    desktopOnly: true,
    adminOnly: true
  },
  {
    id: 'book-workbench',
    label: '图书工作台',
    path: '/book-workbench',
    tag: 'WORKBENCH',
    group: 'management',
    desktopOnly: true
  },
  {
    id: 'platform',
    label: '平台管理',
    path: '/platform',
    tag: 'PLATFORM',
    group: 'platform',
    desktopOnly: true,
    adminOnly: true
  }
];

export function useLayoutState() {
  const route = useRoute();
  const router = useRouter();
  let removeBeforeHook;
  let removeAfterHook;
  const progressBarRef = ref(null);
  const navigationGroups = computed(() => {
    const visible = navItems.filter(
      (item) => !item.sidebarHidden && (!item.adminOnly || isSuperAdmin.value)
    );
    return ['primary', 'reader', 'library', 'management', 'platform']
      .map((group) => visible.filter((item) => item.group === group))
      .filter((group) => group.length);
  });

  // 监听移动端断点
  const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const updateBreakpoint = () => {
    if (typeof window !== 'undefined') {
      if (
        ['book-workbench', 'knowledge-workbench'].includes(route.name) &&
        (workbenchPanelState.value.dirty || workbenchPanelState.value.saving)
      ) {
        return;
      }
      isMobile.value = window.innerWidth < 768;
    }
  };
  watch(workbenchPanelState, updateBreakpoint);
  watch(() => route.name, updateBreakpoint);

  // 切换主题
  const currentTheme = ref('dark');
  const themes = new Set(['dark', 'light', 'spring', 'summer', 'autumn', 'winter']);
  const isDark = computed(() => ['dark', 'winter'].includes(currentTheme.value));

  const applyTheme = (value) => {
    const selected = themes.has(value) ? value : 'dark';
    currentTheme.value = selected;
    document.documentElement.setAttribute(
      'data-theme',
      ['dark', 'winter'].includes(selected) ? 'dark' : 'light'
    );
    if (['spring', 'summer', 'autumn', 'winter'].includes(selected)) {
      document.documentElement.setAttribute('data-season', selected);
    } else {
      document.documentElement.removeAttribute('data-season');
    }
  };

  const initTheme = () => {
    try {
      applyTheme(localStorage.getItem('maki-theme'));
    } catch {
      applyTheme('dark');
    }
  };

  const setTheme = (value) => {
    if (!themes.has(value)) {
      return;
    }
    applyTheme(value);
    try {
      localStorage.setItem('maki-theme', value);
    } catch {
      // 存储不可用时仍保留当前页面的主题。
    }
  };

  const syncTheme = (event) => {
    if (event.key === 'maki-theme') {
      applyTheme(event.newValue);
    }
  };

  // 管理用户弹窗
  const userDisplayName = computed(() => {
    return (
      currentUser.value?.displayName ||
      currentUser.value?.display_name ||
      currentUser.value?.username ||
      ''
    );
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
    if (['book-workbench', 'knowledge-workbench'].includes(route.name)) {
      const result = await router.push('/my-lecture');
      if (result) {
        return;
      }
    }
    isUserModalOpen.value = false;
    try {
      const revoked = await logout();
      notify(
        revoked ? '已退出登录' : '已在本地退出，服务端会话状态未确认',
        revoked ? 'info' : 'warn'
      );
    } catch {
      notify('已在本地退出，服务端会话撤销失败', 'warn');
    }
    if (route.path === '/platform') {
      router.push('/my-lecture');
    }
  };

  // 计算导航状态
  const currentItem = computed(() => {
    const match = navItems.find((item) => item.path === route.path);
    if (match) {
      return match;
    }

    return {
      id: route.name || 'custom',
      label: route.meta?.title || '页面',
      path: route.path,
      tag: route.meta?.tag || 'VIEW'
    };
  });

  const layoutLecture = ref(null);
  const layoutChapters = ref([]);
  const currentLecture = computed(() => (route.params.lectureSlug ? layoutLecture.value : null));

  watch(
    () => [
      route.params.lectureSlug,
      route.name,
      route.query.revision_id,
      currentUser.value?.id,
      authStatus.value
    ],
    async ([lectureId, name, revisionId], oldValue, onCleanup) => {
      let active = true;
      onCleanup(() => {
        active = false;
      });
      layoutLecture.value = null;
      layoutChapters.value = [];
      if (
        !lectureId ||
        ![
          'lecture-doc',
          'lecture-home',
          'local-lecture-doc',
          'local-lecture-home',
          'workbook-home',
          'local-workbook-home'
        ].includes(name)
      ) {
        return;
      }
      try {
        const source = name.startsWith('local-') ? 'local' : 'online';
        const tree = await fetchShelfLectureTree(lectureId, source, revisionId || '');
        if (active) {
          layoutLecture.value = {
            id: tree.id,
            title: tree.title,
            kind: tree.kind
          };
          layoutChapters.value = toChapters(tree);
        }
      } catch {
        if (active) {
          layoutLecture.value = null;
          layoutChapters.value = [];
        }
      }
    },
    {
      immediate: true
    }
  );

  const lectureOrigin = ref(lectureNavigationOrigin());
  const resourceBreadcrumbs = ref([]);
  const currentBreadcrumbs = computed(() => {
    if (route.name === 'resource-center') {
      return [
        {
          label: 'APP',
          to: '/my-lecture'
        },
        ...resourceBreadcrumbs.value
      ];
    }
    const origins = {
      'recom-lecture': {
        label: '图书推荐',
        to: '/recom-lecture'
      },
      'my-lecture': {
        label: '我的书架',
        to: '/my-lecture'
      },
      'platform-reviews': {
        label: '内容审核',
        to: {
          path: '/platform',
          query: {
            tab: 'reviews'
          }
        }
      }
    };
    const origin = origins[lectureOrigin.value];
    const isReading = route.name === 'lecture-doc' || route.name === 'local-lecture-doc';
    const prefix = [
      {
        label: 'APP',
        to: '/my-lecture'
      }
    ];
    if (origin) {
      prefix.push(origin);
    }
    prefix.push(
      isReading
        ? {
            label: layoutLecture.value?.kind === 'workbook' ? '题目册详情' : '课程讲义详情',
            to: lectureLocation({
              slug: route.params.lectureSlug,
              kind: layoutLecture.value?.kind,
              source: route.name === 'local-lecture-doc' ? 'local' : 'online',
              revisionId: route.query.revision_id,
              origin: lectureOrigin.value
            })
          }
        : {
            label:
              route.name === 'workbook-home' || route.name === 'local-workbook-home'
                ? '题目册详情'
                : '课程讲义详情'
          }
    );
    if (route.name === 'lecture-doc' || route.name === 'local-lecture-doc') {
      const chapters = layoutChapters.value;
      const chapterSlug = String(route.params.chapterSlug || '');
      const sectionSlug = String(route.params.sectionSlug || '');

      let chapterName = '';
      let sectionName = '';

      for (const chap of chapters) {
        const sec =
          chap.slug === chapterSlug ? chap.sections?.find((s) => s.slug === sectionSlug) : null;
        if (sec) {
          chapterName = chap.title;
          sectionName = sec.title;
          break;
        }
      }

      if (!sectionName && !sectionSlug && chapters.length > 0) {
        const firstChap = chapters[0];
        chapterName = firstChap.title;
        sectionName = firstChap.sections?.[0]?.title || '讲义阅读';
      }

      const crumbs = [...prefix];
      if (chapterName) {
        crumbs.push(chapterName);
      }
      if (sectionName) {
        crumbs.push(sectionName);
      } else {
        crumbs.push('讲义阅读');
      }
      return crumbs;
    }
    if (
      ['lecture-home', 'local-lecture-home', 'workbook-home', 'local-workbook-home'].includes(
        route.name
      )
    ) {
      return prefix;
    }
    return [
      {
        label: 'APP',
        to: '/my-lecture'
      },
      {
        label: currentItem.value.label
      }
    ];
  });

  const showViewportHeader = computed(() => {
    return (
      route.name !== 'knowledge-library' &&
      route.name !== 'knowledge-workbench' &&
      route.name !== 'question-workbench' &&
      route.name !== 'book-workbench' &&
      route.name !== 'platform' &&
      route.path !== '/platform'
    );
  });

  const isViewportLocked = computed(() => {
    return (
      route.name === 'book-workbench' ||
      route.name === 'platform' ||
      route.path === '/platform' ||
      route.name === 'my-lecture' ||
      route.path === '/my-lecture'
    );
  });

  const isItemActive = (item) =>
    route.path === item.path || (item.id === 'knowledge' && route.name === 'knowledge');

  const navigateTo = (targetPath) => {
    if (route.path === targetPath) {
      return;
    }
    router.push(targetPath);
  };

  // 刷新讲义内容
  const docRefreshKey = ref(0);
  const handleRefreshDoc = () => {
    invalidateCourseRequests();
    startProgress();
    docRefreshKey.value++;
  };

  // 挂载生命周期
  onMounted(() => {
    initTheme();
    initAuth();
    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    window.addEventListener('storage', syncTheme);

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
      if (!failure) {
        lectureOrigin.value = lectureNavigationOrigin();
      }
    });
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateBreakpoint);
    window.removeEventListener('storage', syncTheme);
    removeBeforeHook?.();
    removeAfterHook?.();
    registerProgressBar(null);
  });

  return {
    route,
    router,
    isMobile,
    progressBarRef,
    isDark,
    currentTheme,
    setTheme,
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
    currentLecture,
    layoutChapters,
    currentBreadcrumbs,
    resourceBreadcrumbs,
    showViewportHeader,
    isViewportLocked,
    isItemActive,
    navigateTo,
    docRefreshKey,
    handleRefreshDoc
  };
}
