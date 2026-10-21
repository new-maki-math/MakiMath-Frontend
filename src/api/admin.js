/**
 * 讲义管理接口，对应 maki-math-backend 的 /api 路由
 */
import { request } from './client.js';

const post = (url, body) => request(url, { method: 'POST', body });
const patch = (url, body) => request(url, { method: 'PATCH', body });
const put = (url, body) => request(url, { method: 'PUT', body });
const del = (url) => request(url, { method: 'DELETE' });

const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const adminApi = {
  categories: {
    list: () => request('/api/categories'),
    get: (id) => request(`/api/categories/${id}`),
    create: (body) => post('/api/categories', body),
    update: (id, body) => patch(`/api/categories/${id}`, body),
    remove: (id) => del(`/api/categories/${id}`),
    order: (ids) => put('/api/categories/order', { ids })
  },

  courses: {
    list: (params = {}) => request(`/api/courses${qs(params)}`),
    get: (id) => request(`/api/courses/${id}`),
    tree: (id) => request(`/api/courses/${id}/tree`),
    create: (body) => post('/api/courses', body),
    update: (id, body) => patch(`/api/courses/${id}`, body),
    setPreamble: (id, preamble) => put(`/api/courses/${id}/preamble`, { preamble }),
    setPrereqs: (id, prereqs) => put(`/api/courses/${id}/prereqs`, { prereqs }),
    remove: (id) => del(`/api/courses/${id}`),
    batchRemove: (ids) => post('/api/courses/batch-delete', { ids }),
    order: (categoryId, ids) => put('/api/courses/order', { category_id: categoryId, ids })
  },

  chapters: {
    list: (courseId) => request(`/api/chapters${qs({ course_id: courseId })}`),
    get: (id) => request(`/api/chapters/${id}`),
    create: (body) => post('/api/chapters', body),
    update: (id, body) => patch(`/api/chapters/${id}`, body),
    setIntro: (id, intro_source) => put(`/api/chapters/${id}/intro`, { intro_source }),
    remove: (id) => del(`/api/chapters/${id}`),
    batchRemove: (ids) => post('/api/chapters/batch-delete', { ids }),
    order: (courseId, ids) => put('/api/chapters/order', { course_id: courseId, ids })
  },

  sections: {
    list: (chapterId) => request(`/api/sections${qs({ chapter_id: chapterId })}`),
    get: (id) => request(`/api/sections/${id}`),
    create: (body) => post('/api/sections', body),
    update: (id, body) => patch(`/api/sections/${id}`, body),
    setSource: (id, source) => put(`/api/sections/${id}/source`, { source }),
    setPrereqs: (id, prereqs) => put(`/api/sections/${id}/prereqs`, { prereqs }),
    remove: (id) => del(`/api/sections/${id}`),
    batchRemove: (ids) => post('/api/sections/batch-delete', { ids }),
    batchMove: (ids, targetChapterId) => post('/api/sections/batch-move', { ids, target_chapter_id: targetChapterId }),
    batchCopy: (ids, targetChapterId = null) =>
      post('/api/sections/batch-copy', { ids, target_chapter_id: targetChapterId }),
    order: (chapterId, ids) => put('/api/sections/order', { chapter_id: chapterId, ids })
  },

  search: (q) => request(`/api/search${qs({ q })}`)
};

export const COURSE_STATUSES = [
  { value: 'draft', label: 'draft · 草稿' },
  { value: 'live', label: 'live · 上线' },
  { value: 'hidden', label: 'hidden · 隐藏' },
  { value: 'archived', label: 'archived · 归档' }
];

export const STATUS_TAG_VARIANT = {
  draft: 'muted',
  live: 'green',
  hidden: 'amber',
  archived: 'muted'
};

/**
 * 从文件名推小节标题，去掉扩展名并把下划线连字符转空格
 */
export function titleFromFilename(filename) {
  const stem = String(filename).replace(/\.(typ|txt)$/i, '');
  return stem.replace(/[_-]+/g, ' ').trim() || stem;
}

/**
 * 批量导入时按已有 L## 序号往后生成新 slug
 */
export function nextSectionSlugs(existingSlugs, count) {
  let max = 0;
  for (const slug of existingSlugs) {
    const m = /^L(\d+)$/i.exec(String(slug));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `L${String(max + i + 1).padStart(2, '0')}`);
}

/**
 * 读取本地 .typ 文件为文本
 */
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`读取文件 ${file.name} 失败`));
    reader.readAsText(file, 'utf-8');
  });
}
