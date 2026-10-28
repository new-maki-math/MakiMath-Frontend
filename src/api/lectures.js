import { request } from './client.js';
import { invalidateCourseCaches } from './courses.js';

const mutate = async (url, options) => {
  const result = await request(url, options);
  invalidateCourseCaches();
  return result;
};

export const lectureApi = {
  list: () => request('/api/lectures'),
  getBySlug: (slug, revisionId) => request(`/api/lectures/by-slug/${encodeURIComponent(slug)}${revisionId != null && revisionId !== '' ? `?revision_id=${encodeURIComponent(revisionId)}` : ''}`, { cache: 'no-store' }),
  mine: () => request('/api/lectures/mine'),
  owned: () => request('/api/lectures/owned', { cache: 'no-store' }),
  create: (body) => mutate('/api/lectures', { method: 'POST', body }),
  revisions: (id) => request(`/api/lectures/${id}/revisions`),
  createRevision: (id, basedOnId) => mutate(`/api/lectures/${id}/revisions`, { method: 'POST', body: { based_on_id: basedOnId } }),
  getRevision: (id) => request(`/api/lecture-revisions/${id}`, { cache: 'no-store' }),
  saveRevision: (id, body) => mutate(`/api/lecture-revisions/${id}`, { method: 'PUT', body }),
  submitRevision: (id, version) => mutate(`/api/lecture-revisions/${id}/submit`, { method: 'POST', body: { edit_version: version } }),
  collaborators: (id) => request(`/api/lectures/${id}/collaborators`),
  setCollaborator: (id, userId, permission) => mutate(`/api/lectures/${id}/collaborators/${userId}`, { method: 'PUT', body: { permission } }),
  removeCollaborator: (id, userId) => mutate(`/api/lectures/${id}/collaborators/${userId}`, { method: 'DELETE' }),
  setPublication: (id, body) => mutate(`/api/lectures/${id}/publication`, { method: 'PATCH', body })
};

export function lectureSaveBody(revision, chapters) {
  return {
    edit_version: revision.edit_version,
    title: revision.title,
    subtitle: revision.subtitle,
    descr: revision.descr,
    category_id: revision.category_id,
    typst_version: revision.typst_version,
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
        source: section.source
      }))
    }))
  };
}
