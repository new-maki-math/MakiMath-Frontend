const CHAPTER_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f43f5e',
  '#14b8a6',
  '#a855f7'
];

export function buildLectureGraph(tree) {
  if (!tree || !tree.id) {
    return { nodes: [], links: [] };
  }

  const nodes = [];
  const links = [];

  const courseNodeId = `course-${tree.id}`;
  nodes.push({
    id: courseNodeId,
    rawId: tree.id,
    title: tree.title || '当前课程',
    tag: '课程',
    level: 1,
    type: 'course',
    color: '#f59e0b',
    radius: 22,
    isOrigin: true
  });

  const chapters = Array.isArray(tree.chapters) ? tree.chapters : [];
  chapters.forEach((ch, chIdx) => {
    const chColor = CHAPTER_PALETTE[chIdx % CHAPTER_PALETTE.length];
    const chNodeId = `ch-${ch.id}`;
    nodes.push({
      id: chNodeId,
      rawId: ch.id,
      lectureId: tree.id,
      title: ch.title,
      tag: '',
      level: 2,
      type: 'chapter',
      parentId: courseNodeId,
      chapterIndex: chIdx,
      color: chColor,
      radius: 14,
      sectionsCount: ch.sections?.length || 0
    });

    links.push({
      id: `${courseNodeId}->${chNodeId}`,
      sourceId: courseNodeId,
      targetId: chNodeId,
      level: 2,
      type: 'hierarchy'
    });

    const sections = Array.isArray(ch.sections) ? ch.sections : [];
    sections.forEach((sec) => {
      const secNodeId = `sec-${sec.id}`;
      nodes.push({
        id: secNodeId,
        rawId: sec.id,
        chapterId: ch.id,
        lectureId: tree.id,
        title: sec.title,
        tag: '',
        level: 3,
        type: 'section',
        parentId: chNodeId,
        chapterIndex: chIdx,
        color: chColor,
        radius: 8
      });

      links.push({
        id: `${chNodeId}->${secNodeId}`,
        sourceId: chNodeId,
        targetId: secNodeId,
        level: 3,
        type: 'hierarchy'
      });
    });
  });

  return { nodes, links };
}
