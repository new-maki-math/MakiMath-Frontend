// 讲义预设适配器与样式动态加载器
const adapterModules = import.meta.glob('../presets/adapters/*.js');
const styleModules = import.meta.glob('../presets/styles/*.css', { query: '?inline', import: 'default' });

const adapterCache = new Map();
const injectedStyleIds = new Set();

// 归一化课程 slug
export function sanitizeSlug(slug) {
  if (typeof slug !== 'string') return '';
  return slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

// 动态匹配并获取适配器转换函数
export async function getPresetAdapter(slug) {
  const clean = sanitizeSlug(slug);

  // 1. 严格匹配专属课程适配器
  const specificPath = `../presets/adapters/${clean}.js`;
  if (clean && adapterModules[specificPath]) {
    if (!adapterCache.has(clean)) {
      const mod = await adapterModules[specificPath]();
      const fn = mod.transformDoc || mod.transformKaoyanDoc || mod.default;
      adapterCache.set(clean, fn);
    }
    return adapterCache.get(clean);
  }

  // 2. 严格回退到 default.js 默认适配器
  const defaultPath = `../presets/adapters/default.js`;
  if (!adapterCache.has('__default__') && adapterModules[defaultPath]) {
    const mod = await adapterModules[defaultPath]();
    adapterCache.set('__default__', mod.transformDefaultDoc || mod.default);
  }

  return adapterCache.get('__default__') || (doc => doc);
}

// 动态注入对应课程的样式表
export async function loadPresetStyle(slug) {
  const clean = sanitizeSlug(slug);
  const targetName = (clean && styleModules[`../presets/styles/${clean}.css`]) ? clean : 'default';
  const stylePath = `../presets/styles/${targetName}.css`;
  const elementId = `maki-preset-style-${targetName}`;

  if (document.getElementById(elementId) || !styleModules[stylePath]) return;

  try {
    const cssContent = await styleModules[stylePath]();
    if (typeof cssContent === 'string' && !document.getElementById(elementId)) {
      const styleEl = document.createElement('style');
      styleEl.id = elementId;
      styleEl.setAttribute('data-preset', targetName);
      styleEl.textContent = cssContent;
      document.head.appendChild(styleEl);
      injectedStyleIds.add(elementId);
    }
  } catch (err) {
    console.warn(`[PresetLoader] 加载预设样式失败: ${stylePath}`, err);
  }
}

// 统一调度接口：加载样式并转换文档 AST
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
