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

// 标签内容到语义颜色的严格内置白名单映射
const EXACT_TAG_COLORS = Object.freeze({
  '统': 'gray',
  '压缩讲': 'gray',
  '一三': 'blue',
  '仅一': 'red',
  '重点讲': 'red',
  '仅三': 'green',
  '二重': 'orange',
});

// 标签宏颜色映射
const KAOYAN_TAGS = {
  tgblue: 'blue',
  tgred: 'red',
  tggreen: 'green',
  tgorange: 'orange',
  tggray: 'gray',
};

// 规范化标签文本（清理引号与前后空格）
function normalizeTagText(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().replace(/^["']|["']$/g, '').trim();
}

// 剥除外层方括号与引号
function unwrapBracketAndQuote(raw) {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (str.startsWith('"') && str.endsWith('"')) {
    str = str.slice(1, -1);
  } else if (str.startsWith('[') && str.endsWith(']')) {
    str = str.slice(1, -1);
  }
  return str.trim();
}

// 清理标题中的宏与多余方括号
function cleanTitleString(str) {
  let s = unwrapBracketAndQuote(str);
  s = s.replace(/#makitag\s*\((?:[^,()]|\([^()]*\))*,\s*(?:["']([^"'\\]*(?:\\.[^"'\\]*)*)["']|\[([^\]]*)\])\s*\)/g, ' $1$2 ');
  s = s.replace(/#(?:tgblue|tgred|tggreen|tgorange|tggray)\s*(?:\(\s*["']([^"'\\]*(?:\\.[^"'\\]*)*)["']\s*\)|\[([^\]]*)\])/g, ' $2$3 ');
  return s.replace(/\s+/g, ' ').trim();
}

// 从原始字符串中提取一个或多个标签 (例如 [#makitag(rgb(...), "统") #makitag(rgb(...), "二重")])
function parseTagsFromRaw(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return extractTags(raw);
  if (typeof raw !== 'string') return [];

  const text = raw.trim();
  const tags = [];

  // 1. 匹配 #makitag(..., "text") 或 #makitag(..., [text])，支持首参嵌套括号如 rgb(...)
  const makitagRegex = /#makitag\s*\((?:[^,()]|\([^()]*\))*,\s*(?:["']([^"'\\]*(?:\\.[^"'\\]*)*)["']|\[([^\]]*)\])\s*\)/g;
  let m;
  while ((m = makitagRegex.exec(text)) !== null) {
    const rawVal = m[1] !== undefined ? m[1] : m[2];
    const tagText = normalizeTagText(rawVal);
    if (tagText) {
      const color = matchTagColor(tagText, 'gray');
      tags.push({ type: 'tag', color, text: tagText });
    }
  }

  // 2. 匹配 #tgblue("text") 或 #tgblue[text]
  const tgRegex = /#(tgblue|tgred|tggreen|tgorange|tggray)\s*(?:\(\s*["']([^"'\\]*(?:\\.[^"'\\]*)*)["']\s*\)|\[([^\]]*)\])/g;
  while ((m = tgRegex.exec(text)) !== null) {
    const macroName = m[1];
    const rawVal = m[2] !== undefined ? m[2] : m[3];
    const tagText = normalizeTagText(rawVal);
    if (tagText) {
      const color = matchTagColor(tagText, KAOYAN_TAGS[macroName]);
      tags.push({ type: 'tag', color, text: tagText });
    }
  }

  return tags;
}

// 严格匹配标签颜色
function matchTagColor(text, fallbackColor = 'gray') {
  const clean = normalizeTagText(text);
  if (Object.prototype.hasOwnProperty.call(EXACT_TAG_COLORS, clean)) {
    return EXACT_TAG_COLORS[clean];
  }
  return fallbackColor;
}

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
        const clean = normalizeTagText(text);
        const color = matchTagColor(clean, KAOYAN_TAGS[n.name]);
        tags.push({ type: 'tag', color, text: clean });
      } else if (n.name === 'makitag') {
        const p = n.args?.positional || [];
        const text = n.bodies?.[0] ? extractPlainText(n.bodies[0]) : (p[1] || p[0] || '');
        const clean = normalizeTagText(text);
        const color = matchTagColor(clean, 'gray');
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
    const num = normalizeTagText(positional[0] || named.num || '');

    let rawTags = null;
    let rawTitle = null;
    let rawContent = null;

    if (bodies.length >= 3) {
      // 罕见旧多方括号写法：#lec("01")[tags][title][content]
      rawTags = bodies[0];
      rawTitle = bodies[1];
      rawContent = bodies[2];
    } else if (bodies.length === 2) {
      // #lec("01", [tags])[title][content]
      rawTags = positional[1] || bodies[0];
      rawTitle = bodies[0] === rawTags ? bodies[1] : bodies[0];
      rawContent = bodies[1];
    } else if (bodies.length === 1) {
      // 标准标准写法：#lec("01", [tags], [title])[content]
      rawTags = positional[1] !== undefined ? positional[1] : (named.tags || '');
      rawTitle = positional[2] !== undefined ? positional[2] : (named.title || '');
      rawContent = bodies[0];
    } else {
      rawTags = positional[1] !== undefined ? positional[1] : (named.tags || '');
      rawTitle = positional[2] !== undefined ? positional[2] : (named.title || '');
      rawContent = [];
    }

    const tagList = Array.isArray(rawTags) ? extractTags(rawTags) : parseTagsFromRaw(rawTags);
    const titleText = typeof rawTitle === 'string' ? cleanTitleString(rawTitle) : extractPlainText(rawTitle);

    return {
      type: 'lec',
      num,
      title: titleText,
      tags: tagList,
      children: (Array.isArray(rawContent) ? rawContent : [rawContent]).map(transformKaoyanNode).filter(Boolean),
    };
  }

  // 5. 彩色标签 (#tgblue[高数], #tgred("必考"), #makitag(rgb(...), "统"))
  if (KAOYAN_TAGS[name]) {
    const raw = bodies[0] ? extractPlainText(bodies[0]) : (positional[0] || '');
    const text = normalizeTagText(raw);
    const color = matchTagColor(text, KAOYAN_TAGS[name]);
    return {
      type: 'tag',
      color,
      text,
    };
  }

  if (name === 'makitag') {
    const raw = bodies[0] ? extractPlainText(bodies[0]) : (positional[1] || positional[0] || '');
    const text = normalizeTagText(raw);
    const color = matchTagColor(text, 'gray');
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
