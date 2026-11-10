import { fileCacheScope, getCachedFile, hashCacheValue, putCachedFile } from '../utils/file-cache.js';
import { request } from './client.js';

// 只对进行中的目录与动画请求去重。
const treeRequests = new Map();
const animationBaseRequests = new Map();
let requestGeneration = 0;

// 清除内容缓存并使进行中的请求失效
export function invalidateCourseRequests() {
  requestGeneration++;
  treeRequests.clear();
  animationBaseRequests.clear();
}

const fetchCourseList = () => request('/api/books');

// 获取课程目录树
export async function fetchCourseTree(slug, revisionId = '') {
  if (!slug) {
    throw new Error('缺少讲义标识');
  }
  const key = `${slug}:${revisionId || ''}`;
  const loadTree = async () => {
    const params = new URLSearchParams({ include_animation: '0' });
    if (revisionId !== '' && revisionId != null) params.set('revision_id', revisionId);
    const query = `?${params}`;
    const snapshot = await request(
      `/api/books/by-slug/${encodeURIComponent(slug)}/outline${query}`,
      {
        cache: 'no-store'
      }
    );
    const lecture = snapshot.book;
    const revision = snapshot.revision;
    if (
      !lecture ||
      !['lecture', 'workbook'].includes(lecture.kind) ||
      !revision ||
      !Number.isInteger(revision.edit_version) ||
      revision.edit_version < 1 ||
      !Array.isArray(snapshot.chapters)
    ) {
      throw new Error('讲义数据不完整');
    }
    if (
      lecture.slug !== String(slug) ||
      (revisionId && String(revision.id) !== String(revisionId))
    ) {
      throw new Error('讲义或版本数据不匹配');
    }
    if (
      snapshot.chapters.some(
        (chapter) =>
          !chapter.occurrence_id ||
          !Array.isArray(chapter.sections) ||
          chapter.sections.some((section) => !section.occurrence_id)
      )
    ) {
      throw new Error('讲义目录数据不完整');
    }
    return {
      ...revision,
      kind: lecture.kind,
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
  if (treeRequests.has(key)) {
    return treeRequests.get(key);
  }
  const promise = loadTree().finally(() => {
    if (treeRequests.get(key) === promise) {
      treeRequests.delete(key);
    }
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
    if (!preds.has(to)) {
      preds.set(to, []);
    }
    preds.get(to).push(from);
  }

  return list.map((ch) => {
    const prereqIds = preds.get(ch.id) ?? [];
    const prereqs = prereqIds.map((id) => {
      const p = byId.get(id) ?? {};
      const tag = p.tag || '';
      const title = p.title || String(id);
      return {
        id,
        tag,
        title,
        label: tag ? `${tag} ${title}` : title
      };
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
      revisionNo: tree.revision_no,
      revisionStatus: tree.revision_status,
      updatedAt: tree.updated_at,
      nodes: chapters.reduce((n, c) => n + c.sections.length, 0)
    },
    chapters,
    edges: tree.edges ?? []
  };
}

// 同一版本的小节共享动画基础包，仅在需要播放动画时加载。
async function fetchAnimationBase(tree) {
  const scope = fileCacheScope();
  const version = requestGeneration;
  const key = `${scope}:animation-base:${tree.id}:${tree.revision_id}:${tree.edit_version}`;
  const valid = () => version === requestGeneration && scope === fileCacheScope();
  if (animationBaseRequests.has(key)) return animationBaseRequests.get(key);
  const pending = (async () => {
    const stored = await getCachedFile(key);
    if (!valid()) throw new Error('登录状态或图书版本已变化，请重新加载');
    if (stored) return stored.value;
    const path = `/api/books/by-slug/${encodeURIComponent(tree.slug)}/revisions/${encodeURIComponent(tree.revision_id)}/animation-base?edit_version=${encodeURIComponent(tree.edit_version)}`;
    const response = await request(path, { cache: 'no-store' });
    if (!valid()) throw new Error('登录状态或图书版本已变化，请重新加载');
    if (String(response.revision_id) !== String(tree.revision_id) || response.edit_version !== tree.edit_version) {
      throw new Error('动画基础包与图书版本不匹配');
    }
    const value = response.animation_base || null;
    if (value) {
      const hash = await hashCacheValue(value).catch(() => '');
      if (valid() && hash) await putCachedFile({ key, name: `${tree.slug}-动画基础包.json`, hash, value });
    }
    return value;
  })().finally(() => {
    if (animationBaseRequests.get(key) === pending) animationBaseRequests.delete(key);
  });
  animationBaseRequests.set(key, pending);
  return pending;
}

// 获取小节源码
export async function getCourseSectionContent(courseKey, sectionId, existingTree = null) {
  const tree = existingTree || (await fetchCourseTree(courseKey));
  const chapter = tree.chapters.find((item) =>
    item.sections.some((section) => String(section.id) === String(sectionId))
  );
  const section = chapter?.sections.find((item) => String(item.id) === String(sectionId));
  if (!section) {
    const error = new Error('讲义小节不存在');
    error.status = 404;
    throw error;
  }
  let source = section.source;
  let animationSource = section.animation_source || '';
  if (tree.storageSource !== 'local') {
    const path = `/api/books/by-slug/${encodeURIComponent(tree.slug)}/revisions/${encodeURIComponent(tree.revision_id)}/chapters/${encodeURIComponent(chapter.slug)}/sections/${encodeURIComponent(section.slug)}?edit_version=${encodeURIComponent(tree.edit_version)}`;
    const scope = fileCacheScope();
    const version = requestGeneration;
    const cacheKey = `${scope}:section:${tree.id}:${tree.revision_id}:${tree.edit_version}:${section.id}`;
    const cached = await getCachedFile(cacheKey);
    if (scope !== fileCacheScope() || version !== requestGeneration) throw new Error('登录状态或图书版本已变化，请重新加载');
    const response = cached?.value || await request(path, { cache: 'no-store' });
    if (scope !== fileCacheScope() || version !== requestGeneration) throw new Error('登录状态或图书版本已变化，请重新加载');
    if (
      String(response.revision_id) !== String(tree.revision_id) ||
      String(response.occurrence_id) !== String(section.id) ||
      response.edit_version !== tree.edit_version ||
      typeof response.source !== 'string'
    ) {
      throw new Error('讲义小节数据不完整或版本不匹配');
    }
    if (!cached) {
      const hash = await hashCacheValue(response).catch(() => '');
      if (hash && scope === fileCacheScope() && version === requestGeneration) {
        await putCachedFile({ key: cacheKey, name: `${tree.slug}-${section.slug}.json`, hash, value: response });
      }
    }
    source = response.source;
    animationSource = response.animation_source || '';
  }
  const animationBase = tree.storageSource === 'local' ? tree.metadata?.animation_base || null : null;
  const loadAnimationBase = animationSource && tree.storageSource !== 'local'
    ? () => fetchAnimationBase(tree)
    : null;
  return {
    id: section.id,
    title: section.title,
    lead: section.summary || '',
    updatedAt: tree.updated_at || null,
    source: source || '',
    animationSource,
    animationBase,
    loadAnimationBase
  };
}

// 全文搜索讲义与课程节点
export async function searchLectures(q, limit = 20) {
  const trimmed = String(q || '').trim();
  if (!trimmed) {
    return [];
  }
  const res = await request(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
  return Array.isArray(res?.hits) ? res.hits : [];
}

// 获取随机搜索推荐讲义小节
export async function fetchSearchRecommendations(limit = 6) {
  const list = await fetchCourseList();
  return list
    .filter((item) => item.is_recommended)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      type: 'book'
    }));
}
