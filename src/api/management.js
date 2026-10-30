import { request } from './client.js';

export const managementApi = {
  categories: (kind) => request(`/api/categories/${kind}`, { cache: 'no-store' }),
  createCategory: (kind, body) => request(`/api/categories/${kind}`, { method: 'POST', body }),
  removeKnowledgeCategory: (id) => request(`/api/categories/knowledge/${id}`, { method: 'DELETE', retryAuth: false })
};
