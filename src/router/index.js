import { createRouter, createWebHistory } from 'vue-router';
import { isSuperAdmin, initAuth } from '../utils/auth.js';

// 页面视图
const StartView = () => import('../views/start/start.vue');
const HowToUseView = () => import('../views/how-to-use/how-to-use.vue');
const RecomLectureView = () => import('../views/recom-lecture/recom-lecture.vue');
const MyLectureView = () => import('../views/my-lecture/my-lecture.vue');
const CourseHomeView = () => import('../views/course-home/course-home.vue');
const LectureDocView = () => import('../views/lecture-doc/lecture-doc.vue');
const WorkbenchView = () => import('../views/workbench/workbench.vue');
const PlatformView = () => import('../views/platform/platform.vue');

export const routes = [
  {
    path: '/',
    redirect: '/start'
  },
  {
    path: '/start',
    name: 'start',
    component: StartView,
    meta: { title: '开始', tag: 'INIT' }
  },
  {
    path: '/how-to-use',
    name: 'how-to-use',
    component: HowToUseView,
    meta: { title: '如何使用', tag: 'DOCS' }
  },
  {
    path: '/course/:courseId',
    name: 'course-home',
    component: CourseHomeView,
    meta: { title: '课程', tag: 'COURSE' }
  },
  {
    path: '/course/:courseId/doc/:sectionId?',
    name: 'lecture-doc',
    component: LectureDocView,
    meta: { title: '讲义阅读', tag: 'DOC' }
  },
  {
    path: '/recom-lecture',
    name: 'recom-lecture',
    component: RecomLectureView,
    meta: { title: '讲义推荐', tag: 'HOT' }
  },
  {
    path: '/my-lecture',
    name: 'my-lecture',
    component: MyLectureView,
    meta: { title: '我的讲义', tag: 'LOCAL' }
  },
  {
    path: '/workbench',
    name: 'workbench',
    component: WorkbenchView,
    meta: { title: '讲义工作台', tag: 'WORKBENCH' }
  },
  {
    path: '/platform',
    name: 'platform',
    component: PlatformView,
    meta: { title: '平台管理', tag: 'PLATFORM' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 平台管理权限守卫：仅登录且为超级管理员可访问
router.beforeEach(async (to, from, next) => {
  if (to.name === 'platform' || to.path === '/platform') {
    await initAuth();
    if (!isSuperAdmin.value) {
      return next({ path: '/workbench' });
    }
  }
  next();
});

export default router;
