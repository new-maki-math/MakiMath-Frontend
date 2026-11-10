import { validateLocalLectureSlug } from './local-lectures.js';

function object(value, keys, label, optional = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key) && !optional.includes(key)) ||
    keys.some((key) => !(key in value))
  ) {
    throw new Error(`${label}格式不正确`);
  }
}
function string(value, label, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error(`${label}格式不正确`);
  }
}
export function checkExportMetadata(value) {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(checkExportMetadata);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (
      /^(id|user_?id|owner_?id|created_?by|updated_?by|token|access_?token|refresh_?token|authorization|password|secret)$/i.test(
        key
      )
    ) {
      throw new Error('渲染配置包含身份或凭据字段，请先移除后再导入或导出');
    }
    checkExportMetadata(entry);
  }
}
export function validatePortableLecture(data) {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    !['maki-lecture', 'maki-book'].includes(data.type) ||
    data.schema_version !== 1
  ) {
    throw new Error('文件不是支持的讲义 JSON 格式，请使用讲义工作台导出的文件');
  }
  const legacy = data.type === 'maki-lecture';
  object(data, ['type', 'schema_version', legacy ? 'lecture' : 'book', 'chapters'], '图书文件');
  const lecture = legacy ? data.lecture : data.book;
  object(
    lecture,
    ['slug', 'title', 'subtitle', 'summary', 'metadata', ...(legacy ? [] : ['kind'])],
    '图书信息',
    legacy ? ['kind', 'typst_version'] : []
  );
  validateLocalLectureSlug(lecture.slug);
  string(lecture.title, '图书名称', 200, true);
  string(lecture.subtitle, '副标题', 500);
  string(lecture.summary, '简介', 5000);
  if (lecture.kind !== undefined && !['lecture', 'workbook'].includes(lecture.kind)) {
    throw new Error('图书类型不正确');
  }
  if (
    !lecture.metadata ||
    typeof lecture.metadata !== 'object' ||
    Array.isArray(lecture.metadata)
  ) {
    throw new Error('渲染配置格式不正确');
  }
  if (!Array.isArray(data.chapters) || data.chapters.length > 100) {
    throw new Error('章节数量或格式不正确');
  }
  const chapterSlugs = new Set();
  let count = 0;
  for (const chapter of data.chapters) {
    object(chapter, ['slug', 'tag', 'title', 'summary', 'sections'], '章节');
    string(chapter.slug, '章节标识', 100, true);
    if (chapterSlugs.has(chapter.slug)) {
      throw new Error('章节标识重复');
    }
    chapterSlugs.add(chapter.slug);
    for (const key of ['tag', 'title', 'summary']) {
      string(chapter[key], `章节${key}`, 5000);
    }
    if (!Array.isArray(chapter.sections) || chapter.sections.length > 200) {
      throw new Error('小节数量或格式不正确');
    }
    const sectionSlugs = new Set();
    for (const section of chapter.sections) {
      object(section, ['slug', 'tag', 'title', 'summary', 'source'], '小节', ['animation_source']);
      string(section.slug, '小节标识', 100, true);
      if (sectionSlugs.has(section.slug)) {
        throw new Error('小节标识重复');
      }
      sectionSlugs.add(section.slug);
      for (const key of ['tag', 'title', 'summary']) {
        string(section[key], `小节${key}`, 5000);
      }
      string(section.source, '小节源码', 200000);
      if (section.animation_source !== undefined) {
        string(section.animation_source, '小节动画代码', 32 * 1024 * 1024);
      }
      if (++count > 2000) {
        throw new Error('小节数量超过上限');
      }
    }
  }
  const info = {
    ...lecture
  };
  delete info.typst_version;
  return {
    type: 'maki-book',
    schema_version: 1,
    book: {
      ...info,
      kind: info.kind ?? 'lecture'
    },
    chapters: data.chapters
  };
}
export function localLectureToPortable(record) {
  const revision = record.revision;
  if (!revision || !Array.isArray(record.chapters)) {
    throw new Error('本地讲义数据不完整');
  }
  const metadata = {
    ...(revision.metadata || {})
  };
  if (record.cover) {
    metadata.cover = record.cover;
  }
  return validatePortableLecture({
    type: 'maki-book',
    schema_version: 1,
    book: {
      slug: record.slug,
      title: revision.title,
      subtitle: revision.subtitle || '',
      summary: revision.descr || '',
      kind: record.kind ?? revision.kind ?? 'lecture',
      metadata
    },
    chapters: record.chapters.map((chapter) => ({
      slug: chapter.slug,
      tag: chapter.tag || '',
      title: chapter.title || '',
      summary: chapter.summary || '',
      sections: chapter.sections.map((section) => {
        if (typeof section.source !== 'string' || section.blocks || section.animation != null) {
          throw new Error('本地讲义含不支持导出的旧版内容，请先处理后再导出');
        }
        return {
          slug: section.slug,
          tag: section.tag || '',
          title: section.title || '',
          summary: section.summary || '',
          source: section.source,
          animation_source: section.animation_source || ''
        };
      })
    }))
  });
}
export function portableToLocalLecture(data) {
  const plain = JSON.parse(JSON.stringify(validatePortableLecture(data)));
  const info = plain.book;
  return {
    id: crypto.randomUUID(),
    slug: info.slug,
    kind: info.kind,
    editVersion: 1,
    sourceLectureId: null,
    sourceRevisionId: null,
    cover: typeof info.metadata.cover === 'string' ? info.metadata.cover : '',
    revision: {
      title: info.title,
      subtitle: info.subtitle,
      descr: info.summary,
      category_id: null,
      metadata: info.metadata,
      change_note: ''
    },
    chapters: plain.chapters.map((chapter) => ({
      ...chapter,
      occurrence_id: crypto.randomUUID(),
      sections: chapter.sections.map((section) => ({
        ...section,
        occurrence_id: crypto.randomUUID()
      }))
    }))
  };
}
