/**
 * 讲义 AST 适配器分发入口 (Doc Adapters)
 * 将后端返回的语法 AST 或历史 AST 统一转换为前端 View Model
 */
import { transformKaoyanDoc } from './kaoyan-adapter.js';
import { transformDefaultDoc } from './default-adapter.js';

const ADAPTERS = {
  kaoyan: transformKaoyanDoc,
  default: transformDefaultDoc,
};

/**
 * 根据课程类型或 slug 选择对应的适配器转换文档
 * @param {object} doc - 后端返回的 doc AST { type: 'doc', children: [...] }
 * @param {string} courseSlug - 课程标识
 * @returns {object} 转换后的 doc
 */
export function adaptDoc(doc, courseSlug = 'kaoyan') {
  if (!doc || !Array.isArray(doc.children)) return doc;
  
  // 匹配特定课程预设（例如 kaoyan），找不到则使用默认通用适配器
  const adapter = ADAPTERS[courseSlug] || ADAPTERS.default;
  return adapter(doc);
}

export { transformKaoyanDoc, transformDefaultDoc };
