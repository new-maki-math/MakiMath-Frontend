import { knowledgeApi } from '../../../api/knowledge.js';
import { lectureApi } from '../../../api/lectures.js';
import { parseDocument } from '../../../components/typst-renderer/typst/parse-document.js';
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

export async function prepareLecturePrint(context, scope, ensureCurrent, progress) {
  const tree = await fetchShelfLectureTree(context.slug, context.source, context.revisionId);
  ensureCurrent();
  if (context.source === 'local' && !Number.isSafeInteger(tree.localEditVersion)) {
    throw new Error('本地讲义缺少编辑版本，无法确认打印内容一致性');
  }
  const chapter = tree.chapters.find((item) => item.slug === context.chapterSlug);
  const section = chapter?.sections.find((item) => item.slug === context.sectionSlug);
  if ((scope !== 'lecture' && !chapter) || (scope === 'section' && !section)) {
    throw new Error('当前章节或小节已更新，请重新打开讲义');
  }
  const expected = (scope === 'lecture' ? tree.chapters : [chapter]).map((item) => ({
    ...item,
    sections: scope === 'section' ? [section] : item.sections
  }));
  let printChapters = expected;
  let title = tree.title;
  let subtitle = tree.subtitle || '';
  if (context.source === 'online') {
    const params = new URLSearchParams({
      revision_id: String(tree.revision_id),
      edit_version: String(tree.edit_version)
    });
    if (scope !== 'lecture') {
      params.set('chapter_slug', context.chapterSlug);
    }
    if (scope === 'section') {
      params.set('section_slug', context.sectionSlug);
    }
    progress('正在读取打印内容');
    const result = await lectureApi.printData(context.slug, params);
    ensureCurrent();
    if (
      result?.lecture?.slug !== context.slug ||
      String(result?.revision?.id) !== String(tree.revision_id) ||
      result?.revision?.edit_version !== tree.edit_version ||
      !Array.isArray(result.chapters) ||
      result.chapters.length !== expected.length ||
      result.chapters.some(
        (item, index) =>
          item.slug !== expected[index].slug ||
          !Array.isArray(item.sections) ||
          item.sections.length !== expected[index].sections.length ||
          item.sections.some(
            (entry, sectionIndex) =>
              entry.slug !== expected[index].sections[sectionIndex].slug ||
              typeof entry.source !== 'string'
          )
      )
    ) {
      throw new Error('打印内容不完整或讲义版本已变化，请重新准备');
    }
    printChapters = result.chapters;
    title = result.revision.title;
    subtitle = result.revision.subtitle || '';
  }
  const chapters = printChapters.map((item) => ({
    title: item.title,
    sections: item.sections.map((entry) => ({
      title: entry.title,
      label: `${item.title} / ${entry.title}`,
      source: entry.source
    }))
  }));
  const sections = chapters.flatMap((item) => item.sections);
  if (!sections.length) {
    throw new Error('当前范围没有可打印的小节');
  }
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
  const pending = [...slugs];
  for (let index = 0; index < pending.length; index += 1000) {
    ensureCurrent();
    const batch = pending.slice(index, index + 1000);
    progress(`正在读取知识点 ${index} / ${pending.length}`);
    const result = await knowledgeApi.batch(batch);
    ensureCurrent();
    if (!Array.isArray(result?.points) || !Array.isArray(result?.missing)) {
      throw new Error('知识点批量读取结果不完整');
    }
    const requested = new Set(batch);
    const returned = new Set();
    for (const slug of result.missing) {
      if (typeof slug !== 'string' || !requested.has(slug) || returned.has(slug)) {
        throw new Error('知识点批量读取结果不完整');
      }
      returned.add(slug);
    }
    for (const detail of result.points) {
      if (
        !requested.has(detail?.slug) ||
        returned.has(detail.slug) ||
        !Number.isSafeInteger(detail.id) ||
        detail.id < 1 ||
        typeof detail.source !== 'string'
      ) {
        throw new Error('知识点批量读取结果不完整');
      }
      returned.add(detail.slug);
      const parsed = parseDocument(detail.source);
      const nested = new Set();
      collectReferences(parsed.nodes, nested);
      if (nested.size || parsed.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
        throw new Error(`知识点 ${detail.slug} 的正文包含无法完整打印的嵌套引用或解析错误`);
      }
      references.set(detail.slug, detail);
      await new Promise((resolve) => setTimeout(resolve, 0));
      ensureCurrent();
    }
    if (returned.size !== batch.length) {
      throw new Error('知识点批量读取结果不完整');
    }
    if (result.missing.length) {
      throw new Error(`以下知识点不可用，请检查引用：${result.missing.join('、')}`);
    }
    progress(
      `正在读取知识点 ${Math.min(index + batch.length, pending.length)} / ${pending.length}`
    );
  }
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
    title,
    subtitle,
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
}
