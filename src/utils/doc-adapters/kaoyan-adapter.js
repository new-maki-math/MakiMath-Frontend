/**
 * 考研数学讲义适配器 (Kaoyan Doc Adapter)
 * 负责将考研数学的 Typst 方言宏映射为 MakiTheme 前端视图模型
 */
import { transformDefaultNode } from './default-adapter.js';

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

// 标签颜色映射
const KAOYAN_TAGS = {
  tgblue: 'blue',
  tgred: 'red',
  tggreen: 'green',
  tgorange: 'orange',
  tggray: 'gray',
};

export function transformKaoyanNode(node) {
  if (!node || typeof node !== 'object') return node;

  // 兼容：如果后端仍是旧版输出的 box/panel/tag/zt/lec 等，直接走子递归
  if (node.type !== 'call') {
    return transformDefaultNode(node);
  }

  const { name, args = {}, bodies = [] } = node;
  const named = args.named || {};
  const positional = args.positional || [];

  // 1. 盒子指令 (defbox, thmbox, exbox, warnbox, jielun, note)
  if (KAOYAN_BOXES[name]) {
    let title = named.title || null;
    let content = [];

    if (bodies.length >= 2) {
      // #defbox[标题][内容] 写法
      title = bodies[0];
      content = bodies[1];
    } else if (bodies.length === 1) {
      content = bodies[0];
    }

    return {
      type: 'box',
      kind: KAOYAN_BOXES[name],
      title: typeof title === 'string' ? title : null,
      children: content.map(transformKaoyanNode),
    };
  }

  // 2. 侧栏面板 (kaopin, zuoye)
  if (KAOYAN_PANELS[name]) {
    return {
      type: 'panel',
      kind: KAOYAN_PANELS[name],
      children: (bodies[0] || []).map(transformKaoyanNode),
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

  // 4. 讲次大标题 (#lec("01", [], [标题])[正文])
  if (name === 'lec') {
    return {
      type: 'lec',
      num: positional[0] || '',
      title: positional[2] || '',
      tags: [],
      children: (bodies[0] || []).map(transformKaoyanNode),
    };
  }

  // 5. 彩色标签 (#tgblue[高数], #tgred[必考])
  if (KAOYAN_TAGS[name]) {
    const text = bodies[0] || positional[0] || '';
    return {
      type: 'tag',
      color: KAOYAN_TAGS[name],
      text: typeof text === 'string' ? text : '',
    };
  }

  // 未命中的其它 call 走通用兜底，绝不丢内容
  return transformDefaultNode(node);
}

export function transformKaoyanDoc(doc) {
  if (!doc || !Array.isArray(doc.children)) return doc;
  return {
    ...doc,
    children: doc.children.map(transformKaoyanNode),
  };
}
