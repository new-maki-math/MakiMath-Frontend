// 讲义专属预设适配器与专属样式动态加载器
const adapterModules = import.meta.glob('../presets/adapters/*.js');
const styleModules = import.meta.glob('../presets/styles/*.css', { query: '?inline', import: 'default' });

const adapterCache = new Map();
const injectedStyleIds = new Set();

// 归一化课程 slug
export function sanitizeSlug(slug) {
  if (typeof slug !== 'string') return '';
  return slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

// 动态匹配并获取专属讲义适配器转换函数（每门讲义独占专属解析器）
export async function getPresetAdapter(slug) {
  const clean = sanitizeSlug(slug);
  const specificPath = `../presets/adapters/${clean}.js`;

  if (clean && adapterModules[specificPath]) {
    if (!adapterCache.has(clean)) {
      const mod = await adapterModules[specificPath]();
      const fn = mod.transformDoc || mod.transformKaoyanDoc || mod.default;
      adapterCache.set(clean, fn);
    }
    return adapterCache.get(clean);
  }

  return doc => doc;
}

// 动态注入对应讲义的专属样式表（每门讲义独占专属样式）
export async function loadPresetStyle(slug) {
  const clean = sanitizeSlug(slug);
  if (!clean) return;

  const stylePath = `../presets/styles/${clean}.css`;
  const elementId = `maki-preset-style-${clean}`;

  if (document.getElementById(elementId) || !styleModules[stylePath]) return;

  try {
    const cssContent = await styleModules[stylePath]();
    if (typeof cssContent === 'string' && !document.getElementById(elementId)) {
      const styleEl = document.createElement('style');
      styleEl.id = elementId;
      styleEl.setAttribute('data-preset', clean);
      styleEl.textContent = cssContent;
      document.head.appendChild(styleEl);
      injectedStyleIds.add(elementId);
    }
  } catch (err) {
    console.warn(`[PresetLoader] 加载讲义专属样式失败: ${stylePath}`, err);
  }
}

// 统一调度接口：加载专属样式并转换文档 AST
export async function adaptDocWithPreset(doc, slug) {
  if (!doc || !Array.isArray(doc.children)) return doc;
  const [adapter] = await Promise.all([
    getPresetAdapter(slug),
    loadPresetStyle(slug),
  ]);
  return adapter(doc);
}

export default {
  sanitizeSlug,
  getPresetAdapter,
  loadPresetStyle,
  adaptDocWithPreset,
};
