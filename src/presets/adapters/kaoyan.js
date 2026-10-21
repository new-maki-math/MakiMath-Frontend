/**
 * 考研数学讲义适配器 (Kaoyan Doc Adapter)
 * 负责将考研数学的 Typst 方言宏映射为 MakiTheme 前端视图模型
 * 
 * @license AGPL-3.0-or-later
 * @author Jason <kxjasonteo@gmail.com>
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

// 标签宏颜色映射
const KAOYAN_TAGS = {
  tgblue: 'blue',
  tgred: 'red',
  tggreen: 'green',
  tgorange: 'orange',
  tggray: 'gray',
};

// 从 Typst 颜色参数中直接提取 Hex 或颜色名 (如 rgb("#B22234") -> #B22234)
function extractColorValue(raw) {
  if (!raw) return 'gray';
  const str = String(raw).trim();
  const rgbMatch = /rgb\(\s*["']?(#[0-9a-fA-F]{3,8})["']?\s*\)/.exec(str);
  if (rgbMatch) return rgbMatch[1];
  const hexMatch = /["']?(#[0-9a-fA-F]{3,8})["']?/.exec(str);
  if (hexMatch) return hexMatch[1];
  const namedMatch = /["']?([a-zA-Z]+)["']?/.exec(str);
  if (namedMatch) return namedMatch[1];
  return 'gray';
}

// 递归提取节点列表中的纯文本
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
      const innerText = n.bodies?.[0] ? extractPlainText(n.bodies[0]) : (p[1] || p[0] || '');
      out += ` ${extractPlainText(innerText)} `;
    }
    else if (n.children) out += extractPlainText(n.children);
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
        const text = n.bodies?.[0] ? extractPlainText(n.bodies[0]) : extractPlainText(n.args?.positional?.[0] || '');
        tags.push({ type: 'tag', color: KAOYAN_TAGS[n.name], text });
      } else if (n.name === 'makitag') {
        const p = n.args?.positional || [];
        const color = extractColorValue(p[0]);
        const text = n.bodies?.[0] ? extractPlainText(n.bodies[0]) : extractPlainText(p[1] || p[0] || '');
        tags.push({ type: 'tag', color, text });
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

  // 4. 讲次大标题 (#lec("01", [#makitag(...)], [标题])[正文])
  if (name === 'lec') {
    const num = String(positional[0] ?? named.num ?? '').trim();
    const rawTags = positional[1] ?? (bodies.length >= 3 ? bodies[0] : (named.tags || []));
    const rawTitle = positional[2] ?? (bodies.length >= 2 ? bodies[0] : (named.title || ''));
    const content = bodies[bodies.length - 1] || [];

    return {
      type: 'lec',
      num,
      title: extractPlainText(rawTitle),
      tags: extractTags(rawTags),
      children: (Array.isArray(content) ? content : [content]).map(transformKaoyanNode).filter(Boolean),
    };
  }

  // 5. 彩色标签 (#tgblue[高数], #tgred("必考"), #makitag(rgb(...), "统"))
  if (KAOYAN_TAGS[name]) {
    const text = extractPlainText(bodies[0] ?? (positional[0] || ''));
    return {
      type: 'tag',
      color: KAOYAN_TAGS[name] || 'gray',
      text,
    };
  }

  if (name === 'makitag') {
    const color = extractColorValue(positional[0]);
    const text = extractPlainText(bodies[0] ?? (positional[1] || positional[0] || ''));
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

export default transformKaoyanDoc;
