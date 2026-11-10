import { parse as parseJavaScript } from 'acorn';
import { parse as parseCss, walk as walkCss } from 'css-tree';

import katexCss from '../components/animation/runtime/katex/katex.min.css?raw';
import katexScript from '../components/animation/runtime/katex/katex.min.js?raw';
import playerScript from '../components/animation/runtime/player.js?raw';

const katexFonts = import.meta.glob('../components/animation/runtime/katex/fonts/*.woff2', {
  eager: true,
  query: '?inline',
  import: 'default'
});

// 动画公共资源与小节资源按相对路径合并，播放时转换为隔离文档。
export const MAX_ANIMATION_SOURCE = 32 * 1024 * 1024;
const MIME = {
  html: 'text/html',
  js: 'text/javascript',
  css: 'text/css',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
  gif: 'image/gif'
};

export function parseAnimationPackage(source) {
  try {
    const value = JSON.parse(source);
    return value?.type === 'maki-animation-package' &&
      value.version === 1 &&
      typeof value.entry === 'string' &&
      value.files &&
      typeof value.files === 'object' &&
      !Array.isArray(value.files)
      ? value
      : null;
  } catch {
    return null;
  }
}

function dataUrl(path, contents) {
  const extension = path.split('.').pop().toLowerCase();
  return `data:${MIME[extension] || 'application/octet-stream'};base64,${contents}`;
}

function resolvePath(base, reference) {
  const value = reference.trim();
  if (!value || value.startsWith('#') || /^(data|blob):/i.test(value)) {
    return null;
  }
  const url = new URL(value, `https://animation.invalid/${base}`);
  if (url.origin !== 'https://animation.invalid') {
    throw new Error('动画包不能引用外部资源');
  }
  return decodeURIComponent(url.pathname.slice(1));
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === 'https:';
  } catch {
    return false;
  }
}

// 字体 CDN 使用绝对 HTTPS 地址；包内资源仍按相对路径解析。
function resolveCssPath(base, reference) {
  if (isHttpsUrl(reference.trim())) {
    return null;
  }
  return resolvePath(base, reference);
}

