/**
 * 默认通用适配器 (Default / Fallback Adapter)
 * 核心原则：内容 0 丢失。将任何未知的语法节点映射为合法的 UI 节点
 */

export function transformDefaultNode(node) {
  if (!node || typeof node !== 'object') return node;

  // 1. 如果是 call 节点（后端纯语法 AST）
  if (node.type === 'call') {
    const { name, args = {}, bodies = [] } = node;
    const named = args.named || {};
    const positional = args.positional || [];

    // 若有内容块，默认映射为块级盒子 box
    if (bodies.length > 0) {
      const contentNodes = bodies[bodies.length - 1] || [];
      const title = named.title || (bodies.length >= 2 ? bodies[0] : null);

      return {
        type: 'box',
        kind: name,
        title: typeof title === 'string' ? title : null,
        children: contentNodes.map(transformDefaultNode),
      };
    }

    // 若没有内容块，但有位置参数或命名参数，作为标签 tag 或文本展示
    const text = positional[0] || named.text || name;
    return {
      type: 'tag',
      color: named.color || 'gray',
      text: String(text),
    };
  }

  // 2. 递归处理包含子节点的结构
  const next = { ...node };

  if (Array.isArray(next.children)) {
    next.children = next.children.map(transformDefaultNode);
  }
  if (Array.isArray(next.items)) {
    next.items = next.items.map(it => ({
      ...it,
      children: Array.isArray(it.children) ? it.children.map(transformDefaultNode) : []
    }));
  }
  if (Array.isArray(next.rows)) {
    next.rows = next.rows.map(row =>
      Array.isArray(row)
        ? row.map(cell => ({
            ...cell,
            children: Array.isArray(cell.children) ? cell.children.map(transformDefaultNode) : []
          }))
        : row
    );
  }

  return next;
}

export function transformDefaultDoc(doc) {
  if (!doc || !Array.isArray(doc.children)) return doc;
  return {
    ...doc,
    children: doc.children.map(transformDefaultNode)
  };
}
