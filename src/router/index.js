import { createRouter, createWebHistory } from 'vue-router';

// 懒加载页面视图
const StartView = () => import('../views/start/start.vue');
const HowToUseView = () => import('../views/how-to-use/how-to-use.vue');
const RecomLectureView = () => import('../views/recom-lecture/recom-lecture.vue');
const MyLectureView = () => import('../views/my-lecture/my-lecture.vue');
const ThemeDemoView = () => import('../views/theme-demo/theme-demo.vue');
const CourseHomeView = () => import('../views/course-home/course-home.vue');
const LectureDocView = () => import('../views/lecture-doc/lecture-doc.vue');
const AdminView = () => import('../views/admin/admin.vue');

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
    path: '/admin',
    name: 'admin',
    component: AdminView,
    meta: { title: '讲义管理', tag: 'EDIT' }
  },
  // 保留旧路由重定向，保证外链兼容
  {
    path: '/routes',
    redirect: '/recom-lecture'
  },
  {
    path: '/notes',
    redirect: '/my-lecture'
  },
  // 保留设计规范与主题展示路由
  {
    path: '/theme-demo',
    name: 'theme-demo',
    component: ThemeDemoView,
    meta: { title: '主题规范', tag: 'THEME' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
