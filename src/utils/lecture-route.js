export function lectureNavigationOrigin() {
  const origin = typeof history === 'undefined' ? '' : history.state?.lectureOrigin;
  return ['recom-lecture', 'my-lecture'].includes(origin) ? origin : '';
}

export function lectureLocation({ slug, source = 'online', chapterSlug, sectionSlug, revisionId, origin } = {}) {
  const local = source === 'local';
  const section = chapterSlug != null && chapterSlug !== '' && sectionSlug != null && sectionSlug !== '';
  const query = !local && revisionId != null && revisionId !== '' ? { revision_id: revisionId } : {};
  return {
    name: local ? (section ? 'local-lecture-doc' : 'local-lecture-home') : (section ? 'lecture-doc' : 'lecture-home'),
    params: section ? { lectureSlug: slug, chapterSlug, sectionSlug } : { lectureSlug: slug },
    query,
    ...(origin === 'recom-lecture' || origin === 'my-lecture' ? { state: { lectureOrigin: origin } } : {})
  };
}
