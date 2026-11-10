import { knowledgeApi } from '../../api/knowledge.js';
import { getReferencedQuestion } from '../../components/typst-renderer/mm/question-reference.js';
import { parseDocument } from '../../components/typst-renderer/typst/parse-document.js';

function collect(value, knowledge, questions) {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'mm-knowledge') knowledge.add(value.knowledgeSlug);
  if (value.type === 'mm-question-reference') questions.add(value.questionSlug);
  for (const child of Object.values(value)) collect(child, knowledge, questions);
}

export async function prepareReadingReferences(source, ensureCurrent) {
  const references = { knowledge: new Map(), questions: new Map() };
  const knowledge = new Set();
  const questions = new Set();
  const collectSource = (text) => {
    if (!text) return;
    try {
      collect(parseDocument(text).nodes, knowledge, questions);
    } catch {
      // 渲染器会展示源码及文档诊断，不让解析失败阻止阅读。
    }
  };
  collectSource(source);
  while (true) {
    ensureCurrent();
    const pendingKnowledge = [...knowledge].filter((slug) => !references.knowledge.has(slug));
    const pendingQuestions = [...questions].filter((slug) => !references.questions.has(slug));
    if (!pendingKnowledge.length && !pendingQuestions.length) break;
    const batches = [];
    for (let index = 0; index < pendingKnowledge.length; index += 1000) {
      batches.push(pendingKnowledge.slice(index, index + 1000));
    }
    const [knowledgeResults, questionResults] = await Promise.all([
      Promise.all(batches.map((batch) => knowledgeApi.batch(batch))),
      Promise.all(pendingQuestions.map((slug) => getReferencedQuestion(slug)))
    ]);
    ensureCurrent();
    for (const [index, result] of knowledgeResults.entries()) {
      if (!Array.isArray(result?.points) || !Array.isArray(result?.missing)) throw new Error('知识点引用加载结果不完整');
      const requested = new Set(batches[index]);
      const returned = new Set();
      for (const point of result.points) {
        if (!requested.has(point?.slug) || returned.has(point.slug) || !Number.isSafeInteger(point.id) || point.id < 1 || typeof point.source !== 'string') throw new Error('知识点引用加载结果不完整');
        returned.add(point.slug);
        references.knowledge.set(point.slug, point);
        collectSource(point.source);
      }
      for (const missing of result.missing) {
        if (!requested.has(missing) || returned.has(missing)) throw new Error('知识点引用加载结果不完整');
        returned.add(missing);
        references.knowledge.set(missing, null);
      }
      if (returned.size !== requested.size) throw new Error('知识点引用加载结果不完整');
    }
    for (const [index, detail] of questionResults.entries()) {
      const slug = pendingQuestions[index];
      if (detail && (detail.question?.slug !== slug || !Array.isArray(detail.sources) || !Array.isArray(detail.knowledge_points))) throw new Error('题目引用加载结果不完整');
      references.questions.set(slug, detail);
      if (detail) {
        for (const key of ['stem_source', 'focus_source', 'solution_source', 'conclusion_source', 'pitfalls_source']) collectSource(detail.question[key]);
      }
    }
  }
  return references;
}
