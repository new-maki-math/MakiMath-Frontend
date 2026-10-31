import { getCourseSectionContent } from '../../../api/courses.js';
import { knowledgeApi } from '../../../api/knowledge.js';
import { lectureApi } from '../../../api/lectures.js';
import { parseDocument } from '../../../components/typst-renderer/typst/parse-document.js';
import { checkExportMetadata } from '../../../utils/lecture-portable.js';
import { fetchShelfLectureTree } from '../../../utils/shelf-lecture.js';

function collectReferences(value, result) {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (value.type === 'mm-knowledge') {
    result.add(value.knowledgeSlug);
  }
  for (const child of Object.values(value)) {
    collectReferences(child, result);
  }
}

async function runQueue(items, task, ensureCurrent) {
  let index = 0;
  const failures = [];
  async function worker() {
    while (index < items.length) {
      ensureCurrent();
      const item = items[index++];
      try {
        await task(item);
        ensureCurrent();
      } catch (error) {
        ensureCurrent();
        const message =
          error.status === 409 ? '讲义版本已变化，请重新准备' : error.message || '加载失败';
        failures.push(`${item.label}：${message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, () => worker()));
  if (failures.length) {
    throw new Error(failures.join('\n'));
  }
}

export async function prepareLecturePrint(context, scope, ensureCurrent, progress) {
  const tree = await fetchShelfLectureTree(context.slug, context.source, context.revisionId);
  ensureCurrent();
  if (context.source === 'local' && !Number.isSafeInteger(tree.localEditVersion)) {
    throw new Error('本地讲义缺少编辑版本，无法确认打印内容一致性');
  }
  if (context.source === 'online') {
    const portable = await lectureApi.exportRevision(tree.revision_id);
    ensureCurrent();
    if (!portable?.lecture || !Array.isArray(portable.chapters)) {
      throw new Error('讲义导出权限检查返回的数据不完整');
    }
    checkExportMetadata(portable?.lecture?.metadata);
  }
  const chapter = tree.chapters.find((item) => item.slug === context.chapterSlug);
  const section = chapter?.sections.find((item) => item.slug === context.sectionSlug);
  if ((scope !== 'lecture' && !chapter) || (scope === 'section' && !section)) {
    throw new Error('当前章节或小节已更新，请重新打开讲义');
  }
  const chapters = (scope === 'lecture' ? tree.chapters : [chapter]).map((item) => ({
    title: item.title,
    sections: (scope === 'section' ? [section] : item.sections).map((entry) => ({
      id: entry.id,
      title: entry.title,
      label: `${item.title} / ${entry.title}`,
      source: ''
    }))
  }));
  const sections = chapters.flatMap((item) => item.sections);
  if (!sections.length) {
    throw new Error('当前范围没有可打印的小节');
  }
  let completed = 0;
  await runQueue(
    sections,
    async (item) => {
      const content = await getCourseSectionContent(context.slug, item.id, tree);
      item.source = content.source;
      progress(`正在读取小节 ${++completed} / ${sections.length}`);
    },
    ensureCurrent
  );
  const slugs = new Set();
  for (const item of sections) {
    ensureCurrent();
    const parsed = parseDocument(item.source);
    if (parsed.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
      throw new Error(`${item.label}：正文解析失败`);
    }
    collectReferences(parsed.nodes, slugs);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const references = new Map();
  const pending = [...slugs].map((slug) => ({
    slug,
    label: `知识点 ${slug}`
  }));
  completed = 0;
  await runQueue(
    pending,
    async (item) => {
      const detail = await knowledgeApi.getBySlug(item.slug);
      if (
        detail?.slug !== item.slug ||
        !Number.isSafeInteger(detail.id) ||
        typeof detail.source !== 'string'
      ) {
        throw new Error('内容不完整');
      }
      const parsed = parseDocument(detail.source);
      const nested = new Set();
      collectReferences(parsed.nodes, nested);
      if (nested.size || parsed.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
        throw new Error('正文包含无法完整打印的嵌套引用或解析错误');
      }
      references.set(item.slug, detail);
      progress(`正在读取知识点 ${++completed} / ${pending.length}`);
    },
    ensureCurrent
  );
  const latest = await fetchShelfLectureTree(context.slug, context.source, context.revisionId);
  ensureCurrent();
  if (
    String(latest.id) !== String(tree.id) ||
    String(latest.revision_id || '') !== String(tree.revision_id || '') ||
    latest.edit_version !== tree.edit_version ||
    latest.localEditVersion !== tree.localEditVersion
  ) {
    throw new Error('讲义版本已变化，请重新准备');
  }
  return {
    title: tree.title,
    subtitle: tree.subtitle || '',
    chapters,
    references,
    version: {
      id: tree.id,
      revisionId: tree.revision_id,
      editVersion: tree.edit_version,
      localEditVersion: tree.localEditVersion
    }
  };
}

export async function verifyLecturePrint(context, version, ensureCurrent) {
  const tree = await fetchShelfLectureTree(context.slug, context.source, context.revisionId);
  ensureCurrent();
  if (
    String(tree.id) !== String(version.id) ||
    String(tree.revision_id || '') !== String(version.revisionId || '') ||
    tree.edit_version !== version.editVersion ||
    tree.localEditVersion !== version.localEditVersion
  ) {
    throw new Error('讲义版本已变化，请重新准备');
  }
  if (context.source === 'online') {
    const portable = await lectureApi.exportRevision(tree.revision_id);
    ensureCurrent();
    if (!portable?.lecture || !Array.isArray(portable.chapters)) {
      throw new Error('讲义导出权限检查返回的数据不完整');
    }
    checkExportMetadata(portable.lecture.metadata);
  }
}
