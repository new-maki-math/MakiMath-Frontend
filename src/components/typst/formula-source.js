import { parse, renderToString, SyntaxKind } from 'typlet';

import { convertFormula, formulaLimit } from './formula-conversion.js';

const marker = '/*mm-formula:v1:';
const maxMetadataLength = 64000;

export function formatTypstFormula(body, display) {
  return display ? '$ ' + body + ' $' : '$' + body + '$';
}

export function validateTypstFormula(body, display) {
  const source = formatTypstFormula(body, display);
  const ast = parse(source, {
    mode: 'markup'
  });
  if (
    ast.diagnostics().length ||
    ast.children.length !== 1 ||
    ast.children[0].kind !== SyntaxKind.Equation
  ) {
    throw new Error('生成的 Typst 不是独立的数学公式');
  }
  renderToString(body, {
    displayMode: display,
    strict: (warning) => {
      if (/has no glyph for it; drawn as MathML/i.test(warning.message)) {
        return 'ignore';
      }
      throw new Error(warning.message);
    }
  });
}

function encodeRecord(record) {
  const bytes = new TextEncoder().encode(JSON.stringify(record));
  const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  if (encoded.length > maxMetadataLength) {
    throw new Error('公式的原文记录过长');
  }
  return encoded;
}

function decodeRecord(comment) {
  const encoded = comment.slice(marker.length, -2);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > maxMetadataLength) {
    return null;
  }
  try {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const record = JSON.parse(
      new TextDecoder('utf-8', {
        fatal: true
      }).decode(bytes)
    );
    return ['latex', 'typst', 'equation'].every(
      (key) => typeof record?.[key] === 'string' && record[key].length <= formulaLimit + 4
    )
      ? record
      : null;
  } catch {
    return null;
  }
}

export function serializeFormula(body, display, originals) {
  const equation = formatTypstFormula(body, display);
  return (
    equation +
    marker +
    encodeRecord({
      ...originals,
      equation
    }) +
    '*/'
  );
}

function collectSourceRanges(source) {
  const formulas = [];
  const protectedRanges = [];
  const stack = [
    {
      node: parse(source, {
        mode: 'markup'
      }),
      start: 0
    }
  ];
  while (stack.length) {
    const { node, start } = stack.pop();
    let offset = start;
    for (const [index, child] of node.children.entries()) {
      const childStart = offset;
      offset += child.len;
      if (
        [SyntaxKind.Raw, SyntaxKind.Str, SyntaxKind.LineComment, SyntaxKind.BlockComment].includes(
          child.kind
        )
      ) {
        protectedRanges.push({
          start: childStart,
          end: offset
        });
        continue;
      }
      if (child.kind === SyntaxKind.Equation) {
        const next = node.children[index + 1];
        const comment =
          next?.kind === SyntaxKind.BlockComment && next.fullText().startsWith(marker)
            ? next.fullText()
            : '';
        const end = offset + comment.length;
        const equation = source.slice(childStart, offset);
        const record = comment ? decodeRecord(comment) : null;
        formulas.push({
          start: childStart,
          end,
          equation,
          record
        });
        protectedRanges.push({
          start: childStart,
          end
        });
        continue;
      }
      if (child.children.length) {
        stack.push({
          node: child,
          start: childStart
        });
      }
    }
  }
  return {
    formulas: formulas.sort((a, b) => a.start - b.start),
    protectedRanges: protectedRanges.sort((a, b) => a.start - b.start)
  };
}

function formatLatex(body, display) {
  return display ? '\\[' + body + '\\]' : '\\(' + body + '\\)';
}

