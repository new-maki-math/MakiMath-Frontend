import { request } from '../../../api/client.js';
import { searchLectures as searchOnline } from '../../../api/courses.js';
import { listLocalLectures } from '../../../utils/local-lectures.js';
import { keywords } from './knowledge.js';
import { searchSchema, text } from './shared.js';

export const lecturesTool = {
  type: 'function',
  function: {
    name: 'search_lectures',
    description:
      '搜索 MakiMath 讲义并读取匹配小节。只有用户明确要求本地讲义或书架内容时才会包含本地资料。',
    parameters: searchSchema
  }
};

function score(value, terms) {
  const content = String(value || '').toLocaleLowerCase();
  return terms.reduce((sum, term) => sum + (content.includes(term) ? term.length : 0), 0);
}
function candidates(chapters, terms, bookTitle) {
  return (Array.isArray(chapters) ? chapters : [])
    .flatMap((chapter) =>
      (Array.isArray(chapter.sections) ? chapter.sections : []).map((section) => ({
        chapter,
        section,
        rank:
          score(`${section.title || ''} ${section.summary || ''} ${chapter.title || ''}`, terms) *
            2 +
          score(bookTitle, terms)
      }))
    )
    .filter((item) => item.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 2);
}
async function readOnlineBook(hit, terms, signal) {
  if (typeof hit.slug !== 'string' || !hit.slug) {
    return null;
  }
  const slug = encodeURIComponent(hit.slug);
  const snapshot = await request(`/api/books/by-slug/${slug}/outline?include_animation=0`, {
    signal,
    cache: 'no-store'
  });
  if (
    snapshot.book?.slug !== hit.slug ||
    !snapshot.revision?.id ||
    !Number.isInteger(snapshot.revision.edit_version) ||
    !Array.isArray(snapshot.chapters)
  ) {
    throw new Error('讲义目录格式无效');
  }
  const sections = await Promise.all(
    candidates(snapshot.chapters, terms, hit.title)
      .filter(({ chapter, section }) => chapter.slug && section.slug)
      .map(async ({ chapter, section }) => {
        const path = `/api/books/by-slug/${slug}/revisions/${encodeURIComponent(snapshot.revision.id)}/chapters/${encodeURIComponent(chapter.slug)}/sections/${encodeURIComponent(section.slug)}?edit_version=${encodeURIComponent(snapshot.revision.edit_version)}`;
        const data = await request(path, {
          signal,
          cache: 'no-store'
        });
        if (
          String(data.revision_id) !== String(snapshot.revision.id) ||
          String(data.occurrence_id) !== String(section.occurrence_id) ||
          data.edit_version !== snapshot.revision.edit_version ||
          typeof data.source !== 'string'
        ) {
          throw new Error('讲义小节版本不匹配');
        }
        return {
          chapter: text(chapter.title, 160),
          title: text(section.title, 160),
          content: text(data.source, 2500)
        };
      })
  );
  return {
    reference: `讲义:${text(hit.slug, 120)}`,
    title: text(hit.title, 200),
    summary: text(hit.descr || hit.summary, 500),
    sections
  };
}
function searchLocal(records, terms) {
  return records
    .filter(
      (book) =>
        (book.kind ?? book.revision?.kind ?? 'lecture') === 'lecture' &&
        typeof book.slug === 'string'
    )
    .map((book) => {
      const title = book.revision?.title || book.title || '';
      const sections = candidates(book.chapters, terms, title).map(({ chapter, section }) => ({
        chapter: text(chapter.title, 160),
        title: text(section.title, 160),
        content: text(section.source, 2500)
      }));
      return {
        reference: `本地讲义:${text(book.slug, 120)}`,
        title: text(title, 200),
        sections
      };
    })
    .filter((book) => book.sections.length)
    .slice(0, 3);
}
export async function searchLectures(query, signal, allowLocal) {
  const terms = keywords(query);
  const jobs = [
    searchOnline(query, 12, {
      signal
    }),
    ...(allowLocal ? [listLocalLectures()] : [])
  ];
  const [online, local] = await Promise.allSettled(jobs);
  if (signal.aborted) {
    throw new DOMException('请求已取消', 'AbortError');
  }
  if (online.status === 'rejected' && (!local || local.status === 'rejected')) {
    throw new Error('讲义检索失败');
  }
  const hits =
    online.status === 'fulfilled'
      ? online.value
          .filter(
            (item) =>
              item.type === 'book' && (item.book_kind ?? item.kind ?? 'lecture') === 'lecture'
          )
          .slice(0, 3)
      : [];
  const details = await Promise.allSettled(hits.map((hit) => readOnlineBook(hit, terms, signal)));
  if (signal.aborted) {
    throw new DOMException('请求已取消', 'AbortError');
  }
  return {
    query,
    online: details
      .filter((item) => item.status === 'fulfilled' && item.value)
      .map((item) => item.value),
    local: local?.status === 'fulfilled' ? searchLocal(local.value, terms) : [],
    warnings: [
      online.status === 'rejected' ? '线上讲义搜索失败' : '',
      details.some((item) => item.status === 'rejected') ? '部分线上讲义读取失败' : '',
      local?.status === 'rejected' ? '本地讲义读取失败' : ''
    ].filter(Boolean)
  };
}
