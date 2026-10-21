import { request } from './client.js';
import { transformCourseCategories, adaptDoc } from '../utils/index.js';

// 内存单例缓存：课程树 / 小节正文 / 图谱，避免同一门课反复解析几十 KB 的讲义
const treeCache = new Map();
const docCache = new Map();
const graphCache = new Map();

/**
 * 获取知识库所有大类及课程列表
 * 后端 /api/categories 与 /api/courses 都返回扁平数组，这里按 category_id 归组后交给适配器
 */
export async function getCourseCategories() {
  try {
    const [cats, courses] = await Promise.all([
      request('/api/categories'),
      request('/api/courses')
    ]);
    if (!Array.isArray(cats)) return [];

    // 按 category_id 把课程归到各自分类下
    const grouped = new Map();
    for (const course of Array.isArray(courses) ? courses : []) {
      const key = String(course.category_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({
        // 路由与课程接口都按 slug 取课程
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

/**
 * 课程树：课程元信息 + 分类 + 章 / 小节目录 + 章节级前置边
 * 一次请求就够课程主页与讲义导航用
 */
export async function fetchCourseTree(slug) {
  if (!slug) throw new Error('缺少课程 slug');
  const key = String(slug);
  if (treeCache.has(key)) return treeCache.get(key);

  const tree = await request(`/api/courses/by-slug/${encodeURIComponent(key)}/tree`);
  treeCache.set(key, tree);
  return tree;
}

/**
 * 把后端的章节树转成前端统一的章节模型（课程主页与讲义导航共用）
 */
function toChapters(tree) {
  const list = Array.isArray(tree?.chapters) ? tree.chapters : [];
  const byId = new Map(list.map((c) => [c.id, c]));

  // edges 是 [前置章节 id, 后继章节 id]
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
      id: ch.id,
      slug: ch.slug,
      tag: ch.tag || '',
      title: ch.title,
      summary: ch.summary || '',
      hasIntro: Boolean(ch.has_intro),
      sections: (ch.sections ?? []).map((s) => ({
        id: s.id,
        slug: s.slug,
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
        : '起点 // 随时可学',
      isOrigin: prereqs.length === 0
    };
  });
}

/**
 * 课程数据包：课程元信息 + 章节模型，课程主页与讲义页共用
 */
export async function fetchCourseBundle(slug = 'kaoyan') {
  const tree = await fetchCourseTree(slug);
  const chapters = toChapters(tree);

  return {
    slug: tree.slug,
    course: {
      // 路由 /course/:courseId 走 slug，所以 id 就是 slug
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
      // 小节总数，课程主页概览卡片用
      nodes: chapters.reduce((n, c) => n + c.sections.length, 0)
    },
    chapters,
    edges: tree.edges ?? []
  };
}

/**
 * 根据 slug 获取单个课程详情及所属分类；课程不存在时返回 null
 */
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

/**
 * 获取指定课程的章节目录树
 */
export async function getCourseChapters(slug = 'kaoyan') {
  try {
    const bundle = await fetchCourseBundle(slug);
    return bundle.chapters;
  } catch (error) {
    console.error(`[API] 加载课程 ${slug} 目录失败:`, error);
    return [];
  }
}

/**
 * 同步快速获取已缓存的章节树（若未缓存则返回空数组，触发异步预热）
 */
export function getCachedCourseChapters(slug = 'kaoyan') {
  const key = String(slug);
  if (treeCache.has(key)) return toChapters(treeCache.get(key));
  // 异步预热
  fetchCourseBundle(key);
  return [];
}

/**
 * 小节正文：后端已把 Typst 源文解析成结构化文档树，数学节点带 latex
 */
export async function getCourseSectionDoc(sectionId) {
  const key = String(sectionId);
  if (docCache.has(key)) return docCache.get(key);

  const data = await request(`/api/sections/${encodeURIComponent(key)}/doc`);
  docCache.set(key, data);
  return data;
}

// 标题节点的纯文本：优先用后端拍平的 text，否则递归拼 children
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

/**
 * 给顶层标题挂锚点并抽出右侧大纲。
 * 大纲项靠 document.getElementById 滚动定位，所以锚点必须写进文档树里。
 */
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

/**
 * 根据 sectionId 获取讲义正文模型（文档树 + 右侧大纲）
 */
export async function getCourseSectionContent(slug, sectionId) {
  const data = await getCourseSectionDoc(sectionId);
  const rawDoc = data.doc ?? { type: 'doc', children: [] };
  const doc = adaptDoc(rawDoc, slug);

  return {
    id: data.id,
    title: data.title,
    lead: data.summary || '',
    outlines: withOutlines(doc),
    doc
  };
}

/**
 * 知识图谱数据：章节 + 小节 + 知识点三层，形状与 roadmap-generator 期望的一致
 */
export async function fetchCourseGraph(slug = 'kaoyan') {
  const key = String(slug);
  if (graphCache.has(key)) return graphCache.get(key);

  const g = await request(`/api/courses/by-slug/${encodeURIComponent(key)}/graph`);
  const edges = g.edges ?? [];

  // 给章节补上前置文案，roadmap-generator 直接读 chap.prereqText
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
      prereqText: labels.length ? `学完 ${labels.join('、')} 后可学` : '起点 // 随时可学'
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
