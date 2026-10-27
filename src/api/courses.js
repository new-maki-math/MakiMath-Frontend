import { request } from './client.js';
import { transformCourseCategories } from '../utils/course-adapter.js';
import { adaptDocWithPreset, registerPresetMapping } from '../utils/preset-loader.js';

// 内存单例缓存与 slug 映射
const treeCache = new Map();
const docCache = new Map();
const courseListCache = new Map();
const treeRequests = new Map();
const docRequests = new Map();
const courseListRequests = new Map();
let cacheVersion = 0;
// slug -> 数字 id 的动态映射表；不要硬编码，课程 id 由数据库自增决定
const slugToIdMap = new Map();

// 清除内容缓存并使进行中的请求失效
export function invalidateCourseCaches() {
  cacheVersion++;
  treeCache.clear();
  docCache.clear();
  courseListCache.clear();
  treeRequests.clear();
  docRequests.clear();
  courseListRequests.clear();
  slugToIdMap.clear();
}

const fetchCourseList = () => cachedRequest(courseListCache, courseListRequests, 'all', () => request('/api/courses'));

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

// 规范化课程 id 传入 slug 则解析为后端数字 ID
export async function resolveCourseId(idOrSlug) {
  if (!idOrSlug) throw new Error('缺少课程标识');
  const str = String(idOrSlug).trim();
  if (/^\d+$/.test(str)) return str;
  if (slugToIdMap.has(str)) return slugToIdMap.get(str);
  const version = cacheVersion;
  const list = await fetchCourseList();
  if (Array.isArray(list)) {
    for (const course of list) {
      if (course.slug && version === cacheVersion) slugToIdMap.set(course.slug, String(course.id));
    }
  }
  const course = Array.isArray(list) ? list.find((item) => item.slug === str) : null;
  if (course) return String(course.id);
  const error = new Error('课程不存在');
  error.status = 404;
  throw error;
}

// 获取分类与课程列表
export async function getCourseCategories() {
  try {
    const [cats, courses] = await Promise.all([
      request('/api/categories'),
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
        live: course.status === 'live',
        hidden: course.status === 'hidden' || course.status === 'archived'
      });
    }

    return transformCourseCategories(
      cats.map((cat) => ({
        id: cat.id,
        name: cat.name,
        courses: grouped.get(String(cat.id)) || []
      }))
    );
  } catch (error) {
    console.error('[API] 从服务器获取课程大类失败:', error);
    return [];
  }
}

