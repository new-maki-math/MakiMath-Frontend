import { request } from './client.js';
import { invalidateCourseCaches } from './courses.js';

const mutate = async (url, options) => {
  const result = await request(url, options);
  invalidateCourseCaches();
  return result;
};

export const knowledgeApi = {
  map: (categoryId) => request(`/api/knowledge-map${categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : ''}`),
  list: () => request('/api/knowledge-points', { cache: 'no-store' }),
  get: (id) => request(`/api/knowledge-points/${id}`, { cache: 'no-store' }),
  manage: () => request('/api/knowledge-points/manage', { cache: 'no-store' }),
  getManaged: (id) => request(`/api/knowledge-points/manage/${id}`, { cache: 'no-store' }),
  create: (body) => mutate('/api/knowledge-points', { method: 'POST', body }),
  update: (id, body) => mutate(`/api/knowledge-points/${id}`, { method: 'PUT', body }),
  prerequisites: (id) => request(`/api/knowledge-points/${id}/prerequisites`),
  setPrerequisites: (id, prerequisites) => mutate(`/api/knowledge-points/${id}/prerequisites`, { method: 'PUT', body: { prerequisites } }),
  setCategories: (id, categories) => mutate(`/api/knowledge-points/${id}/categories`, { method: 'PUT', body: { categories } }),
  setStatus: (id, status) => mutate(`/api/knowledge-points/${id}/status`, { method: 'PATCH', body: { status } })
};
