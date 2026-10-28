import { parse, renderToString, SyntaxKind as K, kindName } from 'typlet';
import { normalizeMathHtml } from './normalize-math-html.js';
import { parseMmBox } from '../mm/parse-box.js';
import { parseMmTag } from '../mm/parse-tag.js';
import { parseMmQuestion } from '../mm/parse-question.js';
import { parseTable } from './parse-table.js';
import { safeLink, staticAlignment, staticColor, staticFontSettings, staticLength, staticString } from './static-values.js';

const shorthands = { '...': '…', '~': '\u00a0', '-': '−', '--': '–', '---': '—', '-?': '\u00ad' };

const ignored = new Set([K.LineComment, K.BlockComment, K.Shebang]);
const marker = new Set([K.Star, K.Underscore, K.HeadingMarker, K.ListMarker, K.EnumMarker, K.LeftBracket, K.RightBracket]);

function positioned(children, offset) {
  let current = offset;
  return children.map((node) => {
    const entry = { node, start: current, end: current + node.len };
    current = entry.end;
    return entry;
  });
}

function location(source, offset) {
  const before = source.slice(0, offset);
  const lines = before.split(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/);
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

export function parseDocument(source) {
  const diagnostics = [];
  const root = parse(source, { mode: 'markup' });
  for (const diagnostic of root.diagnostics()) {
    diagnostics.push({ ...diagnostic, ...location(source, diagnostic.start) });
  }
  const report = (message, start, end, severity = 'warning') => {
    diagnostics.push({ message, start, end, severity, ...location(source, start) });
  };
  const unsupported = (entry, message) => {
    report(message, entry.start, entry.end);
    return { type: 'unsupported', text: source.slice(entry.start, entry.end), start: entry.start, end: entry.end };
  };
  const convertChildren = (node, start) => convert(positioned(node.children, start));
  const validateInline = (nodes, message) => {
    const types = new Set(['fragment', 'text', 'styled-text', 'styled-scope', 'strong', 'emph', 'underline', 'strike', 'link', 'raw', 'math', 'unsupported', 'mm-test', 'overline', 'sub', 'super', 'smallcaps', 'hidden', 'inline-box', 'highlight', 'mm-tag', 'mm-question-blank']);
    return nodes.map((item) => {
      if (!types.has(item.type) || (item.type === 'raw' && item.block) || (item.type === 'math' && item.display)) return unsupported(item, message);
      return item.children ? { ...item, children: validateInline(item.children, message) } : item;
    });
  };
  const staticTextStyle = (entries) => {
    const style = {};
    const attrs = {};
    const features = [];
    const numeric = [];
    let region = null;
    let hasSize = false;
    let hasFill = false;
    for (const { node } of entries) {
      if (node.kind !== K.Named) {
        const size = staticLength(node);
        const color = staticColor(node);
        if (size !== null && !hasSize) { style.fontSize = size; hasSize = true; }
        else if (color && !hasFill) { style.color = color; hasFill = true; }
        else return null;
        continue;
      }
      const parts = node.children.filter((child) => child.kind !== K.Space && child.kind !== K.Colon && !ignored.has(child.kind));
      if (parts.length !== 2 || parts[0].kind !== K.Ident) return null;
      const name = parts[0].fullText();
      const value = parts[1].fullText();
      if (name === 'size' && staticLength(parts[1]) !== null && !hasSize) { style.fontSize = staticLength(parts[1]); hasSize = true; }
      else if (name === 'fill' && staticColor(parts[1]) && !hasFill) { style.color = staticColor(parts[1]); hasFill = true; }
      else if (name === 'tracking' && staticLength(parts[1], true) !== null && !staticLength(parts[1], true).endsWith('%')) style.letterSpacing = staticLength(parts[1], true);
      else if (name === 'stretch' && parts[1].kind === K.Numeric && /^(?:\d+(?:\.\d+)?|\.\d+)%$/.test(value)) style.fontStretch = value;
      else if (name === 'lang' && /^[a-zA-Z]{2,3}$/.test(staticString(parts[1]) || '')) attrs.lang = staticString(parts[1]).toLowerCase();
      else if (name === 'region' && /^[a-zA-Z]{2}$/.test(staticString(parts[1]) || '')) region = staticString(parts[1]).toUpperCase();
      else if (name === 'dir' && parts[1].kind === K.Ident && ['ltr', 'rtl'].includes(value)) attrs.dir = value;
      else if (name === 'kerning' && parts[1].kind === K.Bool) style.fontKerning = value === 'true' ? 'normal' : 'none';
      else if (name === 'hyphenate' && parts[1].kind === K.Bool) style.hyphens = value === 'true' ? 'auto' : 'manual';
      else if (name === 'ligatures' && parts[1].kind === K.Bool) features.push(`"liga" ${value === 'true' ? 1 : 0}`, `"clig" ${value === 'true' ? 1 : 0}`);
      else if (name === 'discretionary-ligatures' && parts[1].kind === K.Bool) features.push(`"dlig" ${value === 'true' ? 1 : 0}`);
      else if (name === 'historical-ligatures' && parts[1].kind === K.Bool) features.push(`"hlig" ${value === 'true' ? 1 : 0}`);
      else if (name === 'slashed-zero' && parts[1].kind === K.Bool) features.push(`"zero" ${value === 'true' ? 1 : 0}`);
      else if (name === 'fractions' && parts[1].kind === K.Bool) features.push(`"frac" ${value === 'true' ? 1 : 0}`);
      else if (name === 'features') {
        const settings = staticFontSettings(parts[1]);
        if (!settings) return null;
        features.push(...settings);
      } else if (name === 'variations') {
        const settings = staticFontSettings(parts[1], true);
        if (!settings) return null;
        style.fontVariationSettings = settings.length ? settings.join(', ') : 'normal';
      }
      else if (name === 'number-type' && parts[1].kind === K.Str && /^"(lining|old-style)"$/.test(value)) numeric.push(value === '"lining"' ? 'lining-nums' : 'oldstyle-nums');
      else if (name === 'number-width' && parts[1].kind === K.Str && /^"(proportional|tabular)"$/.test(value)) numeric.push(value === '"tabular"' ? 'tabular-nums' : 'proportional-nums');
      else if (name === 'font' && parts[1].kind === K.Str && staticString(parts[1])) style.fontFamily = JSON.stringify(staticString(parts[1]));
      else if (name === 'font' && parts[1].kind === K.Array) {
        const names = parts[1].children.filter((child) => ![K.Space, K.LeftParen, K.RightParen, K.Comma, K.LineComment, K.BlockComment].includes(child.kind)).map(staticString);
        if (!names.length || names.some((font) => !font)) return null;
        style.fontFamily = names.map((font) => JSON.stringify(font)).join(', ');
      }
      else if (name === 'weight' && parts[1].kind === K.Int && /^\d+$/.test(value) && Number(value) >= 100 && Number(value) <= 900) style.fontWeight = Number(value);
      else if (name === 'style' && parts[1].kind === K.Str && /^"(normal|italic|oblique)"$/.test(value)) style.fontStyle = value.slice(1, -1);
      else if (name === 'weight' && parts[1].kind === K.Str && /^"(thin|extralight|light|regular|medium|semibold|bold|extrabold|black)"$/.test(value)) style.fontWeight = { thin: 100, extralight: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }[value.slice(1, -1)];
      else return null;
    }
    if (region && !attrs.lang) return null;
    if (region) attrs.lang = `${attrs.lang}-${region}`;
    if (features.length) style.fontFeatureSettings = features.join(', ');
    if (numeric.length) style.fontVariantNumeric = numeric.join(' ');
    return { style, attrs };
  };
  const convert = (entries) => {
    const output = [];
    const styles = [];
    let enumNumber = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const { node, start, end } = entry;
      if (ignored.has(node.kind) || marker.has(node.kind)) continue;
      if (node.kind !== K.EnumItem && node.kind !== K.Space) enumNumber = 0;
      if (node.kind === K.Hash) {
        const next = entries[i + 1];
        if (!next || next.start !== end) { output.push(unsupported(entry, '无法解析嵌入的代码表达式')); continue; }
        i++;
        let expressionEnd = next.end;
        if (entries[i + 1]?.node.kind === K.Semicolon && entries[i + 1].start === next.end) expressionEnd = entries[++i].end;
        const expression = next.node;
        const range = { start, end: expressionEnd };
        if (expression.kind === K.SetRule) {
          const rule = positioned(expression.children, next.start).filter((item) => item.node.kind !== K.Space && !ignored.has(item.node.kind));
          const target = rule.find((item) => item.node.kind === K.Ident);
          const args = rule.find((item) => item.node.kind === K.Args);
          if (target?.node.fullText() === 'text' && args && !rule.some((item) => item.node.kind === K.If)) {
            const params = positioned(args.node.children, args.start).filter((item) => ![K.Space, K.LeftParen, K.RightParen, K.Comma, K.LineComment, K.BlockComment].includes(item.node.kind));
            const textStyle = staticTextStyle(params);
            if (textStyle) {
              styles.push({ index: output.length, ...textStyle });
              continue;
            }
          }
          output.push(unsupported(range, '暂不支持此设置规则或参数'));
          continue;
        }
        if (expression.kind === K.Ident && expression.fullText() === 'mm-test') {
          output.push({ type: 'mm-test', ...range });
        } else if (expression.kind === K.ContentBlock) {
          output.push({ type: 'fragment', children: convertChildren(expression, next.start), ...range });
        } else if (expression.kind === K.FuncCall) {
          const call = positioned(expression.children, next.start);
          const callee = call.find((item) => item.node.kind === K.Ident);
          const args = call.find((item) => item.node.kind === K.Args);
          const name = callee?.node.fullText();
          const parts = args ? positioned(args.node.children, args.start).filter((item) => item.node.kind !== K.Space && !ignored.has(item.node.kind)) : [];
          if (name === 'table') {
            const table = parseTable(parts, positioned, convertChildren);
            if (table.error) output.push(unsupported(range, table.error));
            else output.push({ type: 'table', rows: table.rows, widths: table.widths, fractional: table.fractional, mixedColumns: table.mixedColumns, hasBottomLine: table.hasBottomLine, ...range });
            continue;
          }
          const argsOnly = parts.filter((item) => ![K.LeftParen, K.RightParen, K.Comma].includes(item.node.kind));
          if (name === 'mm-knowledge') {
            const named = argsOnly.length === 1 && argsOnly[0].node.kind === K.Named ? argsOnly[0].node.children.filter((child) => ![K.Space, K.Colon, K.LineComment, K.BlockComment].includes(child.kind)) : [];
            const value = named.length === 2 && named[0].kind === K.Ident && named[0].fullText() === 'slug' ? staticString(named[1]) : null;
            if (typeof value === 'string' && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) output.push({ type: 'mm-knowledge', knowledgeSlug: value, ...range });
            else output.push(unsupported(range, '知识点引用需要有效的 slug 字符串'));
            continue;
          }
          if ((name === 'linebreak' || name === 'parbreak') && argsOnly.length === 0) {
            output.push({ type: name === 'linebreak' ? 'linebreak' : 'paragraph-break', ...range });
            continue;
          }
          if ((name === 'h' || name === 'v') && argsOnly.length === 1) {
            const length = staticLength(argsOnly[0].node);
            if (length !== null) {
              output.push({ type: name === 'h' ? 'horizontal-space' : 'vertical-space', length, ...range });
              continue;
            }
          }
          if (name === 'align' && argsOnly.length === 2 && argsOnly[1].node.kind === K.ContentBlock) {
            const alignment = staticAlignment(argsOnly[0].node);
            if (alignment) {
              output.push({ type: 'align', alignment, children: convertChildren(argsOnly[1].node, argsOnly[1].start), ...range });
              continue;
            }
          }
          if (name === 'link' && argsOnly.length >= 1 && argsOnly.length <= 2) {
            const target = staticString(argsOnly[0].node);
            const body = argsOnly[1];
            if (safeLink(target) && (!body || body.node.kind === K.ContentBlock || body.node.kind === K.Str)) {
              const children = body?.node.kind === K.ContentBlock ? convertChildren(body.node, body.start) : body ? [{ type: 'text', text: staticString(body.node), start: body.start, end: body.end }] : null;
              output.push({ type: 'link', href: target, text: target, children, ...range });
              continue;
            }
          }
          if (name === 'raw') {
            let text = null;
            let block = false;
            let valid = true;
            let hasBlock = false;
            for (const item of argsOnly) {
              if (item.node.kind === K.Str && text === null) text = staticString(item.node);
              else if (item.node.kind === K.Named) {
                const values = item.node.children.filter((child) => ![K.Space, K.Colon, K.LineComment, K.BlockComment].includes(child.kind));
                if (values.length === 2 && values[0].fullText() === 'block' && values[1].kind === K.Bool && !hasBlock) {
                  block = values[1].fullText() === 'true';
                  hasBlock = true;
                } else valid = false;
              } else valid = false;
            }
            if (valid && text !== null) {
              output.push({ type: 'raw', text, block, ...range });
              continue;
            }
          }
          if (name === 'highlight' && argsOnly.length >= 1 && argsOnly.length <= 2) {
            const body = argsOnly.at(-1);
            const parameter = argsOnly.length === 2 ? argsOnly[0].node : null;
            let color = '#fffd11a1';
            if (parameter?.kind === K.Named) {
              const values = parameter.children.filter((child) => ![K.Space, K.Colon, K.LineComment, K.BlockComment].includes(child.kind));
              color = values.length === 2 && values[0].fullText() === 'fill' ? (values[1].kind === K.None ? 'transparent' : staticColor(values[1])) : null;
            } else if (parameter) color = null;
            if (color && [K.ContentBlock, K.Str].includes(body.node.kind)) {
              const children = body.node.kind === K.ContentBlock ? convertChildren(body.node, body.start) : [{ type: 'text', text: staticString(body.node), start: body.start, end: body.end }];
              output.push({ type: 'highlight', color, children, ...range });
              continue;
            }
          }
          const question = parseMmQuestion(name, parts, positioned);
          if (question) {
            if (question.error) output.push(unsupported(range, question.error));
            else if (question.kind === 'blank') output.push({ type: 'mm-question-blank', width: question.width, ...range });
            else if (question.kind === 'options') {
              const options = question.bodies.map((body) => ({ start: body.start, end: body.end, children: convertChildren(body.node, body.start) }));
              output.push({ type: 'mm-question-options', columns: question.columns, options, ...range });
            } else {
              const title = question.title ? validateInline(convertChildren(question.title.node, question.title.start), '题目标题仅支持行内内容') : [];
              const children = question.body ? convertChildren(question.body.node, question.body.start) : [];
              const hasContent = (nodes) => nodes.some((item) => {
                if (['mm-question-options', 'paragraph-break', 'linebreak'].includes(item.type)) return false;
                if (item.children) return hasContent(item.children);
                if (['text', 'raw', 'unsupported'].includes(item.type)) return Boolean(item.text?.trim());
                return true;
              });
              output.push({ type: 'mm-question', source: question.source, questionId: question.id, difficulty: question.difficulty, titleNodes: title, hasTitle: hasContent(title), hasBody: hasContent(children), children, ...range });
            }
            continue;
          }
          const tag = parseMmTag(name, parts, positioned);
          if (tag) {
            if (tag.error) output.push(unsupported(range, tag.error));
            else {
              if (tag.warning) report(tag.warning.message, tag.warning.start, tag.warning.end);
              const children = validateInline(convertChildren(tag.body.node, tag.body.start), '标签仅支持行内内容');
              output.push({ type: 'mm-tag', color: tag.color, children, ...range });
            }
            continue;
          }
          const box = parseMmBox(name, parts, positioned);
          if (box) {
            if (box.error) output.push(unsupported(range, box.error));
            else {
              const title = box.title ? validateInline(convertChildren(box.title.node, box.title.start), '教学框标题仅支持行内内容') : [];
              const hasTitle = (nodes) => nodes.some((item) => item.children ? hasTitle(item.children) : item.type === 'text' ? Boolean(item.text.trim()) : Boolean(item.text?.trim()) || ['math', 'mm-test'].includes(item.type));
              output.push({ type: 'mm-box', title: box.config.title, tone: box.config.tone, icon: box.config.icon, titleNodes: title, hasTitle: hasTitle(title), children: convertChildren(box.body.node, box.body.start), ...range });
            }
            continue;
          }
          const block = parts.at(-1);
          const parameters = parts.slice(0, -1).filter((item) => ![K.LeftParen, K.RightParen, K.Comma].includes(item.node.kind));
          const hasBody = block?.node.kind === K.ContentBlock || block?.node.kind === K.Str;
          const type = { text: 'styled-text', strong: 'strong', emph: 'emph', underline: 'underline', strike: 'strike', overline: 'overline', sub: 'sub', super: 'super', smallcaps: 'smallcaps', hide: 'hidden', box: 'inline-box', block: 'block-box' }[name];
          const boxStyle = () => {
            const style = {};
            const seen = new Set();
            for (const item of parameters) {
              if (item.node.kind !== K.Named) return null;
              const fields = item.node.children.filter((child) => ![K.Space, K.Colon, K.LineComment, K.BlockComment].includes(child.kind));
              if (fields.length !== 2 || fields[0].kind !== K.Ident) return null;
              const key = fields[0].fullText();
              const value = fields[1];
              if (seen.has(key)) return null;
              seen.add(key);
              if (key === 'inset' || key === 'radius') {
                const length = staticLength(value);
                if (length === null) return null;
                style[key === 'inset' ? 'padding' : 'borderRadius'] = length;
              } else if (key === 'stroke') {
                const length = staticLength(value);
                const color = staticColor(value);
                if (value.kind === K.None) style.border = 'none';
                else if (length !== null && !length.endsWith('%')) style.border = `${length} solid currentColor`;
                else if (color) style.border = `0.5pt solid ${color}`;
                else return null;
              } else if (key === 'fill') {
                const color = staticColor(value);
                if (value.kind === K.None) style.backgroundColor = 'transparent';
                else if (color) style.backgroundColor = color;
                else return null;
              } else return null;
            }
            return { style, attrs: {} };
          };
          const textStyle = name === 'text' ? staticTextStyle(parameters) : name === 'box' ? boxStyle() : parameters.length ? null : { style: {}, attrs: {} };
          if (type && hasBody && textStyle) {
            const children = block.node.kind === K.ContentBlock ? convertChildren(block.node, block.start) : [{ type: 'text', text: staticString(block.node), start: block.start, end: block.end }];
            output.push({ type, ...textStyle, children, ...range });
          } else {
            const message = name?.startsWith('mm-') ? `未支持的 MM 宏或参数形式：${name}` : `暂不支持此 Typst 函数或参数形式：${name || kindName(expression.kind)}`;
            output.push(unsupported(range, message));
          }
        } else {
          const name = expression.kind === K.Ident ? expression.fullText() : expression.kind === K.FuncCall ? expression.children[0]?.fullText() : '';
          const message = name?.startsWith('mm-') ? `未支持的 MM 宏或参数形式：${name}` : `暂不支持此 Typst 代码表达式：${kindName(expression.kind)}`;
          output.push(unsupported(range, message));
        }
        continue;
      }
      const range = { start, end };
      switch (node.kind) {
        case K.Markup:
        case K.ContentBlock:
          output.push({ type: 'fragment', children: convertChildren(node, start), ...range });
          break;
        case K.Text:
          output.push({ type: 'text', text: node.fullText(), ...range });
          break;
        case K.Escape: {
          const value = node.fullText().slice(1);
          const unicode = /^u\{([0-9a-fA-F]+)\}$/.exec(value);
          const codepoint = unicode ? Number.parseInt(unicode[1], 16) : null;
          if (unicode && (codepoint > 0x10ffff || (codepoint >= 0xd800 && codepoint <= 0xdfff))) {
            output.push(unsupported(entry, '无效的 Unicode 转义'));
          } else {
            output.push({ type: 'text', text: unicode ? String.fromCodePoint(codepoint) : value, ...range });
          }
          break;
        }
        case K.Shorthand: {
          const value = node.fullText();
          if (Object.hasOwn(shorthands, value)) output.push({ type: 'text', text: shorthands[value], ...range });
          else output.push(unsupported(entry, '暂不支持此简写'));
          break;
        }
        case K.Space:
          output.push({ type: 'text', text: /[\n\r\v\f\u0085\u2028\u2029]/.test(node.fullText()) ? ' ' : node.fullText(), ...range });
          break;
        case K.Linebreak:
          output.push({ type: 'linebreak', ...range });
          break;
        case K.Parbreak:
          output.push({ type: 'paragraph-break', ...range });
          break;
        case K.Link: {
          const href = node.fullText();
          output.push({ type: 'link', href, text: href, ...range });
          break;
        }
        case K.TermItem: {
          const parts = positioned(node.children, start).filter((item) => item.node.kind === K.Markup);
          if (parts.length !== 2) output.push(unsupported(entry, '无法解析术语列表'));
          else output.push({ type: 'term-item', term: convertChildren(parts[0].node, parts[0].start), description: convertChildren(parts[1].node, parts[1].start), ...range });
          break;
        }
        case K.Strong:
        case K.Emph:
          output.push({ type: node.kind === K.Strong ? 'strong' : 'emph', children: convertChildren(node, start), ...range });
          break;
        case K.Heading: {
          const mark = node.children.find((child) => child.kind === K.HeadingMarker);
          output.push({ type: 'heading', level: Math.max(1, mark?.len || 1), children: convertChildren(node, start), ...range });
          break;
        }
        case K.ListItem:
          output.push({ type: 'list-item', children: convertChildren(node, start), ...range });
          break;
        case K.EnumItem: {
          const token = node.children.find((child) => child.kind === K.EnumMarker)?.fullText() || '+';
          const explicit = /^([0-9]+)\.$/.exec(token);
          enumNumber = explicit ? Number(explicit[1]) : enumNumber + 1;
          output.push({ type: 'enum-item', number: enumNumber, children: convertChildren(node, start), ...range });
          break;
        }
        case K.Raw: {
          const block = (node.children[0]?.len || 0) >= 3 && node.children.some((child) => child.kind === K.RawTrimmed && /[\n\r\v\f\u0085\u2028\u2029]/.test(child.fullText()));
          const text = node.children.filter((child) => child.kind === K.Text).map((child) => child.fullText()).join('\n');
          output.push({ type: 'raw', text, block, ...range });
          break;
        }
        case K.Equation: {
          const formula = source.slice(start + 1, Math.max(start + 1, end - 1));
          const display = /^\s/.test(formula) && /\s$/.test(formula);
          try {
            const html = normalizeMathHtml(renderToString(formula, { displayMode: display, strict: (warning) => { const begin = start + 1 + (warning.span?.start || 0); const finish = start + 1 + (warning.span?.end ?? formula.length); report(warning.message, begin, finish); return 'ignore'; } }));
            output.push({ type: 'math', html, display, ...range });
          } catch (error) {
            const begin = start + 1 + (error.span?.start || 0);
            const finish = start + 1 + (error.span?.end ?? formula.length);
            report(error.message || '数学公式暂无法渲染', begin, finish, 'error');
            output.push({ type: 'unsupported', text: source.slice(start, end), ...range });
          }
          break;
        }
        case K.Error:
          output.push({ type: 'unsupported', text: source.slice(start, end), ...range });
          break;
        default:
          output.push(unsupported(entry, `暂不支持此 Typst 语法：${kindName(node.kind)}`));
      }
    }
    if (!styles.length) return output;
    let tail = [];
    for (let i = styles.length - 1; i >= 0; i--) {
      const children = output.slice(styles[i].index, styles[i + 1]?.index ?? output.length).concat(tail);
      tail = children.length ? [{ type: 'styled-scope', style: styles[i].style, attrs: styles[i].attrs, children, start: children[0].start, end: children.at(-1).end }] : [];
    }
    return output.slice(0, styles[0].index).concat(tail);
  };
  return { nodes: convertChildren(root, 0), diagnostics };
}
