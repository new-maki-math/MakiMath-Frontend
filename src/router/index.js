import { createRouter, createWebHistory } from 'vue-router';

import { initAuth } from '../utils/auth.js';

// 页面视图
const RecomLectureView = () => import('../views/recom-lecture/RecomLectureView.vue');
const ResourceCenterView = () => import('../views/resource-center/ResourceCenterPage.vue');
const MyLectureView = () => import('../views/my-lecture/MyLectureView.vue');
const LectureHomeView = () => import('../views/lecture-home/LectureHomeView.vue');
const LectureDocView = () => import('../views/lecture-doc/LectureDocView.vue');
const KnowledgeView = () => import('../views/knowledge/KnowledgeView.vue');
const QuestionBankView = () => import('../views/question-bank/QuestionBankView.vue');
const QuestionBankDemoView = () => import('../views/my-question-bank/QuestionBankDemoView.vue');
const WorkbookHomeView = () => import('../views/my-question-bank/WorkbookHomeView.vue');
const MistakeBookView = () => import('../views/mistake-book/MistakeBookView.vue');
const KnowledgeLibrary = () => import('../views/knowledge/KnowledgeLibrary.vue');
const BookWorkbenchView = () => import('../views/book-workbench/BookWorkbench.vue');
const KnowledgeWorkbenchView = () => import('../views/knowledge-workbench/KnowledgeWorkbench.vue');
const QuestionWorkbenchView = () => import('../views/question-workbench/QuestionWorkbench.vue');
const PlatformView = () => import('../views/platform/PlatformView.vue');

export const routes = [
  {
    path: '/',
    redirect: '/my-lecture'
  },
  {
    path: '/how-to-use',
    redirect: '/my-lecture'
  },
  {
    path: '/workbook/online/:lectureSlug',
    name: 'workbook-home',
    component: WorkbookHomeView,
    meta: { title: '题目册详情', tag: 'WORKBOOK' }
  },
  {
    path: '/workbook/local/:lectureSlug',
    name: 'local-workbook-home',
    component: WorkbookHomeView,
    meta: { title: '题目册详情', tag: 'WORKBOOK' }
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
    path: '/question-bank',
    name: 'question-bank',
    component: QuestionBankView,
    meta: {
      title: '题库',
      tag: 'QUESTIONS'
    }
  },
  {
    path: '/question-bank/demo',
    name: 'question-bank-demo',
    component: QuestionBankDemoView,
    meta: {
      title: '题库详情',
      tag: 'QUESTIONS'
    }
  },
  {
    path: '/mistake-book',
    name: 'mistake-book',
    component: MistakeBookView,
    meta: {
      title: '错题本',
      tag: 'MISTAKES'
    }
  },
  {
    path: '/recom-lecture',
    name: 'recom-lecture',
    component: RecomLectureView,
    meta: {
      title: '图书推荐',
      tag: 'HOT'
    }
  },
  {
    path: '/resource-center',
    name: 'resource-center',
    component: ResourceCenterView,
    meta: {
      title: '资源中心',
      tag: 'RESOURCES'
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
      title: '知识库工作台',
      tag: 'WORKBENCH'
    }
  },
  {
    path: '/question-workbench',
    name: 'question-workbench',
    component: QuestionWorkbenchView,
    meta: {
      title: '题库工作台',
      tag: 'WORKBENCH'
    }
  },
  {
    path: '/workbench',
    redirect: '/book-workbench'
  },
  {
    path: '/book-workbench',
    name: 'book-workbench',
    component: BookWorkbenchView,
    meta: {
      title: '图书工作台',
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
