// 知识图谱数据生成器

export const CHAPTER_PALETTE = [
  '#10b981', // 翡翠绿
  '#3b82f6', // 科技蓝
  '#06b6d4', // 蔚蓝
  '#8b5cf6', // 紫罗兰
  '#ec4899', // 洋红
  '#f59e0b', // 琥珀金
  '#14b8a6', // 青碧
  '#f43f5e', // 绯红
  '#6366f1',
  '#84cc16'
];

export const NODE_TYPE_COLORS = {
  def: '#3b82f6',
  thm: '#ef4444',
  prop: '#06b6d4',
  method: '#8b5cf6',
  note: '#64748b',
  example: '#f59e0b',
  exercise: '#10b981'
};

export const NODE_TYPE_LABELS = {
  chapter: '大编/大章',
  section: '讲次/小节',
  def: '定义',
  thm: '定理',
  prop: '命题',
  method: '核心方法',
  note: '备忘注记',
  example: '典型例题',
  exercise: '真题演练'
};

// 根据课程数据生成多层级关系图
export function buildGraphFromCourseBundle(bundle) {
  if (!bundle || !bundle.chapters) {
    return { nodes: [], links: [], chapters: [] };
  }

  const nodes = [];
  const links = [];
  const chapters = bundle.chapters;
  const N = bundle.N || {};
  const chEdges = bundle.graph?.edges || [];

  const nodeMap = new Map();

  // 生成第一层大编节点
  chapters.forEach((chap, idx) => {
    const color = CHAPTER_PALETTE[idx % CHAPTER_PALETTE.length];
    const chapNode = {
      id: chap.id,
      title: chap.title,
      tag: chap.tag,
      label: chap.tag ? `${chap.tag} ${chap.title}` : chap.title,
      level: 1,
      type: 'chapter',
      color,
      radius: 22,
      sectionsCount: chap.sections?.length || 0,
      prereqText: chap.prereqText,
      desc: chap.prereqText ? `前置要求：${chap.prereqText}` : '基础起点，随时可学',
      chapterId: chap.id
    };
    nodes.push(chapNode);
    nodeMap.set(chap.id, chapNode);
  });

  // 生成大章前置依赖边
  chEdges.forEach(([fromId, toId]) => {
    if (nodeMap.has(fromId) && nodeMap.has(toId)) {
      links.push({
        source: fromId,
        target: toId,
        type: 'prereq',
        level: 1,
        label: '前置依赖'
      });
    }
  });

  // 生成第二层讲次节点
  chapters.forEach((chap, cIdx) => {
    const chapColor = CHAPTER_PALETTE[cIdx % CHAPTER_PALETTE.length];
    const sections = chap.sections || [];

    sections.forEach((sec, sIdx) => {
      const shortTitle = sec.title.length > 8 ? sec.title.slice(0, 8) + '..' : sec.title;

      const secNode = {
        id: sec.id,
        title: sec.title,
        label: shortTitle,
        level: 2,
        type: 'section',
        parentId: chap.id,
        chapterId: chap.id,
        color: chapColor,
        radius: 12,
        desc: sec.desc || `${chap.tag || ''} 对应讲次`,
        nodesCount: sec.nodes?.length || 0,
        order: sIdx
      };
      nodes.push(secNode);
      nodeMap.set(sec.id, secNode);

      // 大章与小节归属连接
      links.push({
        source: chap.id,
        target: sec.id,
        type: 'cluster',
        level: 2
      });

      // 同章讲次顺序连接
      if (sIdx > 0) {
        const prevSec = sections[sIdx - 1];
        links.push({
          source: prevSec.id,
          target: sec.id,
          type: 'sequence',
          level: 2,
          label: '顺序'
        });
      }
    });
  });

  // 生成第三层知识点节点
  chapters.forEach((chap) => {
    const sections = chap.sections || [];
    sections.forEach((sec) => {
      const leafNodeIds = (sec.nodes || []).slice(0, 3);
      leafNodeIds.forEach((nid) => {
        const n = N[nid];
        if (!n || nodeMap.has(nid)) return;

        const nodeType = n.type || 'def';
        const color = NODE_TYPE_COLORS[nodeType] || '#64748b';
        const leafTitle = n.title || nid;
        const shortLeaf = leafTitle.length > 7 ? leafTitle.slice(0, 7) + '..' : leafTitle;

        const leafNode = {
          id: nid,
          title: leafTitle,
          label: shortLeaf,
          level: 3,
          type: nodeType,
          parentId: sec.id,
          chapterId: chap.id,
          color,
          radius: 6,
          desc: `${NODE_TYPE_LABELS[nodeType] || '知识点'} · 所属 ${sec.title}`,
          deps: n.deps || []
        };

        nodes.push(leafNode);
        nodeMap.set(nid, leafNode);

        // 小节与知识点归属连接
        links.push({
          source: sec.id,
          target: nid,
          type: 'leaf',
          level: 3
        });
      });
    });
  });

  // 节点间引用关系连接
  nodes.forEach(n => {
    if (n.level === 3 && Array.isArray(n.deps)) {
      n.deps.forEach(depId => {
        if (nodeMap.has(depId)) {
          links.push({
            source: depId,
            target: n.id,
            type: 'dep',
            level: 3
          });
        }
      });
    }
  });

  return { nodes, links, chapters };
}
