import { fileCacheScope, getCachedFile, getFileCacheContextGeneration, putCachedFile } from '../utils/file-cache.js';
import { request } from './client.js';
import { invalidateCourseRequests } from './courses.js';

const coverRequests = new Map();
const coverVersions = new Map();
const coverHashPattern = /^[a-f0-9]{64}$/;

function invalidateLectureCover(id) {
  const key = String(id);
  coverVersions.set(key, (coverVersions.get(key) || 0) + 1);
}

function getCachedLectureCover(id, hash, load) {
  const revisionId = String(id);
  const scope = fileCacheScope();
  const generation = getFileCacheContextGeneration();
  const version = coverVersions.get(revisionId) || 0;
  const key = typeof hash === 'string' && coverHashPattern.test(hash) ? `${scope}:cover:${hash}` : '';
  const requestKey = `${scope}:${generation}:${revisionId}:${version}:${hash || ''}`;
  const valid = () => scope === fileCacheScope() && generation === getFileCacheContextGeneration() && version === (coverVersions.get(revisionId) || 0);
  if (coverRequests.has(requestKey)) return coverRequests.get(requestKey);
  const pending = (async () => {
    const stored = key ? await getCachedFile(key) : null;
    if (!valid()) throw new Error('封面状态已变化，请重新读取');
    if (typeof stored?.value === 'string') return { revision_id: id, cover: stored.value, cover_hash: hash };
    const result = await load();
    if (!valid()) throw new Error('封面状态已变化，请重新读取');
    if (String(result?.revision_id) !== revisionId || typeof result.cover !== 'string') throw new Error('封面数据不完整');
    if (coverHashPattern.test(result.cover_hash || '')) {
      await putCachedFile({ key: `${scope}:cover:${result.cover_hash}`, name: `封面-${revisionId}`, hash: result.cover_hash, value: result.cover });
      if (!valid()) throw new Error('封面状态已变化，请重新读取');
    }
    return result;
  })().finally(() => {
    if (coverRequests.get(requestKey) === pending) coverRequests.delete(requestKey);
  });
  coverRequests.set(requestKey, pending);
  return pending;
}

const mutate = async (url, options) => {
  const result = await request(url, options);
  invalidateCourseRequests();
  return result;
};

const mutateCover = async (id, url, options) => {
  await invalidateLectureCover(id);
  try {
    return await mutate(url, options);
  } finally {
    await invalidateLectureCover(id);
  }
};

export const bookApi = {
  list: (options = {}) => request('/api/books', options),
  outline: (slug, revisionId) =>
    request(
      `/api/books/by-slug/${encodeURIComponent(slug)}/outline${revisionId != null && revisionId !== '' ? `?revision_id=${encodeURIComponent(revisionId)}` : ''}`,
      {
        cache: 'no-store'
      }
    ),
  section: (slug, revisionId, chapterSlug, sectionSlug, editVersion) =>
    request(
      `/api/books/by-slug/${encodeURIComponent(slug)}/revisions/${encodeURIComponent(revisionId)}/chapters/${encodeURIComponent(chapterSlug)}/sections/${encodeURIComponent(sectionSlug)}?edit_version=${encodeURIComponent(editVersion)}`,
      {
        cache: 'no-store'
      }
    ),
  printData: (slug, params) =>
    request(`/api/books/by-slug/${encodeURIComponent(slug)}/print-data?${params}`, {
      cache: 'no-store'
    }),
  mine: () => request('/api/books/mine'),
  manage: () =>
    request('/api/books/manage', {
      cache: 'no-store'
    }),
  owned: () =>
    request('/api/books/owned', {
      cache: 'no-store'
    }),
  create: (body) =>
    mutate('/api/books', {
      method: 'POST',
      body
    }),
  importBook: (body) =>
    mutate('/api/books/import', {
      method: 'POST',
      body
    }),
  exportRevision: (id) =>
    request(`/api/book-revisions/${id}/export`, {
      cache: 'no-store'
    }),
  getCover: (id, hash) =>
    getCachedLectureCover(id, hash, () =>
      request(`/api/book-revisions/${id}/cover`, {
        cache: 'no-store'
      })
    ),
  setCover: (id, editVersion, cover) =>
    mutateCover(id, `/api/book-revisions/${id}/cover`, {
      method: 'PUT',
      body: {
        edit_version: editVersion,
        cover
      }
    }),
  removeCover: (id, editVersion) =>
    mutateCover(
      id,
      `/api/book-revisions/${id}/cover?edit_version=${encodeURIComponent(editVersion)}`,
      {
        method: 'DELETE'
      }
    ),
  revisions: (id) => request(`/api/books/${id}/revisions`),
  saveRevision: (id, body) =>
    mutate(`/api/book-revisions/${id}`, {
      method: 'PUT',
      body
    }),
  saveSection: (id, occurrenceId, body) =>
    mutate(`/api/book-revisions/${id}/sections/${encodeURIComponent(occurrenceId)}`, {
      method: 'PUT',
      body
    }),
  submitRevision: (id, version) =>
    mutate(`/api/book-revisions/${id}/submit`, {
      method: 'POST',
      body: {
        edit_version: version
      }
    }),
  collaborators: (id) => request(`/api/books/${id}/collaborators`),
  setPublication: (id, body) =>
    mutate(`/api/books/${id}/publication`, {
      method: 'PATCH',
      body
    }),
  restore: (id) =>
    mutate(`/api/books/${id}/restore`, {
      method: 'POST'
    }),
  remove: (id) =>
    mutate(`/api/books/${id}`, {
      method: 'DELETE'
    })
};

export function bookSaveBody(revision, chapters) {
  return {
    edit_version: revision.edit_version,
    title: revision.title,
    subtitle: revision.subtitle,
    descr: revision.descr,
    category_id: revision.category_id,
    metadata: revision.metadata,
    change_note: revision.change_note,
    chapters: chapters.map((chapter) => ({
      occurrence_id: chapter.occurrence_id,
      slug: chapter.slug,
      tag: chapter.tag,
      title: chapter.title,
      summary: chapter.summary,
      sections: chapter.sections.map((section) => ({
        occurrence_id: section.occurrence_id,
        slug: section.slug,
        tag: section.tag,
        title: section.title,
        summary: section.summary,
        source: section.source,
        animation_source: section.animation_source
      }))
    }))
  };
}
