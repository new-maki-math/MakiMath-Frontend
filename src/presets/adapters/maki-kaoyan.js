/**
 * 考研数学讲义适配器 (Kaoyan Doc Adapter)
 * 负责将考研数学的 Typst 方言宏映射为 MakiTheme 前端视图模型
 */
import { transformDefaultNode } from './default.js';

// 盒子家族映射
const KAOYAN_BOXES = {
  defbox: 'def',
  thmbox: 'thm',
  warnbox: 'warn',
  exbox: 'ex',
  jielun: 'concl',
  note: 'note',
};

// 侧栏面板映射
const KAOYAN_PANELS = {
  kaopin: 'kaopin',
  zuoye: 'zuoye',
};

// 标签内容到语义颜色的内置映射字典
const CONTENT_TAG_COLORS = {
  '统': 'gray',
  '压缩讲': 'gray',
  '一三': 'blue',
  '仅一': 'red',
  '重点讲': 'red',
  '仅三': 'green',
  '二重': 'orange',
};

// 标签颜色映射
const KAOYAN_TAGS = {
  tgblue: 'blue',
  tgred: 'red',
  tggreen: 'green',
  tgorange: 'orange',
  tggray: 'gray',
};

// 递归提取节点列表中的纯文本
function extractPlainText(nodes) {
  if (!nodes) return '';
  if (typeof nodes === 'string') return nodes;
  if (!Array.isArray(nodes)) return '';
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') out += n.value;
    else if (n.type === 'tag') out += n.text;
    else if (n.type === 'math') out += n.typst;
    else if (n.children) out += extractPlainText(n.children);
    else if (n.bodies) for (const b of n.bodies) out += extractPlainText(b);
  }
  return out.trim();
}

// 收集标签
function extractTags(nodes) {
  if (!Array.isArray(nodes)) return [];
  const tags = [];
  for (const n of nodes) {
    if (n.type === 'tag') {
      tags.push(n);
    } else if (n.type === 'call') {
      if (KAOYAN_TAGS[n.name]) {
        const text = n.bodies?.[0] ? extractPlainText(n.bodies[0]) : (n.args?.positional?.[0] || '');
        const clean = String(text).replace(/^["']|["']$/g, '').trim();
        const color = CONTENT_TAG_COLORS[clean] || KAOYAN_TAGS[n.name];
        tags.push({ type: 'tag', color, text: clean });
      } else if (n.name === 'makitag') {
        const p = n.args?.positional || [];
        const text = n.bodies?.[0] ? extractPlainText(n.bodies[0]) : (p[1] || p[0] || '');
        const clean = String(text).replace(/^["']|["']$/g, '').trim();
        const color = CONTENT_TAG_COLORS[clean] || 'gray';
        tags.push({ type: 'tag', color, text: clean });
      }
    } else if (n.children) {
      tags.push(...extractTags(n.children));
    }
  }
  return tags;
}

export function transformKaoyanNode(node) {
  if (!node || typeof node !== 'object') return node;

  // 兼容已有的旧版结构（如果不是 call 节点，递归下探）
  if (node.type !== 'call') {
    return transformDefaultNode(node, transformKaoyanNode);
  }

  const { name, args = {}, bodies = [] } = node;
  const named = args.named || {};
  const positional = args.positional || [];

  // 1. 盒子指令 (defbox, thmbox, exbox, warnbox, jielun, note)
  if (KAOYAN_BOXES[name]) {
    let title = named.title || null;
    let titleChildren = null;
    let content = [];

    if (bodies.length >= 2) {
      // 位置参数写法：#defbox[标题][正文]
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
    if (titleChildren && titleChildren.some(n => n.type !== 'text')) {
      boxNode.titleChildren = titleChildren;
    }
    return boxNode;
  }

  // 2. 侧栏面板 (kaopin, zuoye)
  if (KAOYAN_PANELS[name]) {
    return {
      type: 'panel',
      kind: KAOYAN_PANELS[name],
      children: (bodies[0] || []).map(transformKaoyanNode).filter(Boolean),
    };
  }

  // 3. 真题引证 (#zt("2024", "数一第1题", "zt-101"))
  if (name === 'zt') {
    return {
      type: 'zt',
      source: positional[0] || '',
      title: positional[1] || '',
      id: positional[2] || '',
      statement: null,
    };
  }

  // 4. 讲次大标题 (#lec("01", [#tgred(...)], [标题])[正文])
  if (name === 'lec') {
    const rawTags = bodies[0] || positional[1] || [];
    const rawTitle = bodies[1] || positional[2] || '';
    const content = bodies.length >= 3 ? bodies[2] : (bodies[bodies.length - 1] || []);

    const tagList = extractTags(Array.isArray(rawTags) ? rawTags : [rawTags]);
    const titleText = typeof rawTitle === 'string' ? rawTitle : extractPlainText(rawTitle);

    return {
      type: 'lec',
      num: positional[0] || '',
      title: titleText,
      tags: tagList,
      children: (Array.isArray(content) ? content : []).map(transformKaoyanNode).filter(Boolean),
    };
  }

  // 5. 彩色标签 (#tgblue[高数], #tgred("必考"), #makitag(rgb(...), "统"))
  if (KAOYAN_TAGS[name]) {
    const raw = bodies[0] ? extractPlainText(bodies[0]) : (positional[0] || '');
    const text = String(raw).replace(/^["']|["']$/g, '').trim();
    const color = CONTENT_TAG_COLORS[text] || KAOYAN_TAGS[name];
    return {
      type: 'tag',
      color,
      text,
    };
  }

  if (name === 'makitag') {
    // #makitag(rgb("#6E6E6E"), "统") -> positional[1] 是文本，或者 bodies[0]
    const raw = bodies[0] ? extractPlainText(bodies[0]) : (positional[1] || positional[0] || '');
    const text = String(raw).replace(/^["']|["']$/g, '').trim();
    const color = CONTENT_TAG_COLORS[text] || 'gray';
    return {
      type: 'tag',
      color,
      text,
    };
  }

  // 6. 排版辅助宏
  if (name === 'makipagebreak' || name === 'makiv') {
    return null;
  }
  if (name === 'makih' || name === 'h') {
    return { type: 'text', value: ' ' };
  }
  if (name === 'makicenter' || name === 'makialign') {
    // 提升容器内元素
    const inner = bodies[0] || [];
    return {
      type: 'container',
      align: name === 'makicenter' ? 'center' : (positional[0] || 'left'),
      children: inner.map(transformKaoyanNode).filter(Boolean),
    };
  }

  // 未命中的其它 call 走通用兜底，绝不丢内容
  return transformDefaultNode(node);
}

export function transformKaoyanDoc(doc) {
  if (!doc || !Array.isArray(doc.children)) return doc;
  return {
    ...doc,
    children: doc.children.map(transformKaoyanNode).filter(Boolean),
  };
}
