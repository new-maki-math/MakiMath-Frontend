const htmlElements = new Set(['a', 'b', 'br', 'code', 'em', 'i', 'mark', 'span', 'strong', 'sub', 'sup', 'u']);
const voidElements = new Set(['br']);
const integrationPoints = new Set(['mtext', 'mi', 'mn', 'mo', 'ms']);

// 为数学内容中的普通元素补充浏览器解析边界
export function normalizeMathHtml(html) {
  const stack = [];
  const tokens = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  let result = '';
  let offset = 0;
  for (const match of html.matchAll(tokens)) {
    const token = match[0];
    const name = match[1].toLowerCase();
    const closing = token.startsWith('</');
    result += html.slice(offset, match.index);
    offset = match.index + token.length;
    if (closing) {
      const entry = stack[stack.length - 1];
      result += token;
      if (entry?.name === name) {
        stack.pop();
        if (entry.wrapped) {
          stack.pop();
          result += '</mtext>';
        }
      }
      continue;
    }
    const mathIndex = stack.findLastIndex((entry) => entry.name === 'math');
    const inMathText = stack.some((entry, index) => index > mathIndex && integrationPoints.has(entry.name));
    const wrapped = mathIndex >= 0 && !inMathText && htmlElements.has(name);
    if (wrapped) result += '<mtext>';
    result += token;
    if (voidElements.has(name) || /\/\s*>$/.test(token)) {
      if (wrapped) result += '</mtext>';
    } else {
      if (wrapped) stack.push({ name: 'mtext', synthetic: true });
      stack.push({ name, wrapped });
    }
  }
  return result + html.slice(offset);
}
