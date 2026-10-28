// 我的书架 AST 切片与虚拟文档装订引擎
// 负责从小节的完整 AST 中，按「小节/考点大纲/独立卡片」进行无损裁剪与重新拼装

/**
 * 获取某个 Heading 节点下的所有直接或间接从属节点切片
 * 抽取范围：从当前 heading 开始，直到下一个同级或更高级别的 heading 之前
 */
export function sliceOutlineNodes(doc, outlineAnchor) {
  if (!doc || !Array.isArray(doc.children)) return [];

  const children = doc.children;
  const targetIndex = children.findIndex(
    (n) => n && n.type === 'heading' && n.anchor === outlineAnchor
  );

  if (targetIndex === -1) return [];

  const targetHeading = children[targetIndex];
  const targetLevel = Number(targetHeading.level) || 1;
  const sliced = [targetHeading];

  for (let i = targetIndex + 1; i < children.length; i++) {
    const node = children[i];
    if (!node) continue;

    // 遇到同级或更高层级的 heading 时终止切片（如 targetLevel 为 2，遇到 level 1 或 2 时停）
    if (node.type === 'heading') {
      const nodeLevel = Number(node.level) || 1;
      if (nodeLevel <= targetLevel) {
        break;
      }
    }

    sliced.push(node);
  }

  return sliced;
}

/**
 * 获取某个大纲考点下包含的所有卡片 ID 列表
 */
export function getSubordinateCardIds(doc, outlineAnchor) {
  const nodes = sliceOutlineNodes(doc, outlineAnchor);
  const cardIds = [];

  const visit = (list) => {
    if (!Array.isArray(list)) return;
    for (const node of list) {
      if (!node) continue;
      if (node.cardId) {
        cardIds.push(node.cardId);
      }
      if (Array.isArray(node.children)) {
        visit(node.children);
      }
    }
  };

  visit(nodes);
  return cardIds;
}

/**
 * 根据 cardId 精准定位单个卡片节点
 */
export function sliceSingleCardNode(doc, cardId) {
  if (!doc || !Array.isArray(doc.children)) return null;

  let found = null;
  const visit = (list) => {
    if (!Array.isArray(list) || found) return;
    for (const node of list) {
      if (!node || found) break;
      if (node.cardId === cardId) {
        found = node;
        return;
      }
      if (Array.isArray(node.children)) {
        visit(node.children);
      }
    }
  };

  visit(doc.children);
  return found;
}

/**
 * 根据条目切片规则，从小节 AST 中截取节点数组
 */
export function extractItemSlice(doc, item) {
  if (!doc || !Array.isArray(doc.children)) return [];

  switch (item.scope) {
    case 'section':
      // 整小节：包含该小节的全部内容
      return doc.children;

    case 'outline':
      // 大纲考点节：截取该考点范围内的所有节点
      return sliceOutlineNodes(doc, item.scopeId);

    case 'card': {
      // 独立真题或知识卡片
      const cardNode = sliceSingleCardNode(doc, item.scopeId);
      return cardNode ? [cardNode] : [];
    }

    default:
      return doc.children;
  }
}

/**
 * 将多个讲义条目的切片拼接成一个可供 TypstDoc 渲染的虚拟文档
 */
export function assembleVirtualDoc(itemSlices) {
  const combinedChildren = [];

  for (const { item, nodes } of itemSlices) {
    if (!nodes || nodes.length === 0) continue;

    // 为每个拼装的模块注入轻量级的极客分段标识头
    const blockHeader = {
      type: 'container',
      tag: 'div',
      class: 'td-slice-meta-banner font-mono',
      children: [
        {
          type: 'container',
          tag: 'span',
          class: 'slice-meta-scope-tag',
          children: [
            {
              type: 'text',
              value: item.scope === 'section' ? 'SECTION' : item.scope === 'outline' ? 'OUTLINE' : 'CARD'
            }
          ]
        },
        {
          type: 'container',
          tag: 'span',
          class: 'slice-meta-source',
          children: [
            {
              type: 'text',
              value: `FROM: 《${item.courseTitle}》· ${item.sectionTitle}${item.title && item.title !== item.sectionTitle ? ' // ' + item.title : ''}`
            }
          ]
        }
      ]
    };

    combinedChildren.push(blockHeader);
    combinedChildren.push(...nodes);

    // 块之间注入微细分隔
    combinedChildren.push({
      type: 'container',
      tag: 'div',
      class: 'td-slice-separator',
      children: []
    });
  }

  return {
    type: 'doc',
    children: combinedChildren
  };
}
