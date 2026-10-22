// 考研讲义适配器

// 盒子宏映射
const KAOYAN_BOXES = Object.freeze({
  defbox: 'def',
  thmbox: 'thm',
  warnbox: 'warn',
  exbox: 'ex',
  jielun: 'concl',
  note: 'note',
  kaopin: 'kaopin',
  zuoye: 'zuoye'
});

// 快捷标签映射
const KAOYAN_TAGS = Object.freeze({ tgblue: 'blue', tgred: 'red', tggreen: 'green', tgorange: 'orange', tggray: 'gray' });

// 提取颜色值
function extractColorValue(raw) {
  if (!raw) return 'gray';
  const str = String(raw).trim();
  const m = /rgb\(\s*["']?(#[0-9a-fA-F]{3,8})["']?\s*\)|["']?(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)["']?/.exec(str);
  return m ? (m[1] || m[2]) : 'gray';
}

// 递归提取纯文本
function extractPlainText(nodes) {
  if (!nodes) return '';
  if (typeof nodes === 'string') return nodes.trim();
  if (!Array.isArray(nodes)) return '';
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') out += n.value;
    else if (n.type === 'tag') out += ` ${n.text} `;
    else if (n.type === 'math') out += n.typst;
    else if (n.type === 'call') {
      const p = n.args?.positional || [];
      out += ` ${extractPlainText(n.bodies?.[0] ? extractPlainText(n.bodies[0]) : (p[1] || p[0] || ''))} `;
    } else if (n.children) out += extractPlainText(n.children);
    else if (n.bodies) for (const b of n.bodies) out += extractPlainText(b);
  }
  return out.replace(/\s+/g, ' ').trim();
}

// 递归收集标签节点
function extractTags(nodes) {
  if (!Array.isArray(nodes)) return [];
  const tags = [];
  for (const n of nodes) {
    if (n.type === 'tag') {
      tags.push(n);
    } else if (n.type === 'call') {
      if (KAOYAN_TAGS[n.name]) {
        tags.push({ type: 'tag', color: KAOYAN_TAGS[n.name], text: extractPlainText(n.bodies?.[0] || n.args?.positional?.[0] || '') });
      } else if (n.name === 'makitag') {
        const p = n.args?.positional || [];
        tags.push({ type: 'tag', color: extractColorValue(p[0]), text: extractPlainText(n.bodies?.[0] || p[1] || p[0] || '') });
      }
    } else if (n.children) {
      tags.push(...extractTags(n.children));
    }
  }
  return tags;
}

// 递归处理子节点
function transformChildren(node) {
  if (!node || typeof node !== 'object') return node;
  const next = { ...node };

  if (Array.isArray(next.children)) {
    next.children = next.children.map(transformKaoyanNode).filter(Boolean);
  }
  if (Array.isArray(next.items)) {
    next.items = next.items.map(it => ({
      ...it,
      children: Array.isArray(it.children) ? it.children.map(transformKaoyanNode).filter(Boolean) : []
    }));
  }
  if (Array.isArray(next.rows)) {
    next.rows = next.rows.map(row =>
      Array.isArray(row)
        ? row.map(cell => ({
            ...cell,
            children: Array.isArray(cell.children) ? cell.children.map(transformKaoyanNode).filter(Boolean) : []
          }))
        : row
    );
  }

  return next;
}

// 节点转换核心
function transformKaoyanNode(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.type !== 'call') return transformChildren(node);

  const { name, args = {}, bodies = [] } = node;
  const named = args.named || {};
  const positional = args.positional || [];

  // 盒子指令
  if (KAOYAN_BOXES[name]) {
    let title = named.title || null;
    let titleChildren = null;
    let content = [];

    if (bodies.length >= 2) {
      titleChildren = bodies[0].map(transformKaoyanNode).filter(Boolean);
      title = extractPlainText(titleChildren);
      content = bodies[1];
    } else if (bodies.length === 1) {
      content = bodies[0];
      if (title && typeof title === 'object') {
        titleChildren = (Array.isArray(title) ? title : [title]).map(transformKaoyanNode).filter(Boolean);
        title = extractPlainText(titleChildren);
      }
    }

    const boxNode = {
      type: 'box',
      kind: KAOYAN_BOXES[name],
      title: typeof title === 'string' ? title : null,
      children: content.map(transformKaoyanNode).filter(Boolean),
    };
    if (titleChildren && titleChildren.some(n => n.type !== 'text')) boxNode.titleChildren = titleChildren;
    return boxNode;
  }

  // 真题引证卡
  if (name === 'zt') {
    const rawSource = extractPlainText(positional[0] ?? named.source ?? '');
    const rawTitle = positional[1] ?? named.title ?? (bodies[0] || '');
    const rawId = extractPlainText(positional[2] ?? named.id ?? '');

    const children = [];

    // 头部区域
    const headChildren = [
      { type: 'tag', color: 'amber', text: '真题' }
    ];
    if (rawSource) {
      headChildren.push({
        type: 'container',
        tag: 'span',
        class: 'td-zt-source',
        children: [{ type: 'text', value: rawSource }]
      });
    }
    children.push({
      type: 'container',
      tag: 'div',
      class: 'td-zt-head',
      children: headChildren
    });

    // 分隔符
    children.push({
      type: 'container',
      tag: 'span',
      class: 'td-zt-sep font-mono',
      children: [{ type: 'text', value: '//' }]
    });

    // 考查要旨描述
    let titleChildren = [];
    if (Array.isArray(rawTitle)) {
      titleChildren = rawTitle.map(transformKaoyanNode).filter(Boolean);
    } else if (rawTitle && typeof rawTitle === 'object') {
      titleChildren = [transformKaoyanNode(rawTitle)].filter(Boolean);
    } else {
      const text = String(rawTitle || '').trim();
      if (text) {
        titleChildren = [{ type: 'text', value: text }];
      }
    }

    if (titleChildren.length > 0) {
      children.push({
        type: 'container',
        tag: 'div',
        class: 'td-zt-title',
        children: titleChildren
      });
    }

    // 真题编号
    if (rawId) {
      const formattedId = rawId.startsWith('#') ? rawId : `#${rawId}`;
      children.push({
        type: 'container',
        tag: 'span',
        class: 'td-zt-id font-mono',
        children: [{ type: 'text', value: formattedId }]
      });
    }

    return {
      type: 'container',
      tag: 'div',
      class: 'td-zt',
      children
    };
  }

  // 讲次卡片
  if (name === 'lec') {
    const num = String(positional[0] ?? named.num ?? '').trim();
    const rawTags = positional[1] ?? (bodies.length >= 3 ? bodies[0] : (named.tags || []));
    const rawTitle = positional[2] ?? (bodies.length >= 2 ? bodies[0] : (named.title || ''));
    const content = bodies[bodies.length - 1] || [];
    const head = [];

    if (num) {
      head.push({
        type: 'tag',
        color: 'blue',
        text: /^[Ll]/.test(num) ? num : `L${num}`
      });
    }
    const tags = extractTags(rawTags);
    for (const t of tags) head.push(t);
    const title = extractPlainText(rawTitle);
    if (title) head.push({ type: 'container', tag: 'span', class: 'td-lec-title', children: [{ type: 'text', value: title }] });

    return {
      type: 'container',
      tag: 'section',
      class: 'td-lec',
      children: [
        { type: 'container', tag: 'header', class: 'td-lec-head', children: head },
        { type: 'container', tag: 'div', class: 'td-lec-body', children: (Array.isArray(content) ? content : [content]).map(transformKaoyanNode).filter(Boolean) }
      ]
    };
  }

  // 标签宏
  if (KAOYAN_TAGS[name]) {
    return { type: 'tag', color: KAOYAN_TAGS[name] || 'gray', text: extractPlainText(bodies[0] ?? (positional[0] || '')) };
  }
  if (name === 'makitag') {
    return { type: 'tag', color: extractColorValue(positional[0]), text: extractPlainText(bodies[0] ?? (positional[1] || positional[0] || '')) };
  }

  // 排版辅助宏
  if (name === 'makipagebreak' || name === 'makiv') return null;
  if (name === 'makih' || name === 'h') return { type: 'text', value: ' ' };
  if (name === 'makicenter' || name === 'makialign') {
    return { type: 'container', align: name === 'makicenter' ? 'center' : (positional[0] || 'left'), children: (bodies[0] || []).map(transformKaoyanNode).filter(Boolean) };
  }

  // 未知宏兜底
  if (bodies.length > 0) {
    const content = bodies[bodies.length - 1] || [];
    return {
      type: 'box',
      kind: name,
      title: named.title || null,
      children: (Array.isArray(content) ? content : [content]).map(transformKaoyanNode).filter(Boolean)
    };
  }

  return transformChildren(node);
}

// 文档转换入口
export function transformKaoyanDoc(doc) {
  if (!doc || !Array.isArray(doc.children)) return doc;
  return { ...doc, children: doc.children.map(transformKaoyanNode).filter(Boolean) };
}

export default transformKaoyanDoc;
