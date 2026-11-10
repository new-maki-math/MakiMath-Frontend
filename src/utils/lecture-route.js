export function lectureNavigationOrigin() {
  const origin = typeof history === 'undefined' ? '' : history.state?.lectureOrigin;
  return ['recom-lecture', 'my-lecture', 'platform-reviews'].includes(origin) ? origin : '';
}

export function lectureLocation({
  slug,
  source = 'online',
  kind = 'lecture',
  chapterSlug,
  sectionSlug,
  revisionId,
  origin
} = {}) {
  const local = source === 'local';
  const section =
    chapterSlug != null && chapterSlug !== '' && sectionSlug != null && sectionSlug !== '';
  const query =
    !local && revisionId != null && revisionId !== ''
      ? {
          revision_id: revisionId
        }
      : {};
  return {
    name: local
      ? section
        ? 'local-lecture-doc'
        : kind === 'workbook'
          ? 'local-workbook-home'
          : 'local-lecture-home'
      : section
        ? 'lecture-doc'
        : kind === 'workbook'
          ? 'workbook-home'
          : 'lecture-home',
    params: section
      ? {
          lectureSlug: slug,
          chapterSlug,
          sectionSlug
        }
      : {
          lectureSlug: slug
        },
    query,
    ...(['recom-lecture', 'my-lecture', 'platform-reviews'].includes(origin)
      ? {
          state: {
            lectureOrigin: origin
          }
        }
      : {})
  };
}
