import { parse as parseCss, walk as walkCss } from 'css-tree';

import { fileCacheScope, getCachedFile, getCachedFiles, hashCacheValue, putCachedFile } from './file-cache.js';

const MAX_AGE = 24 * 60 * 60 * 1000;
const pending = new Map();

function httpsUrl(value, base) {
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function filename(url, fallback) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop()) || fallback; }
  catch { return fallback; }
}

async function cacheKey(url, scope) {
  return `${scope}:animation-cdn:${await hashCacheValue(url)}`;
}

async function fetchResource(url, kind, scope) {
  const key = await cacheKey(url, scope);
  const cached = await getCachedFile(key, { maxAge: MAX_AGE });
  if (scope !== fileCacheScope()) throw new Error('登录状态已变化');
  if (cached?.value instanceof Blob) return cached.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { credentials: 'omit', mode: 'cors', signal: controller.signal });
    if (!response.ok) throw new Error('字体资源加载失败');
    const limit = kind === 'css' ? 2 * 1024 * 1024 : 8 * 1024 * 1024;
    const declared = Number(response.headers.get('content-length'));
    if (declared > limit) throw new Error('字体资源过大');
    const value = await response.blob();
    if (value.size > limit) throw new Error('字体资源过大');
    if (scope !== fileCacheScope()) throw new Error('登录状态已变化');
    if (!/\b(?:no-store|private)\b/i.test(response.headers.get('cache-control') || '')) {
      const hash = await hashCacheValue(value);
      if (scope === fileCacheScope()) {
        await putCachedFile({ key, name: filename(url, kind === 'css' ? 'font.css' : 'font'), hash, value });
      }
    }
    return value;
  } finally {
    clearTimeout(timer);
  }
}

function getResource(url, kind, scope) {
  const key = `${scope}:${kind}:${url}`;
  if (pending.has(key)) return pending.get(key);
  const promise = fetchResource(url, kind, scope).finally(() => {
    if (pending.get(key) === promise) pending.delete(key);
  });
  pending.set(key, promise);
  return promise;
}

export function cacheAnimationFont(url, allowed, scope) {
  if (scope !== fileCacheScope() || !allowed.has(url) || !httpsUrl(url)) return;
  // 首次播放时浏览器已经按需请求字体；利用浏览器 HTTP 缓存填充 IndexedDB。
  void getResource(url, 'font', scope).catch(() => {});
}

function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function prepareStyle(url, scope, ancestors = new Set()) {
  if (ancestors.has(url) || ancestors.size >= 5) throw new Error('字体样式引用循环或层级过深');
  const chain = new Set(ancestors).add(url);
  const blob = await getResource(url, 'css', scope);
  let css = await blob.text();
  css = css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, value) => {
    const absolute = httpsUrl(value, url);
    return absolute ? `url(${quote}${absolute}${quote})` : match;
  });
  // 保持嵌套的 CDN 样式引用可正常解析。
  css = css.replace(/(@import\s+)(['"])([^'"]+)\2/gi, (match, prefix, quote, value) => {
    const absolute = httpsUrl(value, url);
    return absolute ? `${prefix}${quote}${absolute}${quote}` : match;
  });
  const fonts = new Set();
  const imports = [...css.matchAll(/@import\s+(?:url\(\s*(['"]?)(https:[^)'"\s]+)\1\s*\)|(['"])(https:[^'"]+)\3)\s*;/gi)];
  for (const match of imports) {
    const nestedUrl = match[2] || match[4];
    try {
      const nested = await prepareStyle(nestedUrl, scope, chain);
      css = css.replace(match[0], nested.css);
      for (const font of nested.fonts) fonts.add(font);
    } catch {
      // 复杂或不可读取的 CDN 引用保持原样，让浏览器直接加载。
    }
  }
  const ast = parseCss(css);
  walkCss(ast, function (node) {
    if (node.type === 'Url' && this.atrule?.name?.toLowerCase() === 'font-face') {
      const absolute = httpsUrl(node.value, url);
      if (absolute) fonts.add(absolute);
    }
  });
  const keys = await Promise.all([...fonts].map(async (font) => [font, await cacheKey(font, scope)]));
  const cached = await getCachedFiles(keys.map(([, key]) => key), { maxAge: MAX_AGE });
  if (scope !== fileCacheScope()) throw new Error('登录状态已变化');
  const replacements = new Map();
  await Promise.all(keys.map(async ([font, key]) => {
    const value = cached.get(key)?.value;
    if (value instanceof Blob) replacements.set(font, await toDataUrl(value));
  }));
  css = css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, value) => {
    const replacement = replacements.get(value);
    return replacement ? `url(${quote}${replacement}${quote})` : match;
  });
  return { css, fonts };
}

export async function prepareAnimationCDNStyles(urls) {
  const scope = fileCacheScope();
  const styles = new Map();
  const fonts = new Set();
  await Promise.all([...new Set(urls)].map(async (url) => {
    try {
      const prepared = await prepareStyle(url, scope);
      styles.set(url, prepared.css);
      for (const font of prepared.fonts) fonts.add(font);
    } catch {
      // CDN 不允许跨域读取时，让浏览器沿用原始样式表。
    }
  }));
  return { styles, fonts, scope };
}