export function projectTypstDocument(source) {
  const originals = new Map();
  if (!source.includes(marker)) {
    return {
      source,
      originals
    };
  }
  const { formulas } = collectSourceRanges(source);
  const parts = [];
  let last = 0;
  for (const { start, end, equation, record } of formulas) {
    if (!originals.has(equation)) {
      originals.set(equation, []);
    }
    const original = record?.equation === equation ? source.slice(start, end) : null;
    originals.get(equation).push(original);
    if (record) {
      parts.push(source.slice(last, start), equation);
      last = end;
    }
  }
  parts.push(source.slice(last));
  return {
    source: parts.join(''),
    originals
  };
}

export function restoreTypstOriginals(source, originals) {
  if (!originals.size) {
    return source;
  }
  const { formulas } = collectSourceRanges(source);
  const occurrences = new Map();
  const parts = [];
  let last = 0;
  for (const { start, end, equation, record } of formulas) {
    const index = occurrences.get(equation) ?? 0;
    occurrences.set(equation, index + 1);
    const original = originals.get(equation)?.[index];
    if (original && !record) {
      parts.push(source.slice(last, start), original);
      last = end;
    }
  }
  parts.push(source.slice(last));
  return parts.join('');
}

export function projectLatexDocument(source) {
  const { formulas } = collectSourceRanges(source);
  const originals = new Map();
  const parts = [];
  let last = 0;
  let skipped = 0;
  for (const { start, end, equation, record } of formulas) {
    parts.push(source.slice(last, start));
    last = end;
    let latex;
    try {
      if (record?.equation === equation) {
        latex = record.latex;
      } else {
        const result = convertFormula(equation, 'typst');
        latex = formatLatex(result.latex, result.display);
      }
    } catch {
      skipped++;
      parts.push(source.slice(start, end));
      continue;
    }
    if (!originals.has(latex)) {
      originals.set(latex, []);
    }
    originals.get(latex).push(source.slice(start, end));
    parts.push(latex);
  }
  parts.push(source.slice(last));
  return {
    source: parts.join(''),
    originals,
    skipped
  };
}

function isEscaped(source, index) {
  let slashCount = 0;
  for (let i = index - 1; source[i] === '\\'; i--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

export function convertLatexDocument(source, originals = new Map()) {
  const { protectedRanges } = collectSourceRanges(source);
  const useCount = new Map();
  const parts = [];
  let rangeIndex = 0;
  let start = -1;
  let last = 0;
  let closing = '';
  for (const match of source.matchAll(/\\[()[\]]/g)) {
    const index = match.index;
    if (isEscaped(source, index)) {
      continue;
    }
    if (start === -1) {
      while (protectedRanges[rangeIndex]?.end <= index) {
        rangeIndex++;
      }
      if (protectedRanges[rangeIndex]?.start <= index) {
        continue;
      }
      if (!['\\(', '\\['].includes(match[0])) {
        throw new Error('存在没有起始符号的 LaTeX 公式');
      }
      start = index;
      closing = match[0] === '\\(' ? '\\)' : '\\]';
      continue;
    }
    // 公式内部的转义和分隔符交由公式解析器校验。
    if (match[0] !== closing) {
      continue;
    }
    const end = index + match[0].length;
    const latex = source.slice(start, end);
    const occurrence = useCount.get(latex) ?? 0;
    useCount.set(latex, occurrence + 1);
    const original = originals.get(latex)?.[occurrence];
    parts.push(source.slice(last, start));
    if (original) {
      parts.push(original);
    } else {
      try {
        const result = convertFormula(latex, 'latex');
        validateTypstFormula(result.typst, result.display);
        parts.push(
          serializeFormula(result.typst, result.display, {
            latex,
            typst: formatTypstFormula(result.typst, result.display)
          })
        );
      } catch (error) {
        const line = source.slice(0, start).split('\n').length;
        throw new Error('第 ' + line + ' 行公式：' + error.message);
      }
    }
    last = end;
    start = -1;
  }
  if (start !== -1) {
    throw new Error('LaTeX 公式尚未闭合，需要 ' + closing);
  }
  parts.push(source.slice(last));
  return parts.join('');
}
