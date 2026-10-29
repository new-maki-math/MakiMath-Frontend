import { request } from './client.js';
import { transformCourseCategories } from '../utils/course-adapter.js';

// 内存单例缓存与 slug 映射
const treeCache = new Map();
const courseListCache = new Map();
const treeRequests = new Map();
const courseListRequests = new Map();
let cacheVersion = 0;

// 清除内容缓存并使进行中的请求失效
export function invalidateCourseCaches() {
  cacheVersion++;
  treeCache.clear();
  courseListCache.clear();
  treeRequests.clear();
  courseListRequests.clear();
}

const fetchCourseList = () => cachedRequest(courseListCache, courseListRequests, 'all', () => request('/api/lectures'));

function cachedRequest(cache, pending, key, load) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return pending.get(key);
  const version = cacheVersion;
  const promise = load().then((value) => {
    if (version === cacheVersion) cache.set(key, value);
    return value;
  }).finally(() => {
    if (pending.get(key) === promise) pending.delete(key);
  });
  pending.set(key, promise);
  return promise;
}

// 获取分类与课程列表
export async function getCourseCategories() {
  try {
    const [cats, courses] = await Promise.all([
      request('/api/categories/lecture'),
      fetchCourseList()
    ]);
    if (!Array.isArray(cats)) return [];

    // 按分类归组课程
    const grouped = new Map();
    for (const course of Array.isArray(courses) ? courses : []) {
      const key = String(course.category_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({
        id: String(course.id),
        slug: course.slug,
        title: course.title,
        desc: course.descr || course.subtitle || '',
        live: true,
        hidden: false
      });
    }

    const knownIds = new Set(cats.map((cat) => String(cat.id)));
    const uncategorized = [...grouped].filter(([id]) => !knownIds.has(id)).flatMap(([, entries]) => entries);
    const groups = cats.map((cat) => ({
      id: cat.id,
      name: cat.name,
      courses: grouped.get(String(cat.id)) || []
    }));
    if (uncategorized.length) groups.push({ id: 'uncategorized', name: '未分类', courses: uncategorized });
    return transformCourseCategories(groups);
  } catch (error) {
    console.error('[API] 从服务器获取课程大类失败:', error);
    return [];
  }
}

// 获取课程目录树
export async function fetchCourseTree(slug, revisionId = '') {
  if (!slug) throw new Error('缺少讲义标识');
  const startedVersion = cacheVersion;
  const key = `${slug}:${revisionId || ''}`;
  const loadTree = async () => {
    const query = revisionId !== '' && revisionId != null ? `?revision_id=${encodeURIComponent(revisionId)}` : '';
    const snapshot = await request(`/api/lectures/by-slug/${encodeURIComponent(slug)}/outline${query}`, { cache: 'no-store' });
    const lecture = snapshot.lecture;
    const revision = snapshot.revision;
    if (!lecture || !revision || !Number.isInteger(revision.edit_version) || revision.edit_version < 1 || !Array.isArray(snapshot.chapters)) throw new Error('讲义数据不完整');
    if (lecture.slug !== String(slug) || (revisionId && String(revision.id) !== String(revisionId))) throw new Error('讲义或版本数据不匹配');
    if (snapshot.chapters.some((chapter) =>
      !chapter.occurrence_id || !Array.isArray(chapter.sections) || chapter.sections.some((section) =>
        !section.occurrence_id
      )
    )) throw new Error('讲义目录数据不完整');
    return {
      ...revision,
      id: lecture.id,
      revision_id: revision.id,
      revision_status: revision.status,
      slug: lecture.slug,
      status: 'live',
      chapters: snapshot.chapters.map((chapter) => ({
        ...chapter,
        id: chapter.occurrence_id,
        sections: (chapter.sections || []).map((section) => ({
          ...section,
          id: section.occurrence_id
        }))
      })),
      edges: []
    };
  };
  if (startedVersion !== cacheVersion) return loadTree();
  const version = cacheVersion;
  if (treeRequests.has(key)) return treeRequests.get(key);
  const promise = loadTree().then((tree) => {
    if (version === cacheVersion) {
      treeCache.set(key, tree);
    }
    return tree;
  }).finally(() => {
    if (treeRequests.get(key) === promise) treeRequests.delete(key);
  });
  treeRequests.set(key, promise);
  return promise;
}

// 转换章节数据模型
export function toChapters(tree) {
  const list = Array.isArray(tree?.chapters) ? tree.chapters : [];
  const byId = new Map(list.map((c) => [c.id, c]));

  const preds = new Map();
  for (const [from, to] of tree?.edges ?? []) {
    if (!preds.has(to)) preds.set(to, []);
    preds.get(to).push(from);
  }

  return list.map((ch) => {
    const prereqIds = preds.get(ch.id) ?? [];
    const prereqs = prereqIds.map((id) => {
      const p = byId.get(id) ?? {};
      const tag = p.tag || '';
      const title = p.title || String(id);
      return { id, tag, title, label: tag ? `${tag} ${title}` : title };
    });

    return {
      id: String(ch.id),
      slug: ch.slug,
      tag: ch.tag || '',
      title: ch.title,
      summary: ch.summary || '',
      sections: (ch.sections ?? []).map((s) => ({
        id: String(s.id),
        slug: s.slug ? String(s.slug) : '',
        tag: s.tag || '',
        title: s.title,
        desc: s.summary || '',
        hasSource: s.has_source == null ? null : Boolean(s.has_source),
        sourceLen: s.source_len ?? 0,
        updatedAt: s.updated_at || null
      })),
      prereqIds,
      prereqs,
      prereqText: prereqs.length
        ? `学完 ${prereqs.map((p) => p.label).join('、')} 后可学`
        : '随时可学',
      isOrigin: prereqs.length === 0
    };
  });
}

// 获取课程数据包
export async function fetchLectureBundle(id) {
  const tree = await fetchCourseTree(id);
  return lectureBundleFromTree(tree);
}

export function lectureBundleFromTree(tree) {
  const chapters = toChapters(tree);

  return {
    slug: tree.slug,
    lecture: {
      id: String(tree.id),
      slug: tree.slug,
      dbId: tree.id,
      title: tree.title,
      subtitle: tree.subtitle || '',
      cover: tree.cover || '',
      desc: tree.descr || tree.subtitle || '',
      category: tree.category || '',
      status: tree.status,
      live: tree.status === 'live',
      typstVersion: tree.typst_version,
      revisionNo: tree.revision_no,
      revisionStatus: tree.revision_status,
      updatedAt: tree.updated_at,
      nodes: chapters.reduce((n, c) => n + c.sections.length, 0)
    },
    chapters,
    edges: tree.edges ?? []
  };
}

// 获取课程详情
export async function getCourseById(id) {
  try {
    const bundle = await fetchLectureBundle(id);
    return bundle.lecture;
  } catch (error) {
    if (error?.status === 404) return null;
    console.error(`[API] 加载课程 ${id} 失败:`, error);
    return null;
  }
}

// 获取课程章节树
export async function getCourseChapters(id) {
  try {
    const bundle = await fetchLectureBundle(id);
    return bundle.chapters;
  } catch (error) {
    console.error(`[API] 加载课程 ${id} 目录失败:`, error);
    return [];
  }
}

// 获取缓存的章节树
export function getCachedCourseChapters(id) {
  if (!id) return [];
  const key = `${id}:`;
  if (treeCache.has(key)) return toChapters(treeCache.get(key));
  fetchLectureBundle(id).catch(() => {});
  return [];
}

// 获取小节源码
export async function getCourseSectionContent(courseKey, sectionId, existingTree = null) {
  const tree = existingTree || await fetchCourseTree(courseKey);
  const chapter = tree.chapters.find((item) => item.sections.some((section) => String(section.id) === String(sectionId)));
  const section = chapter?.sections.find((item) => String(item.id) === String(sectionId));
  if (!section) {
    const error = new Error('讲义小节不存在');
    error.status = 404;
    throw error;
  }
  let source = section.source;
  if (tree.storageSource !== 'local') {
    const path = `/api/lectures/by-slug/${encodeURIComponent(tree.slug)}/revisions/${encodeURIComponent(tree.revision_id)}/chapters/${encodeURIComponent(chapter.slug)}/sections/${encodeURIComponent(section.slug)}?edit_version=${encodeURIComponent(tree.edit_version)}`;
    const response = await request(path, { cache: 'no-store' });
    if (String(response.revision_id) !== String(tree.revision_id) || String(response.occurrence_id) !== String(section.id) || response.edit_version !== tree.edit_version || typeof response.source !== 'string') throw new Error('讲义小节数据不完整或版本不匹配');
    source = response.source;
  }
  return { id: section.id, title: section.title, lead: section.summary || '', updatedAt: tree.updated_at || null, source: source || '' };
}

// 全文搜索讲义与课程节点
export async function searchLectures(q, limit = 20) {
  const trimmed = String(q || '').trim();
  if (!trimmed) return [];
  const res = await request(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
  return Array.isArray(res?.hits) ? res.hits : [];
}

// 获取随机搜索推荐讲义小节
export async function fetchSearchRecommendations(limit = 6) {
  const list = await fetchCourseList();
  return list.filter((item) => item.is_recommended).slice(0, limit).map((item) => ({ ...item, type: 'lecture' }));
}