// 获取课程目录树
export async function fetchCourseTree(id) {
  if (!id) throw new Error('缺少课程 id');
  const startedVersion = cacheVersion;
  const resolvedId = await resolveCourseId(id);
  const key = String(resolvedId);
  if (startedVersion !== cacheVersion) return request(`/api/courses/${encodeURIComponent(key)}/tree`);
  const version = cacheVersion;
  return cachedRequest(treeCache, treeRequests, key, async () => {
    const tree = await request(`/api/courses/${encodeURIComponent(key)}/tree`);
    if (tree.slug && version === cacheVersion) {
      slugToIdMap.set(tree.slug, String(tree.id));
      registerPresetMapping(tree.id, tree.slug);
    }
    return tree;
  });
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
        hasSource: Boolean(s.has_source),
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
export async function fetchCourseBundle(id) {
  const tree = await fetchCourseTree(id);
  const chapters = toChapters(tree);

  return {
    slug: tree.slug,
    course: {
      id: String(tree.id),
      slug: tree.slug,
      dbId: tree.id,
      title: tree.title,
      subtitle: tree.subtitle || '',
      desc: tree.descr || tree.subtitle || '',
      category: tree.category || '',
      status: tree.status,
      live: tree.status === 'live',
      typstVersion: tree.typst_version,
      nodes: chapters.reduce((n, c) => n + c.sections.length, 0)
    },
    chapters,
    edges: tree.edges ?? []
  };
}

// 获取课程详情
export async function getCourseById(id) {
  try {
    const bundle = await fetchCourseBundle(id);
    return bundle.course;
  } catch (error) {
    if (error?.status === 404) return null;
    console.error(`[API] 加载课程 ${id} 失败:`, error);
    return null;
  }
}

// 获取课程章节树
export async function getCourseChapters(id) {
  try {
    const bundle = await fetchCourseBundle(id);
    return bundle.chapters;
  } catch (error) {
    console.error(`[API] 加载课程 ${id} 目录失败:`, error);
    return [];
  }
}

// 获取缓存的章节树
export function getCachedCourseChapters(id) {
  if (!id) return [];
  const key = slugToIdMap.get(String(id)) || String(id);
  if (treeCache.has(key)) return toChapters(treeCache.get(key));
  fetchCourseBundle(key).catch(() => {});
  return [];
}

// 获取小节正文文档
export async function getCourseSectionDoc(sectionId) {
  const key = String(sectionId);
  return cachedRequest(docCache, docRequests, key, () => request(`/api/sections/${encodeURIComponent(key)}/doc`));
}

// 提取标题纯文本
function headingText(node) {
  if (typeof node.text === 'string' && node.text) return node.text;
  let out = '';
  const visit = (list) => {
    for (const n of list ?? []) {
      if (n.type === 'text') out += n.value ?? '';
      if (n.children) visit(n.children);
    }
  };
  visit(node.children);
  return out.trim();
}

// 为标题挂载锚点并生成大纲，同时建立节点与大纲的从属从属关系
function withOutlines(doc) {
  const outlines = [];
  let i = 0;
  let currentAnchor = '';

  const attachAnchor = (node, anchor) => {
    if (!node) return;
    if (anchor) node.outlineAnchor = anchor;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        attachAnchor(child, anchor);
      }
    }
  };

  for (const node of doc?.children ?? []) {
    if (!node) continue;
    if (node.type === 'heading') {
      const title = headingText(node);
      if (!title) continue;
      node.anchor = `doc-h${i++}`;
      currentAnchor = node.anchor;
      outlines.push({ id: node.anchor, title, level: node.level ?? 1 });
    } else if (currentAnchor) {
      attachAnchor(node, currentAnchor);
    }
  }
  return outlines;
}

// 解析可能为字符串形式的 JSON 字段
function parseJsonField(val, fallback) {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val ?? fallback;
}

// 规范化动画数据
function normalizeAnimation(anim) {
  if (!anim) return null;
  const enabled = anim.enabled !== undefined ? Boolean(anim.enabled) : true;
  if (!enabled) return null;
  return {
    ...anim,
    enabled: true,
    steps: parseJsonField(anim.steps, []),
    cues: parseJsonField(anim.cues, []),
    parts: parseJsonField(anim.parts, []),
    config: parseJsonField(anim.config, { crop: { x: 0, y: 0, w: 1920, h: 960 } })
  };
}

// 获取小节正文与大纲模型
export async function getCourseSectionContent(courseKey, sectionId) {
  const data = await getCourseSectionDoc(sectionId);
  const rawDoc = structuredClone(data.doc ?? { type: 'doc', children: [] });
  const keyStr = String(courseKey || '');
  const cachedTree = treeCache.get(keyStr);
  const slug = data.course_slug || cachedTree?.slug || keyStr;
  const doc = await adaptDocWithPreset(rawDoc, slug);

  return {
    id: data.id,
    title: data.title,
    lead: data.summary || '',
    updatedAt: data.updated_at || data.created_at || null,
    outlines: withOutlines(doc),
    doc,
    animation: normalizeAnimation(data.animation)
  };
}

// 全文搜索讲义与课程节点
export async function searchLectures(q, limit = 20) {
  const trimmed = String(q || '').trim();
  if (!trimmed) return [];
  try {
    const res = await request(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
    return Array.isArray(res?.hits) ? res.hits : [];
  } catch (error) {
    console.warn('[API] 全文检索请求异常:', error);
    return [];
  }
}

// 获取随机搜索推荐讲义小节
export async function fetchSearchRecommendations(limit = 6) {
  try {
    const res = await request(`/api/search/recommendations?limit=${limit}`);
    return Array.isArray(res?.hits) ? res.hits : [];
  } catch (error) {
    console.warn('[API] 获取搜索推荐异常:', error);
    return [];
  }
}
