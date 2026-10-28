import { SyntaxKind as K } from 'typlet';

export function staticString(node) {
  if (node?.kind !== K.Str) return null;
  const text = node.fullText();
  if (!text.startsWith('"') || !text.endsWith('"')) return null;
  return text.slice(1, -1).replace(/\\(?:[\\"nrt]|u\{[0-9a-fA-F]+\})/g, (escape) => {
    const basic = { '\\\\': '\\', '\\"': '"', '\\n': '\n', '\\r': '\r', '\\t': '\t' };
    if (Object.hasOwn(basic, escape)) return basic[escape];
    const codepoint = Number.parseInt(escape.slice(3, -1), 16);
    return codepoint <= 0x10ffff && !(codepoint >= 0xd800 && codepoint <= 0xdfff) ? String.fromCodePoint(codepoint) : escape;
  });
}

export function safeLink(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function staticLength(node, allowNegative = false) {
  if (allowNegative && node?.kind === K.Unary) {
    const parts = node.children.filter((child) => ![K.Space, K.LineComment, K.BlockComment].includes(child.kind));
    if (parts.length === 2 && parts[0].kind === K.Minus) {
      const length = staticLength(parts[1]);
      return length === null ? null : `-${length}`;
    }
  }
  const text = node?.fullText();
  if (node?.kind === K.Int && text === '0') return '0';
  return node?.kind === K.Numeric && /^(?:\d+(?:\.\d+)?|\.\d+)(?:pt|mm|cm|in|em|%)$/.test(text) ? text : null;
}

export function staticAlignment(node) {
  const value = node?.fullText();
  return node?.kind === K.Ident && ['left', 'center', 'right'].includes(value) ? value : null;
}

const colors = Object.freeze({
  black: '#000000', gray: '#aaaaaa', silver: '#dddddd', white: '#ffffff', navy: '#001f3f',
  blue: '#0074d9', aqua: '#7fdbff', teal: '#39cccc', eastern: '#239dad', purple: '#b10dc9',
  fuchsia: '#f012be', maroon: '#85144b', red: '#ff4136', orange: '#ff851b', yellow: '#ffdc00',
  olive: '#3d9970', green: '#2ecc40', lime: '#01ff70'
});

export function staticColor(node) {
  if (!node) return null;
  if (node.kind === K.Ident && Object.hasOwn(colors, node.fullText())) return colors[node.fullText()];
  if (node.kind === K.FieldAccess && /^color\.[a-z]+$/.test(node.fullText())) return colors[node.fullText().slice(6)] || null;
  if (node.kind !== K.FuncCall) return null;
  const call = node.children.filter((child) => ![K.Space, K.LineComment, K.BlockComment].includes(child.kind));
  if (call.length !== 2 || !['rgb', 'color.rgb'].includes(call[0].fullText()) || call[1].kind !== K.Args) return null;
  const args = call[1].children.filter((child) => ![K.Space, K.LeftParen, K.RightParen, K.Comma, K.LineComment, K.BlockComment].includes(child.kind));
  if (args.length === 1) {
    const value = staticString(args[0]);
    return /^(?:#)?(?:[\da-fA-F]{3}|[\da-fA-F]{4}|[\da-fA-F]{6}|[\da-fA-F]{8})$/.test(value || '') ? `#${value.replace(/^#/, '')}` : null;
  }
  if (args.length !== 3 && args.length !== 4) return null;
  const channels = args.map((arg) => {
    const raw = arg.fullText();
    if (arg.kind === K.Int && /^\d+$/.test(raw) && Number(raw) <= 255) return Number(raw) / 255;
    if (arg.kind === K.Numeric && /^(?:\d+(?:\.\d+)?|\.\d+)%$/.test(raw) && Number(raw.slice(0, -1)) <= 100) return Number(raw.slice(0, -1)) / 100;
    return null;
  });
  if (channels.some((channel) => channel === null)) return null;
  return `rgba(${channels.slice(0, 3).map((channel) => `${channel * 100}%`).join(', ')}, ${channels[3] ?? 1})`;
}

export function staticFontSettings(node, variations = false) {
  if (!node || (node.kind !== K.Dict && (!(!variations && node.kind === K.Array)))) return null;
  const items = node.children.filter((child) => ![K.Space, K.LeftParen, K.RightParen, K.Comma, K.Colon, K.LineComment, K.BlockComment].includes(child.kind));
  const result = [];
  for (const item of items) {
    let key;
    let value;
    if (node.kind === K.Array) {
      key = staticString(item);
      value = '1';
    } else {
      if (![K.Named, K.Keyed].includes(item.kind)) return null;
      const pair = item.children.filter((child) => ![K.Space, K.Colon, K.LineComment, K.BlockComment].includes(child.kind));
      if (pair.length !== 2) return null;
      key = pair[0].kind === K.Ident ? pair[0].fullText() : staticString(pair[0]);
      const number = pair[1].fullText();
      if (variations ? !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(number) : !/^\d+$/.test(number)) return null;
      if (![K.Int, K.Float, K.Unary].includes(pair[1].kind)) return null;
      value = number;
    }
    if (!/^[a-zA-Z0-9]{4}$/.test(key || '')) return null;
    result.push(`"${key}" ${value}`);
  }
  return result;
}
