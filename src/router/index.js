import { createRouter, createWebHistory } from 'vue-router';

// 页面视图
const StartView = () => import('../views/start/start.vue');
const HowToUseView = () => import('../views/how-to-use/how-to-use.vue');
const RecomLectureView = () => import('../views/recom-lecture/recom-lecture.vue');
const MyLectureView = () => import('../views/my-lecture/my-lecture.vue');
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
    path: '/workbench',
    name: 'workbench',
    component: AdminView,
    meta: { title: '讲义工作台', tag: 'WORKBENCH' }
  },
  // 兼容旧路由
  {
    path: '/routes',
    redirect: '/recom-lecture'
  },
  {
    path: '/notes',
    redirect: '/my-lecture'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