function textFromBase64(value) {
  const binary = atob(value);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function replaceCachedImports(css, cdn) {
  return css.replace(
    /@import\s+(?:url\(\s*(['"]?)(https:[^)'"\s]+)\1\s*\)|(['"])(https:[^'"]+)\3)\s*;/gi,
    (match, quote, url, stringQuote, stringUrl) => cdn?.styles?.get(url || stringUrl) || match
  );
}

function addCDNObserver(document, cdn) {
  if (!cdn?.fonts?.size) {
    return;
  }
  const observer = document.createElement('script');
  observer.textContent = `(() => {
    const seen = new Set();
    const report = (entry) => {
      if (entry.name.startsWith('https:') && !seen.has(entry.name)) {
        seen.add(entry.name);
        parent.postMessage({ type: 'maki-animation-font-resource', url: entry.name }, '*');
      }
    };
    try {
      const monitor = new PerformanceObserver((entries) => entries.getEntries().forEach(report));
      monitor.observe({ type: 'resource', buffered: true });
    } catch {}
  })();`;
  document.head.appendChild(observer);
}

function collectCDNImports(css, urls) {
  try {
    const ast = parseCss(css);
    walkCss(ast, (node) => {
      if (node.type !== 'Atrule' || node.name.toLowerCase() !== 'import' || !node.prelude) {
        return;
      }
      walkCss(node.prelude, (child) => {
        if ((child.type === 'Url' || child.type === 'String') && isHttpsUrl(child.value)) {
          urls.add(child.value);
        }
      });
    });
  } catch {
    // 播放时保留原始样式
  }
}

export function listLegacyAnimationCDNStyles(pkg) {
  if (!pkg?.files?.[pkg.entry]) {
    return [];
  }
  const urls = new Set();
  const doc = new DOMParser().parseFromString(textFromBase64(pkg.files[pkg.entry]), 'text/html');
  for (const link of doc.querySelectorAll('link[rel~="stylesheet"][href]')) {
    const href = link.getAttribute('href');
    if (isHttpsUrl(href)) {
      urls.add(href);
    } else {
      const path = resolvePath(pkg.entry, href);
      if (path && pkg.files[path]) {
        collectCDNImports(textFromBase64(pkg.files[path]), urls);
      }
    }
  }
  for (const style of doc.querySelectorAll('style')) {
    collectCDNImports(style.textContent, urls);
  }
  return [...urls];
}

export function buildAnimationDocument(pkg, cdn = null) {
  if (!Object.hasOwn(pkg.files, pkg.entry)) {
    throw new Error('找不到动画入口文件');
  }
  const fileUrl = (base, reference) => {
    const path = resolvePath(base, reference);
    if (!path) {
      return reference;
    }
    if (!Object.hasOwn(pkg.files, path)) {
      throw new Error(`动画资源不存在：${path}`);
    }
    return dataUrl(path, pkg.files[path]);
  };
  const rewriteCss = (css, path) =>
    replaceCachedImports(
      css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, url) =>
        isHttpsUrl(url) ? match : `url(${quote}${fileUrl(path, url)}${quote})`
      ),
      cdn
    );
  const document = new DOMParser().parseFromString(
    textFromBase64(pkg.files[pkg.entry]),
    'text/html'
  );
  for (const element of document.querySelectorAll(
    'script[src], img[src], source[src], video[src], audio[src]'
  )) {
    element.setAttribute('src', fileUrl(pkg.entry, element.getAttribute('src')));
  }
  for (const link of document.querySelectorAll('link[href]')) {
    if (link.rel.toLowerCase() === 'stylesheet' && isHttpsUrl(link.getAttribute('href'))) {
      const cachedStyle = cdn?.styles?.get(link.getAttribute('href'));
      if (cachedStyle) {
        const style = document.createElement('style');
        style.textContent = cachedStyle;
        link.replaceWith(style);
      }
      continue;
    }
    const path = resolvePath(pkg.entry, link.getAttribute('href'));
    if (link.rel.toLowerCase() === 'stylesheet' && path) {
      if (!Object.hasOwn(pkg.files, path)) {
        throw new Error(`动画资源不存在：${path}`);
      }
      const style = document.createElement('style');
      style.textContent = rewriteCss(textFromBase64(pkg.files[path]), path);
      link.replaceWith(style);
    } else {
      link.setAttribute('href', fileUrl(pkg.entry, link.getAttribute('href')));
    }
  }
  for (const style of document.querySelectorAll('style')) {
    style.textContent = rewriteCss(style.textContent, pkg.entry);
  }
  for (const element of document.querySelectorAll('[style]')) {
    element.setAttribute('style', rewriteCss(element.getAttribute('style'), pkg.entry));
  }
  const csp = document.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' data:; style-src 'unsafe-inline' https:; img-src data: blob:; font-src data: https:; media-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  document.head.prepend(csp);
  addCDNObserver(document, cdn);
  return '<!doctype html>\n' + document.documentElement.outerHTML;
}

export function parseAnimationAssets(source) {
  try {
    const value = JSON.parse(source);
    return value?.type === 'maki-animation-assets' &&
      value.version === 1 &&
      value.files &&
      typeof value.files === 'object' &&
      !Array.isArray(value.files)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function combineAnimationAssets(base, assets) {
  if (!base?.entry || !base?.entry_name || !base?.files || !assets?.files) {
    throw new Error('请先配置图书的动画基础包和入口 HTML');
  }
  const entry = base.entry_name;
  return {
    type: 'maki-animation-package',
    version: 1,
    entry,
    files: {
      ...base.files,
      ...assets.files,
      [entry]: base.entry
    }
  };
}

// 在写入小节前解析源码并核对静态资源引用，不执行导入的代码。
export function validateAnimationAssets(base, assets) {
  const sectionFiles = assets?.files;
  if (!sectionFiles || !Object.hasOwn(sectionFiles, 'animation.json')) {
    throw new Error('小节资源包缺少 animation.json');
  }
  let manifest;
  try {
    manifest = JSON.parse(textFromBase64(sectionFiles['animation.json']));
  } catch {
    throw new Error('animation.json 不是有效的 JSON');
  }
  if (
    manifest?.type !== 'maki-animation' ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.scripts) ||
    !manifest.scripts.length ||
    (manifest.styles !== undefined && !Array.isArray(manifest.styles))
  ) {
    throw new Error('animation.json 不符合平台动画规范');
  }
  const width = Number(manifest.width ?? 1920);
  const height = Number(manifest.height ?? 1080);
  if (![width, height].every((value) => Number.isInteger(value) && value >= 1 && value <= 4096)) {
    throw new Error('animation.json 的画布尺寸必须为 1 到 4096 的整数');
  }
  const merged = {
    ...(base?.files || {}),
    ...sectionFiles
  };
  function requireFile(path, context) {
    if (
      typeof path !== 'string' ||
      !path ||
      path.startsWith('/') ||
      path.split('/').some((part) => !part || part === '.' || part === '..')
    ) {
      throw new Error(`${context}：资源路径无效`);
    }
    if (!Object.hasOwn(merged, path)) {
      throw new Error(`${context}：缺少“${path}”，请导入对应的图书基础包或小节资源`);
    }
    if (typeof merged[path] !== 'string') {
      throw new Error(`${context}：文件数据无效`);
    }
    return merged[path];
  }
  function decoded(path) {
    try {
      return textFromBase64(requireFile(path, path));
    } catch (error) {
      if (error instanceof DOMException) {
        throw new Error(`${path}：文件数据无法解码`);
      }
      throw error;
    }
  }
  const scripts = new Set();
  const styles = new Set();
  for (const path of manifest.scripts) {
    if (typeof path !== 'string' || !/\.js$/i.test(path)) {
      throw new Error('动画清单中的脚本必须是 JavaScript 文件');
    }
    requireFile(path, 'animation.json');
    scripts.add(path);
  }
  for (const path of manifest.styles || []) {
    if (typeof path !== 'string') {
      throw new Error('动画清单中的样式路径无效');
    }
    if (isHttpsUrl(path)) {
      continue;
    }
    if (!/\.css$/i.test(path)) {
      throw new Error('动画清单中的样式必须是 CSS 文件或 HTTPS 字体样式表');
    }
    requireFile(path, 'animation.json');
    styles.add(path);
  }
  for (const path of Object.keys(sectionFiles)) {
    if (/\.js$/i.test(path)) {
      scripts.add(path);
    } else if (/\.css$/i.test(path)) {
      styles.add(path);
    } else if (/\.json$/i.test(path)) {
      try {
        JSON.parse(decoded(path));
      } catch {
        throw new Error(`${path}：JSON 语法错误`);
      }
    }
  }
  for (const path of scripts) {
    const source = decoded(path);
    let tree;
    try {
      tree = parseJavaScript(source, {
        ecmaVersion: 'latest',
        sourceType: 'script',
        locations: true
      });
    } catch (error) {
      throw new Error(
        `${path}：JavaScript 语法错误（第 ${error.loc?.line || '?'} 行）：${error.message}`
      );
    }
    const pending = [tree];
    while (pending.length) {
      const node = pending.pop();
      if (!node || typeof node !== 'object') {
        continue;
      }
      if (node.type === 'ImportExpression') {
        throw new Error(`${path}：动画不支持动态导入模块`);
      }
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.property?.name === 'asset' &&
        node.callee.object?.type === 'Identifier' &&
        ['MakiAnimation', 'api'].includes(node.callee.object.name)
      ) {
        const value = node.arguments[0];
        const name =
          value?.type === 'Literal' && typeof value.value === 'string'
            ? value.value
            : value?.type === 'TemplateLiteral' && value.expressions.length === 0
              ? value.quasis[0].value.cooked
              : null;
        if (name === null || node.arguments.length !== 1) {
          throw new Error(`${path}：动画资源引用必须使用固定路径，以便导入时检查`);
        }
        requireFile(name, path);
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          pending.push(...value);
        } else if (value && typeof value === 'object' && typeof value.type === 'string') {
          pending.push(value);
        }
      }
    }
  }
  for (const path of styles) {
    let css;
    try {
      css = parseCss(decoded(path), {
        positions: true,
        onParseError(error) {
          throw error;
        }
      });
    } catch (error) {
      throw new Error(
        `${path}：CSS 语法错误${error.line ? `（第 ${error.line} 行）` : ''}：${error.message}`
      );
    }
    walkCss(css, function (node) {
      if (node.type === 'Atrule' && node.name.toLowerCase() === 'import') {
        let imported = '';
        if (node.prelude) {
          walkCss(node.prelude, (child) => {
            if (!imported && (child.type === 'Url' || child.type === 'String')) {
              imported = child.value;
            }
          });
        }
        if (!isHttpsUrl(imported)) {
          throw new Error(`${path}：@import 仅支持 HTTPS 字体样式表`);
        }
      }
      if (node.type === 'Url') {
        if (isHttpsUrl(node.value)) {
          const context = this.atrule?.name?.toLowerCase();
          if (context !== 'font-face' && context !== 'import') {
            throw new Error(`${path}：外部地址仅支持字体或字体样式表`);
          }
          return;
        }
        const ref = resolvePath(path, node.value);
        if (ref) {
          requireFile(ref, path);
        }
      }
    });
  }
}

// CSS 的字体和图片已经包含在样式中，避免再次放进脚本资源表。
function collectRuntimeAssetPaths(scripts, lookup) {
  const paths = new Set();
  let dynamic = false;
  for (const path of scripts) {
    let tree;
    try {
      tree = parseJavaScript(textFromBase64(lookup(path)), {
        ecmaVersion: 'latest',
        sourceType: 'script'
      });
    } catch {
      return null;
    }
    const pending = [
      {
        node: tree,
        parent: null
      }
    ];
    while (pending.length) {
      const { node, parent } = pending.pop();
      if (!node || typeof node !== 'object') {
        continue;
      }
      if (node.type === 'MemberExpression') {
        const property = node.computed ? node.property?.value : node.property?.name;
        if (property === 'asset') {
          if (parent?.type !== 'CallExpression' || parent.callee !== node) {
            dynamic = true;
          } else {
            const argument = parent.arguments[0];
            const name =
              argument?.type === 'Literal' && typeof argument.value === 'string'
                ? argument.value
                : argument?.type === 'TemplateLiteral' && argument.expressions.length === 0
                  ? argument.quasis[0].value.cooked
                  : null;
            if (name === null) {
              dynamic = true;
            } else {
              paths.add(name);
            }
          }
        } else if (
          node.computed &&
          node.property?.type !== 'Literal' &&
          node.object?.type === 'Identifier' &&
          ['MakiAnimation', 'api'].includes(node.object.name)
        ) {
          dynamic = true;
        }
      }
      if (
        node.type === 'Property' &&
        node.key?.name === 'asset' &&
        parent?.type === 'ObjectPattern'
      ) {
        dynamic = true;
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child?.type) {
              pending.push({
                node: child,
                parent: node
              });
            }
          }
        } else if (value && typeof value === 'object' && value.type) {
          pending.push({
            node: value,
            parent: node
          });
        }
      }
    }
  }
  return dynamic ? null : paths;
}

