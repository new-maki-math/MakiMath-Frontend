import { request } from './client.js';
import { transformCourseCategories, adaptDocWithPreset } from '../utils/index.js';

// 内存单例缓存
const treeCache = new Map();
const docCache = new Map();
const graphCache = new Map();

// 获取分类与课程列表
export async function getCourseCategories() {
  try {
    const [cats, courses] = await Promise.all([
      request('/api/categories'),
      request('/api/courses')
    ]);
    if (!Array.isArray(cats)) return [];

    // 按分类归组课程
    const grouped = new Map();
    for (const course of Array.isArray(courses) ? courses : []) {
      const key = String(course.category_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({
        id: course.slug || String(course.id),
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
export async function fetchCourseTree(slug) {
  if (!slug) throw new Error('缺少课程 slug');
  const key = String(slug);
  if (treeCache.has(key)) return treeCache.get(key);

  const tree = await request(`/api/courses/by-slug/${encodeURIComponent(key)}/tree`);
  treeCache.set(key, tree);
  return tree;
}

// 转换章节数据模型
function toChapters(tree) {
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
        sourceLen: s.source_len ?? 0
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
export async function fetchCourseBundle(slug = 'kaoyan') {
  const tree = await fetchCourseTree(slug);
  const chapters = toChapters(tree);

  return {
    slug: tree.slug,
    course: {
      id: tree.slug,
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
export async function getCourseById(slug) {
  try {
    const bundle = await fetchCourseBundle(slug);
    return bundle.course;
  } catch (error) {
    if (error?.status === 404) return null;
    console.error(`[API] 加载课程 ${slug} 失败:`, error);
    return null;
  }
}

// 获取课程章节树
export async function getCourseChapters(slug = 'kaoyan') {
  try {
    const bundle = await fetchCourseBundle(slug);
    return bundle.chapters;
  } catch (error) {
    console.error(`[API] 加载课程 ${slug} 目录失败:`, error);
    return [];
  }
}

// 获取缓存的章节树
export function getCachedCourseChapters(slug = 'kaoyan') {
  const key = String(slug);
  if (treeCache.has(key)) return toChapters(treeCache.get(key));
  fetchCourseBundle(key);
  return [];
}

// 获取小节正文文档
export async function getCourseSectionDoc(sectionId) {
  const key = String(sectionId);
  if (docCache.has(key)) return docCache.get(key);

  const data = await request(`/api/sections/${encodeURIComponent(key)}/doc`);
  docCache.set(key, data);
  return data;
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

// 为标题挂载锚点并生成大纲
function withOutlines(doc) {
  const outlines = [];
  let i = 0;
  for (const node of doc?.children ?? []) {
    if (!node || node.type !== 'heading') continue;
    const title = headingText(node);
    if (!title) continue;
    node.anchor = `doc-h${i++}`;
    outlines.push({ id: node.anchor, title, level: node.level ?? 1 });
  }
  return outlines;
}

// 获取小节正文与大纲模型
export async function getCourseSectionContent(slug, sectionId) {
  const data = await getCourseSectionDoc(sectionId);
  const rawDoc = data.doc ?? { type: 'doc', children: [] };
  const doc = await adaptDocWithPreset(rawDoc, slug);

  return {
    id: data.id,
    title: data.title,
    lead: data.summary || '',
    outlines: withOutlines(doc),
    doc
  };
}

// 获取知识图谱数据
export async function fetchCourseGraph(slug = 'kaoyan') {
  const key = String(slug);
  if (graphCache.has(key)) return graphCache.get(key);

  const g = await request(`/api/courses/by-slug/${encodeURIComponent(key)}/graph`);
  const edges = g.edges ?? [];

  // 计算章节前置文案
  const byId = new Map((g.chapters ?? []).map((c) => [c.id, c]));
  const preds = new Map();
  for (const [from, to] of edges) {
    if (!preds.has(to)) preds.set(to, []);
    preds.get(to).push(from);
  }

  const chapters = (g.chapters ?? []).map((ch) => {
    const labels = (preds.get(ch.id) ?? []).map((id) => {
      const p = byId.get(id);
      if (!p) return String(id);
      return p.tag ? `${p.tag} ${p.title}` : p.title;
    });
    return {
      ...ch,
      prereqText: labels.length ? `学完 ${labels.join('、')} 后可学` : '随时可学'
    };
  });

  const bundle = {
    chapters,
    N: g.nodes ?? {},
    graph: { edges, pos: {} }
  };

  graphCache.set(key, bundle);
  return bundle;
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
