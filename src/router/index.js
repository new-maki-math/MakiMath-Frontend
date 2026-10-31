import { createRouter, createWebHistory } from 'vue-router';

import { initAuth } from '../utils/auth.js';

// 页面视图
const StartView = () => import('../views/start/StartView.vue');
const RecomLectureView = () => import('../views/recom-lecture/RecomLectureView.vue');
const MyLectureView = () => import('../views/my-lecture/MyLectureView.vue');
const LectureHomeView = () => import('../views/lecture-home/LectureHomeView.vue');
const LectureDocView = () => import('../views/lecture-doc/LectureDocView.vue');
const KnowledgeView = () => import('../views/knowledge/KnowledgeView.vue');
const KnowledgeLibrary = () => import('../views/knowledge/KnowledgeLibrary.vue');
const WorkbenchView = () => import('../views/lecture-workbench/LectureWorkbench.vue');
const KnowledgeWorkbenchView = () => import('../views/knowledge-workbench/KnowledgeWorkbench.vue');
const PlatformView = () => import('../views/platform/PlatformView.vue');

export const routes = [
  {
    path: '/',
    redirect: '/start'
  },
  {
    path: '/start',
    name: 'start',
    component: StartView,
    meta: {
      title: '开始',
      tag: 'INIT'
    }
  },
  {
    path: '/how-to-use',
    redirect: '/start'
  },
  {
    path: '/lecture/online/:lectureSlug',
    name: 'lecture-home',
    component: LectureHomeView,
    meta: {
      title: '讲义',
      tag: 'LECTURE'
    }
  },
  {
    path: '/lecture/online/:lectureSlug/doc/:chapterSlug/:sectionSlug',
    name: 'lecture-doc',
    component: LectureDocView,
    meta: {
      title: '讲义阅读',
      tag: 'DOC'
    }
  },
  {
    path: '/lecture/local/:lectureSlug',
    name: 'local-lecture-home',
    component: LectureHomeView,
    meta: {
      title: '讲义',
      tag: 'LECTURE'
    }
  },
  {
    path: '/lecture/local/:lectureSlug/doc/:chapterSlug/:sectionSlug',
    name: 'local-lecture-doc',
    component: LectureDocView,
    meta: {
      title: '讲义阅读',
      tag: 'DOC'
    }
  },
  {
    path: '/knowledge',
    name: 'knowledge-library',
    component: KnowledgeLibrary,
    meta: {
      title: '知识库',
      tag: 'KNOWLEDGE'
    }
  },
  {
    path: '/knowledge/:knowledgeId',
    name: 'knowledge',
    component: KnowledgeView,
    meta: {
      title: '知识点',
      tag: 'KNOWLEDGE'
    }
  },
  {
    path: '/recom-lecture',
    name: 'recom-lecture',
    component: RecomLectureView,
    meta: {
      title: '创意工坊',
      tag: 'HOT'
    }
  },
  {
    path: '/my-lecture',
    name: 'my-lecture',
    component: MyLectureView,
    meta: {
      title: '我的书架',
      tag: 'LOCAL'
    }
  },
  {
    path: '/knowledge-workbench',
    name: 'knowledge-workbench',
    component: KnowledgeWorkbenchView,
    meta: {
      title: '知识点工作台',
      tag: 'WORKBENCH'
    }
  },
  {
    path: '/workbench',
    redirect: '/lecture-workbench'
  },
  {
    path: '/lecture-workbench',
    name: 'lecture-workbench',
    component: WorkbenchView,
    meta: {
      title: '讲义工作台',
      tag: 'WORKBENCH'
    }
  },
  {
    path: '/platform',
    name: 'platform',
    component: PlatformView,
    meta: {
      title: '平台管理',
      tag: 'PLATFORM'
    }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 路由守卫加载认证状态
router.beforeEach(async (to) => {
  if (to.name === 'platform' || to.path === '/platform') {
    await initAuth();
  }
});

export default router;
