import { knowledgeApi } from '../../../api/knowledge.js';
import { searchSchema, text } from './shared.js';

export const knowledgeTool = {
  type: 'function',
  function: {
    name: 'search_knowledge',
    description: '搜索 MakiMath 知识库，返回相关知识点及原始内容。',
    parameters: searchSchema
  }
};

export function keywords(query) {
  const parts = query.toLocaleLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]+/g) || [];
  return [
    ...new Set(
      parts.flatMap((part) => {
        if (!/^[\u3400-\u9fff]+$/.test(part) || part.length <= 2) {
          return [part];
        }
        return [
          part,
          ...Array.from(
            {
              length: part.length - 1
            },
            (_, i) => part.slice(i, i + 2)
          )
        ];
      })
    )
  ].slice(0, 24);
}

export async function searchKnowledge(query, signal) {
  const graph = await knowledgeApi.map(undefined, {
    signal
  });
  if (!Array.isArray(graph?.nodes)) {
    throw new Error('知识库数据格式无效');
  }
  const terms = keywords(query);
  const matches = graph.nodes
    .map((node) => {
      const title = String(node.title || '').toLocaleLowerCase();
      const slug = String(node.slug || '').toLocaleLowerCase();
      const score = terms.reduce(
        (total, term) =>
          total + (title.includes(term) ? term.length : 0) + (slug.includes(term) ? 1 : 0),
        0
      );
      return {
        node,
        score
      };
    })
    .filter((item) => item.score > 0 && item.node.id != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const results = await Promise.all(
    matches.map(async ({ node }) => {
      const detail = await knowledgeApi.get(encodeURIComponent(node.id), {
        signal
      });
      return {
        reference: `知识点:${text(String(detail.slug || node.slug || node.id), 120)}`,
        title: text(detail.title || node.title, 200),
        content: text(detail.source)
      };
    })
  );
  return {
    query,
    results
  };
}
