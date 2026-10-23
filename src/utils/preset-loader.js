// 课程预设与专属样式加载器
const adapterModules = import.meta.glob('../presets/adapters/*.js');
const styleModules = import.meta.glob('../presets/styles/*.css', { query: '?inline', import: 'default' });

const adapterCache = new Map();
const injectedStyleIds = new Set();

// 课程 ID 与预设标识映射表
const idToSlugMap = new Map([
  ['1', 'kaoyan']
]);

export function registerPresetMapping(id, slug) {
  if (id && slug) idToSlugMap.set(String(id).trim(), String(slug).trim().toLowerCase());
}

// 归一化课程标识
export function sanitizeSlug(slug) {
  if (slug === undefined || slug === null) return '';
  const str = String(slug).trim().toLowerCase();
  if (idToSlugMap.has(str)) return idToSlugMap.get(str);
  return str.replace(/[^a-z0-9_-]/g, '');
}

// 匹配并获取课程适配器
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

// 注入课程专属样式
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

// 加载专属样式并转换文档
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
