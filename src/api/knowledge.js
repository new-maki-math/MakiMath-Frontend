import { request } from './client.js';
import { invalidateCourseCaches } from './courses.js';

const mutate = async (url, options) => {
  const result = await request(url, options);
  invalidateCourseCaches();
  return result;
};

export const knowledgeApi = {
  list: () => request('/api/knowledge-points'),
  get: (id) => request(`/api/knowledge-points/${id}`),
  getPublicRevision: (id, revisionId) => request(`/api/knowledge-points/${id}/revisions/${revisionId}`),
  create: (body) => mutate('/api/knowledge-points', { method: 'POST', body }),
  mine: () => request('/api/knowledge-revisions/mine'),
  getRevision: (id) => request(`/api/knowledge-revisions/${id}`),
  createRevision: (id, basedOnId) => mutate(`/api/knowledge-points/${id}/revisions`, { method: 'POST', body: { based_on_id: basedOnId } }),
  saveRevision: (id, body) => mutate(`/api/knowledge-revisions/${id}`, { method: 'PUT', body }),
  submitRevision: (id, version) => mutate(`/api/knowledge-revisions/${id}/submit`, { method: 'POST', body: { edit_version: version } }),
  prerequisites: (id) => request(`/api/knowledge-points/${id}/prerequisites`),
  setPrerequisites: (id, prerequisites) => mutate(`/api/knowledge-points/${id}/prerequisites`, { method: 'PUT', body: { prerequisites } }),
  setCategories: (id, categories) => mutate(`/api/knowledge-points/${id}/categories`, { method: 'PUT', body: { categories } }),
  setStatus: (id, status) => mutate(`/api/knowledge-points/${id}/status`, { method: 'PATCH', body: { status } })
};
