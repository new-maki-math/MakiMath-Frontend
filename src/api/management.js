import { request } from './client.js';

export const managementApi = {
  categories: (kind) => request(`/api/categories/${kind}`),
  createCategory: (kind, body) => request(`/api/categories/${kind}`, { method: 'POST', body }),
  updateCategory: (kind, id, body) => request(`/api/categories/${kind}/${id}`, { method: 'PUT', body }),
  invitations: () => request('/api/invitations'),
  createInvitation: (body) => request('/api/invitations', { method: 'POST', body }),
  revokeInvitation: (id) => request(`/api/invitations/${id}`, { method: 'DELETE' }),
  users: () => request('/api/users'),
  setUserStatus: (id, status) => request(`/api/users/${id}/status`, { method: 'PATCH', body: { status } }),
  auditLogs: (limit = 20) => request(`/api/audit-logs?limit=${limit}`)
};
