import { request } from './client.js';

const base = '/api/questions';
const categories = '/api/question-categories';
const entries = '/api/question-entries';
const query = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
  ).toString();

export const questionApi = {
  clearOrphaned: () =>
    request(`${base}/orphaned/clear`, {
      method: 'POST',
      body: {},
      retryAuth: false
    }),
  reorderCategory: (id, body) =>
    request(`${categories}/${encodeURIComponent(id)}/reorder`, {
      method: 'POST',
      body,
      retryAuth: false
    }),
  reorderEntry: (id, body) =>
    request(`${entries}/${encodeURIComponent(id)}/reorder`, {
      method: 'POST',
      body,
      retryAuth: false
    }),
  categories: (options = {}) =>
    request(categories, {
      ...options,
      cache: 'no-store'
    }),
  createCategory: (body) =>
    request(categories, {
      method: 'POST',
      body
    }),
  updateCategory: (id, body) =>
    request(`${categories}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body
    }),
  categoryImpact: (id) =>
    request(`${categories}/${encodeURIComponent(id)}/delete-impact`, {
      cache: 'no-store'
    }),
  deleteCategory: (id) =>
    request(`${categories}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      retryAuth: false
    }),
  entries: (params, options = {}) =>
    request(`${entries}?${query(params)}`, {
      ...options,
      cache: 'no-store'
    }),
  orphaned: (params, options = {}) =>
    request(
      `${base}?${query({
        ...params,
        orphaned: true
      })}`,
      {
        ...options,
        cache: 'no-store'
      }
    ),
  createEntry: (body) =>
    request(entries, {
      method: 'POST',
      body
    }),
  updateEntry: (id, body) =>
    request(`${entries}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body
    }),
  deleteEntry: (id) =>
    request(`${entries}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      retryAuth: false
    }),
  detail: (id, options = {}) =>
    request(`${base}/${encodeURIComponent(id)}`, {
      ...options,
      cache: 'no-store'
    }),
  bySlug: (slug, options = {}) =>
    request(`${base}/by-slug/${encodeURIComponent(slug)}`, {
      ...options,
      cache: 'no-store'
    }),
  batch: (slugs) =>
    request(`${base}/batch`, {
      method: 'POST',
      body: {
        slugs
      },
      cache: 'no-store'
    }),
  create: (body) =>
    request(base, {
      method: 'POST',
      body
    }),
  import: (body) =>
    request(`${base}/import`, {
      method: 'POST',
      body,
      retryAuth: false
    }),
  update: (id, body) =>
    request(`${base}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body
    }),
  impact: (id) =>
    request(`${base}/${encodeURIComponent(id)}/delete-impact`, {
      cache: 'no-store'
    }),
  remove: (id) =>
    request(`${base}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      retryAuth: false
    })
};