export function listAnimationCDNStyles(base, assets) {
  if (!assets?.files?.['animation.json']) {
    return [];
  }
  let manifest;
  try {
    manifest = JSON.parse(textFromBase64(assets.files['animation.json']));
  } catch {
    return [];
  }
  const files = {
    ...(base?.files || {}),
    ...assets.files
  };
  const urls = new Set();
  for (const path of manifest.styles || []) {
    if (isHttpsUrl(path)) {
      urls.add(path);
      continue;
    }
    if (typeof path !== 'string' || !files[path]) {
      continue;
    }
    try {
      const ast = parseCss(textFromBase64(files[path]));
      walkCss(ast, (node) => {
        if (node.type !== 'Atrule' || node.name.toLowerCase() !== 'import' || !node.prelude) {
          return;
        }
        walkCss(node.prelude, (child) => {
          if ((child.type === 'Url' || child.type === 'String') && isHttpsUrl(child.value)) {
            urls.add(child.value);
          }
        });
      });
    } catch {
      // 原始导入检查会报告样式错误
    }
  }
  return [...urls];
}

// 通用入口由平台生成，资源清单定义需要加载的脚本和样式。
export function buildStandardAnimationDocument(base, assets, cdn = null) {
  if (!assets?.files || !Object.hasOwn(assets.files, 'animation.json')) {
    throw new Error('小节资源包缺少 animation.json');
  }
  let manifest;
  try {
    manifest = JSON.parse(textFromBase64(assets.files['animation.json']));
  } catch {
    throw new Error('animation.json 格式不正确');
  }
  if (
    manifest.type !== 'maki-animation' ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.scripts) ||
    !manifest.scripts.length ||
    (manifest.styles !== undefined && !Array.isArray(manifest.styles))
  ) {
    throw new Error('动画清单不符合平台规范');
  }
  const width = Number(manifest.width || 1920);
  const height = Number(manifest.height || 1080);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 4096 ||
    height > 4096
  ) {
    throw new Error('动画画布尺寸不正确');
  }
  const files = {
    ...(base?.files || {}),
    ...assets.files
  };
  const lookup = (path) => {
    if (
      typeof path !== 'string' ||
      !path ||
      path.startsWith('/') ||
      path.split('/').some((part) => part === '..' || part === '.')
    ) {
      throw new Error('动画清单包含无效路径');
    }
    if (!Object.hasOwn(files, path)) {
      throw new Error(`动画资源不存在：${path}`);
    }
    return files[path];
  };
  const usedPaths = collectRuntimeAssetPaths(manifest.scripts, lookup);
  const resources = Object.fromEntries(
    Object.entries(files)
      .filter(([path]) => usedPaths === null || usedPaths.has(path))
      .map(([path, value]) => [path, dataUrl(path, value)])
  );
  const rewriteCss = (css, path) => {
    let result = css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, url) => {
      const resolved = resolveCssPath(path, url);
      return resolved ? `url(${quote}${dataUrl(resolved, lookup(resolved))}${quote})` : match;
    });
    result = replaceCachedImports(result, cdn);
    return result;
  };
  const document = new DOMParser().parseFromString(
    '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="animation-viewport"><div id="animation-stage"></div></div></body></html>',
    'text/html'
  );
  const csp = document.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' data:; style-src 'unsafe-inline' https:; img-src data: blob:; font-src data: https:; media-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  document.head.prepend(csp);
  addCDNObserver(document, cdn);
  const css = document.createElement('style');
  const fontCss = katexCss.replace(/url\((['"]?)fonts\/([^)'"?#]+)\1\)/g, (match, quote, name) => {
    const entry = Object.entries(katexFonts).find(([path]) => path.endsWith('/' + name));
    return entry ? `url(${quote}${entry[1]}${quote})` : match;
  });
  css.textContent = `html,body{margin:0;width:100%;overflow:hidden}#animation-viewport{position:relative;width:100%;overflow:hidden}#animation-stage{position:absolute;left:0;top:0;width:${width}px;height:${height}px;overflow:hidden;transform-origin:0 0}${fontCss}`;
  document.head.appendChild(css);
  for (const path of manifest.styles || []) {
    if (isHttpsUrl(path)) {
      const cachedStyle = cdn?.styles?.get(path);
      if (cachedStyle) {
        const style = document.createElement('style');
        style.textContent = cachedStyle;
        document.head.appendChild(style);
      } else {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = path;
        document.head.appendChild(link);
      }
    } else {
      const style = document.createElement('style');
      style.textContent = rewriteCss(textFromBase64(lookup(path)), path);
      document.head.appendChild(style);
    }
  }
  const addInline = (code) => {
    const script = document.createElement('script');
    script.textContent = code;
    document.body.appendChild(script);
  };
  addInline(katexScript);
  addInline(
    `window.__MAKI_ANIMATION_CONFIG__=${JSON.stringify({
      width,
      height
    })};window.__MAKI_ANIMATION_ASSETS__=${JSON.stringify(resources).replace(/</g, '\\u003c')};`
  );
  addInline(playerScript);
  for (const path of manifest.scripts) {
    if (!/\.js$/i.test(path)) {
      throw new Error('动画脚本必须是 JavaScript 文件');
    }
    const script = document.createElement('script');
    script.src = dataUrl(path, lookup(path));
    document.body.appendChild(script);
  }
  return '<!doctype html>\n' + document.documentElement.outerHTML;
}

export async function readAnimationFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length) {
    throw new Error('请选择动画资源文件夹');
  }
  if (files.length > 3000 || files.reduce((sum, file) => sum + file.size, 0) > 22 * 1024 * 1024) {
    throw new Error('动画文件夹不能超过 22 MB 或 3000 个文件');
  }
  const result = {};
  for (const file of files) {
    const path = (file.webkitRelativePath || file.name).split('/').slice(1).join('/');
    if (!path || path.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error('动画资源路径无效');
    }
    const encoded = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error(`无法读取 ${path}`));
      reader.readAsDataURL(file);
    });
    result[path] = encoded;
  }
  if (JSON.stringify(result).length > MAX_ANIMATION_SOURCE) {
    throw new Error('动画资源打包后超过 32 MB');
  }
  return result;
}

export async function createAnimationPackage(fileList) {
  const files = await readAnimationFiles(fileList);
  return {
    type: 'maki-animation-assets',
    version: 1,
    files
  };
}
