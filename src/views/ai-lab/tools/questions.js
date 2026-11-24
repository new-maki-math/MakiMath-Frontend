import { questionApi } from '../../../api/questions.js';
import { searchSchema, text } from './shared.js';

export const questionsTool = {
  type: 'function',
  function: {
    name: 'search_questions',
    description: '搜索 MakiMath 题库，返回相关题目、解答及来源。',
    parameters: searchSchema
  }
};

export async function searchQuestions(query, signal) {
  const data = await questionApi.entries(
    {
      q: query,
      limit: 3,
      offset: 0
    },
    {
      signal
    }
  );
  if (!Array.isArray(data?.items)) {
    throw new Error('题库数据格式无效');
  }
  const results = await Promise.all(
    data.items
      .filter((item) => item.question_id != null)
      .slice(0, 3)
      .map(async (item) => {
        const detail = await questionApi.detail(item.question_id, {
          signal
        });
        const question = detail?.question;
        if (!question) {
          throw new Error('题目详情格式无效');
        }
        return {
          reference: `题目:${text(String(question.slug || item.question_id), 120)}`,
          title: text(item.source_number || item.slug, 200),
          stem: text(question.stem_source),
          solution: text(question.solution_source),
          conclusion: text(question.conclusion_source, 1000),
          sources: (Array.isArray(detail.sources) ? detail.sources : [])
            .slice(0, 3)
            .map((source) => ({
              path: (Array.isArray(source.path) ? source.path : [])
                .map((part) => text(part.name, 100))
                .join(' / '),
              number: text(source.source_number, 80)
            }))
        };
      })
  );
  return {
    query,
    results
  };
}
