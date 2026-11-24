import { knowledgeApi } from '../../../api/knowledge.js';
import { getMasteredIds } from '../../../utils/knowledge-mastery.js';
import { text } from './shared.js';

export const masteryTool = {
  type: 'function',
  function: {
    name: 'get_learning_mastery',
    description:
      '仅当用户明确询问自己的知识点掌握标记或学习情况时，读取本浏览器的掌握标记并统计；不能推断真实能力或正确率。',
    parameters: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: '可选的知识库分类名或知识点名称；查询全部时省略'
        }
      },
      additionalProperties: false
    }
  }
};

export function validateMasteryArguments(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== 'scope') ||
    (value.scope !== undefined && typeof value.scope !== 'string')
  ) {
    throw new Error('掌握统计参数无效');
  }
  const scope = (value.scope || '').trim();
  if (scope.length > 120 || /[\r\n]/.test(scope)) {
    throw new Error('掌握统计范围无效');
  }
  return scope;
}

export async function getLearningMastery(scope, signal) {
  const [graph, marked] = await Promise.all([
    knowledgeApi.map(undefined, {
      signal
    }),
    getMasteredIds()
  ]);
  if (signal.aborted) {
    throw new DOMException('请求已取消', 'AbortError');
  }
  if (!Array.isArray(graph?.nodes) || !Array.isArray(graph?.categories)) {
    throw new Error('知识库数据格式无效');
  }
  const term = scope.toLocaleLowerCase();
  const categories = graph.categories;
  const selected = new Set(
    categories
      .filter(
        (item) =>
          term &&
          String(item.name || '')
            .toLocaleLowerCase()
            .includes(term)
      )
      .map((item) => String(item.id))
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (selected.has(String(category.parent_id)) && !selected.has(String(category.id))) {
        selected.add(String(category.id));
        changed = true;
      }
    }
  }
  const unique = new Map();
  for (const node of graph.nodes) {
    if (typeof node.slug !== 'string' || !node.slug) {
      continue;
    }
    const inScope =
      !term ||
      String(node.title || '')
        .toLocaleLowerCase()
        .includes(term) ||
      String(node.slug).toLocaleLowerCase().includes(term) ||
      (Array.isArray(node.category_ids) &&
        node.category_ids.some((id) => selected.has(String(id))));
    if (inScope) {
      unique.set(node.slug, node);
    }
  }
  const nodes = [...unique.values()];
  const mastered = nodes.filter((node) => marked.has(node.slug));
  return {
    scope: scope || '全部可见知识点',
    total: nodes.length,
    marked_mastered: mastered.length,
    unmarked: nodes.length - mastered.length,
    examples: mastered.slice(0, 30).map((node) => ({
      reference: `知识点:${text(node.slug, 120)}`,
      title: text(node.title, 200)
    })),
    unmarked_examples: nodes
      .filter((node) => !marked.has(node.slug))
      .slice(0, 30)
      .map((node) => ({
        reference: `知识点:${text(node.slug, 120)}`,
        title: text(node.title, 200)
      })),
    note: '数据来自当前浏览器的用户手动标记；未标记不代表未掌握，不能据此推断正确率或实际能力。'
  };
}
