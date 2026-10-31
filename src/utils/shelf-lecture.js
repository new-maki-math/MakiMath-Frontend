import { fetchCourseTree } from '../api/courses.js';
import { findLocalLectureBySlug } from './local-lectures.js';

export async function fetchShelfLectureTree(id, source, revisionId = '') {
  let snapshot;
  if (source === 'local') {
    snapshot = await findLocalLectureBySlug(String(id));
  } else if (source === 'online') {
    return fetchCourseTree(id, revisionId);
  } else {
    throw new Error('讲义来源无效');
  }
  if (!snapshot?.revision || !Array.isArray(snapshot.chapters)) {
    throw new Error('讲义数据不完整');
  }
  const chapters = snapshot.chapters.map((chapter) => {
    if (!chapter.occurrence_id || !Array.isArray(chapter.sections)) {
      throw new Error('讲义章节数据不完整');
    }
    return {
      ...chapter,
      id: chapter.occurrence_id,
      sections: chapter.sections.map((section) => {
        if (!section.occurrence_id || typeof section.source !== 'string') {
          throw new Error('讲义小节暂不支持当前内容格式');
        }
        return {
          ...section,
          id: section.occurrence_id,
          has_source: Boolean(section.source)
        };
      })
    };
  });
  return {
    ...snapshot.revision,
    id: snapshot.id,
    slug: snapshot.slug || '',
    cover: snapshot.cover || '',
    storageSource: 'local',
    status: 'live',
    chapters,
    edges: []
  };
}
