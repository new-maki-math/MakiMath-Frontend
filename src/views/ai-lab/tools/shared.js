export const searchSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: '简短的中文或英文搜索关键词'
    }
  },
  required: ['query'],
  additionalProperties: false
};

export function validateQuery(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== 'query') ||
    typeof value.query !== 'string'
  ) {
    throw new Error('搜索参数无效');
  }
  const query = value.query.trim();
  if (!query || query.length > 120 || /[\r\n]/.test(query)) {
    throw new Error('搜索关键词无效');
  }
  return query;
}
export function text(value, length = 2500) {
  return typeof value === 'string' ? value.slice(0, length) : '';
}
