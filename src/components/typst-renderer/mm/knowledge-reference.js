import { knowledgeApi } from '../../../api/knowledge.js';

const pending = new Map();
export function getReferencedKnowledge(slug) {
  if (pending.has(slug)) {
    return pending.get(slug);
  }
  const request = knowledgeApi.getBySlug(slug).finally(() => {
    if (pending.get(slug) === request) {
      pending.delete(slug);
    }
  });
  pending.set(slug, request);
  return request;
}
