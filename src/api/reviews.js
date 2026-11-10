import { request } from './client.js';
import { invalidateCourseRequests } from './courses.js';

export const reviewApi = {
  pending: (kind) => request(`/api/reviews/${kind}/pending`),
  decide: async (kind, id, decision, comment) => {
    const result = await request(`/api/reviews/${kind}/${id}`, {
      method: 'POST',
      body: {
        decision,
        comment
      }
    });
    invalidateCourseRequests();
    return result;
  }
};
