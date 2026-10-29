import { request } from './client.js';
import { invalidateCourseCaches } from './courses.js';

const mutate = async (url, options) => {
  const result = await request(url, options);
  invalidateCourseCaches();
  return result;
};

export const lectureApi = {
  list: (options = {}) => request('/api/lectures', options),
  outline: (slug, revisionId) => request(`/api/lectures/by-slug/${encodeURIComponent(slug)}/outline${revisionId != null && revisionId !== '' ? `?revision_id=${encodeURIComponent(revisionId)}` : ''}`, { cache: 'no-store' }),
  section: (slug, revisionId, chapterSlug, sectionSlug, editVersion) => request(`/api/lectures/by-slug/${encodeURIComponent(slug)}/revisions/${encodeURIComponent(revisionId)}/chapters/${encodeURIComponent(chapterSlug)}/sections/${encodeURIComponent(sectionSlug)}?edit_version=${encodeURIComponent(editVersion)}`, { cache: 'no-store' }),
  mine: () => request('/api/lectures/mine'),
  manage: () => request('/api/lectures/manage', { cache: 'no-store' }),
  owned: () => request('/api/lectures/owned', { cache: 'no-store' }),
  create: (body) => mutate('/api/lectures', { method: 'POST', body }),
  importLecture: (body) => mutate('/api/lectures/import', { method: 'POST', body }),
  exportRevision: (id) => request(`/api/lecture-revisions/${id}/export`, { cache: 'no-store' }),
  getCover: (id) => request(`/api/lecture-revisions/${id}/cover`, { cache: 'no-store' }),
  setCover: (id, editVersion, cover) => mutate(`/api/lecture-revisions/${id}/cover`, { method: 'PUT', body: { edit_version: editVersion, cover } }),
  removeCover: (id, editVersion) => mutate(`/api/lecture-revisions/${id}/cover?edit_version=${encodeURIComponent(editVersion)}`, { method: 'DELETE' }),
  revisions: (id) => request(`/api/lectures/${id}/revisions`),
  saveRevision: (id, body) => mutate(`/api/lecture-revisions/${id}`, { method: 'PUT', body }),
  saveSection: (id, occurrenceId, body) => mutate(`/api/lecture-revisions/${id}/sections/${encodeURIComponent(occurrenceId)}`, { method: 'PUT', body }),
  submitRevision: (id, version) => mutate(`/api/lecture-revisions/${id}/submit`, { method: 'POST', body: { edit_version: version } }),
  collaborators: (id) => request(`/api/lectures/${id}/collaborators`),
  setPublication: (id, body) => mutate(`/api/lectures/${id}/publication`, { method: 'PATCH', body }),
  restore: (id) => mutate(`/api/lectures/${id}/restore`, { method: 'POST' }),
  remove: (id) => mutate(`/api/lectures/${id}`, { method: 'DELETE' })
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
