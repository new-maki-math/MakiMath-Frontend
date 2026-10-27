import { request } from './client.js';

export const managementApi = {
  categories: (kind) => request(`/api/categories/${kind}`, { cache: 'no-store' }),
  createCategory: (kind, body) => request(`/api/categories/${kind}`, { method: 'POST', body }),
  invitations: () => request('/api/invitations'),
  createInvitation: (body) => request('/api/invitations', { method: 'POST', body }),
  revokeInvitation: (id) => request(`/api/invitations/${id}`, { method: 'DELETE' }),
  users: () => request('/api/users'),
  setUserStatus: (id, status) => request(`/api/users/${id}/status`, { method: 'PATCH', body: { status } }),
  auditLogs: (limit = 20) => request(`/api/audit-logs?limit=${limit}`)
};
