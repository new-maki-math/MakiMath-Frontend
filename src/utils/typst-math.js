import { renderToString } from 'typlet';

// 将独立分隔符转换为数学分隔符调用
function normalizeMath(source) {
  return source.replace(/"(?:\\.|[^"\\])*"|`[^`]*`|(?<![\w.#])mid(?![\w.])(?!\s*\()/g, (match) => {
    return match === 'mid' ? 'mid(|)' : match;
  });
}

// 统一渲染数学公式
export function renderTypstMath(source, displayMode = false) {
  return renderToString(normalizeMath(source), { displayMode, output: 'html' });
}
