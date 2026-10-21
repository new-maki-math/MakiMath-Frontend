import MarkdownIt from 'markdown-it';
import cjkFriendly from 'markdown-it-cjk-friendly';
import katex from 'katex';

/**
 * 转换 Typst / ASCII 常见符号到 LaTeX 对应表示，确保公式兼容性
 */
export function normalizeMath(src) {
  let s = String(src || '').trim();
  s = s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  // 转换常用 Typst/ASCII 符号到 LaTeX
  s = s.replace(/(^|[^\\])->/g, '$1\\to ');
  s = s.replace(/(^|[^\\])=>/g, '$1\\implies ');
  s = s.replace(/(^|[^\\])<=>/g, '$1\\iff ');
  s = s.replace(/(^|[^\\])\bRR\b/g, '$1\\mathbb{R}');
  s = s.replace(/(^|[^\\])\bZZ\b/g, '$1\\mathbb{Z}');
  s = s.replace(/(^|[^\\])\bNN\b/g, '$1\\mathbb{N}');
  s = s.replace(/(^|[^\\])\bCC\b/g, '$1\\mathbb{C}');
  s = s.replace(/(^|[^\\])\bQQ\b/g, '$1\\mathbb{Q}');
  s = s.replace(/(^|[^\\])\boo\b/g, '$1\\infty');
  return s;
}

// 缓存已渲染的数学公式，降低重复解析开销
const mathCache = new Map();
const MAX_MATH_CACHE = 1000;

/**
 * 直接渲染单个公式为 KaTeX 高性能 HTML + MathML
 */
export function renderMath(formula, displayMode = false) {
  const cacheKey = `${displayMode ? 'D' : 'I'}:${formula}`;
  if (mathCache.has(cacheKey)) {
    return mathCache.get(cacheKey);
  }

  const normalized = normalizeMath(formula);
  let result = '';
  try {
    result = katex.renderToString(normalized, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false
    });
  } catch (err) {
    result = `<span class="katex-error" title="${err.message}">${formula}</span>`;
  }

  if (mathCache.size >= MAX_MATH_CACHE) {
    const firstKey = mathCache.keys().next().value;
    mathCache.delete(firstKey);
  }
  mathCache.set(cacheKey, result);
  return result;
}

/**
 * Markdown-it 内联数学规则 ($...$)
 */
function mathInline(state, silent) {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x24 /* $ */) {
    return false;
  }
  if (state.src.charCodeAt(start + 1) === 0x24) {
    return false;
  }

  let match = start + 1;
  while ((match = state.src.indexOf('$', match)) !== -1) {
    let backslashes = 0;
    let pos = match - 1;
    while (pos >= start && state.src.charCodeAt(pos) === 0x5c /* \ */) {
      backslashes++;
      pos--;
    }
    if (backslashes % 2 === 0) {
      break;
    }
    match++;
  }

  if (match === -1 || match - start <= 1) {
    return false;
  }

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = state.src.slice(start + 1, match);
  }

  state.pos = match + 1;
  return true;
}

/**
 * Markdown-it 块级数学规则 ($$...$$)
 */
function mathBlock(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];

  if (start + 2 > max) return false;
  if (state.src.charCodeAt(start) !== 0x24 || state.src.charCodeAt(start + 1) !== 0x24) {
    return false;
  }

  // 检查单行形式 $$ ... $$
  const firstLineContent = state.src.slice(start + 2, max);
  const sameLineClose = firstLineContent.indexOf('$$');
  if (sameLineClose !== -1) {
    if (!silent) {
      const token = state.push('math_block', 'math', 0);
      token.block = true;
      token.content = firstLineContent.slice(0, sameLineClose);
      token.map = [startLine, startLine + 1];
      token.markup = '$$';
    }
    state.line = startLine + 1;
    return true;
  }

  // 跨行搜索闭合 $$
  let nextLine = startLine;
  let end = -1;
  for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineMax = state.eMarks[nextLine];
    const lineStr = state.src.slice(lineStart, lineMax).trim();
    if (lineStr.endsWith('$$')) {
      end = nextLine;
      break;
    }
  }

  if (end === -1) return false;

  if (!silent) {
    const content = state.getLines(startLine + 1, end, state.tShift[startLine], false);
    const token = state.push('math_block', 'math', 0);
    token.block = true;
    token.content = content.replace(/\$\$\s*$/, '').trim();
    token.map = [startLine, end + 1];
    token.markup = '$$';
  }

  state.line = end + 1;
  return true;
}

// 初始化 markdown-it 单例
export const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  typographer: false
});

// 挂载中文标点友好的 CJK 插件
const cjkPlugin = cjkFriendly.default || cjkFriendly;
if (typeof cjkPlugin === 'function') {
  md.use(cjkPlugin);
}

// 注册数学语法规则
md.inline.ruler.before('escape', 'math_inline', mathInline);
md.block.ruler.before('fence', 'math_block', mathBlock, {
  alt: ['paragraph', 'reference', 'blockquote', 'list']
});

// 注册 KaTeX 渲染处理器
md.renderer.rules.math_inline = (tokens, idx) => {
  return renderMath(tokens[idx].content, false);
};

md.renderer.rules.math_block = (tokens, idx) => {
  return `<div class="math-block-wrap">${renderMath(tokens[idx].content, true)}</div>`;
};

// Markdown 结果缓存
const renderCache = new Map();
const MAX_RENDER_CACHE = 500;

/**
 * 核心对外高阶渲染函数：高效渲染 Markdown 与数学公式为高质量 HTML
 */
export function renderMarkdown(content) {
  if (!content) return '';
  if (renderCache.has(content)) {
    return renderCache.get(content);
  }

  const text = String(content).replace(/\r\n?/g, '\n');

  // 判断是否已经是结构化 HTML 内容 (例如 content/<课程>/ 导出的 HTML 片段)
  const isHtml = /<(p|div|ul|ol|table|h[1-6]|article|section)[\s>]/.test(text);

  let html = '';
  if (isHtml) {
    // 对 HTML 片段中嵌入的行间公式 $$...$$ 与行内公式 $...$ 执行高性能 KaTeX 解析替换
    html = text
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => `<div class="math-block-wrap">${renderMath(f, true)}</div>`)
      .replace(/(^|[^\\])\$([^$\n]+?)(?<!\\)\$/g, (m, prefix, f) => `${prefix}${renderMath(f, false)}`);
  } else {
    // 纯 Markdown 文本交由配置了 KaTeX 与 CJK 插件的 markdown-it 全量解析
    html = md.render(text);
  }

  if (renderCache.size >= MAX_RENDER_CACHE) {
    const firstKey = renderCache.keys().next().value;
    renderCache.delete(firstKey);
  }
  renderCache.set(content, html);
  return html;
}
