export const formulaLimit = 4096;

const symbols = new Map(
  (
    'alpha beta gamma delta epsilon:epsilon.alt varepsilon:epsilon zeta eta theta vartheta:theta.alt iota kappa lambda mu nu xi ' +
    'pi varpi:pi.alt rho varrho:rho.alt sigma varsigma:sigma.alt tau upsilon phi:phi.alt varphi:phi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega ' +
    'infty:infinity cdot:dot times div pm:plus.minus mp:minus.plus leq:lt.eq geq:gt.eq ' +
    'neq:eq.not approx equiv sim:tilde simeq:tilde.eq propto:prop in notin:in.not subset subseteq:subset.eq supset cup cap ' +
    'to:arrow.r leftarrow:arrow.l leftrightarrow:arrow.l.r Rightarrow:arrow.r.double ' +
    'mapsto:arrow.r.bar partial nabla forall exists emptyset ell ldots:dots.h cdots:dots.c vdots:dots.v ' +
    'sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh log ln exp lim min max sup inf det gcd ' +
    'sum prod int:integral iint:integral.double oint:integral.cont'
  )
    .split(' ')
    .map((pair) => {
      const [latex, typst = latex] = pair.split(':');
      return [latex, typst];
    })
);
const reverseSymbols = new Map(Array.from(symbols, ([latex, typst]) => [typst, latex]));
const latexAliases = new Map([
  ['le', 'leq'],
  ['ge', 'geq'],
  ['ne', 'neq'],
  ['rightarrow', 'to'],
  ['dots', 'ldots']
]);
const latexStyles = new Map([
  ['mathbb', 'bb'],
  ['boldsymbol', 'bold'],
  ['mathit', 'italic'],
  ['mathrm', 'upright'],
  ['mathcal', 'cal'],
  ['mathfrak', 'frak']
]);
const typstStyles = new Map(Array.from(latexStyles, ([latex, typst]) => [typst, latex]));
const latexSpaces = new Map([
  [',', 'thin'],
  [':', 'med'],
  [';', 'thick'],
  ['quad', 'quad'],
  ['qquad', 'wide']
]);
const typstSpaces = new Map(Array.from(latexSpaces, ([latex, typst]) => [typst, latex]));
const literals = /^[0-9A-Za-z+\-=<>!.,:*/;|'()[\]]$/;
const delimiters = new Set([
  '(',
  ')',
  '[',
  ']',
  '|',
  '.',
  '{',
  '}',
  'chevron.l',
  'chevron.r',
  'bar.v.double'
]);
const latexDelimiters = new Map([
  ['{', '{'],
  ['}', '}'],
  ['lbrace', '{'],
  ['rbrace', '}'],
  ['langle', 'chevron.l'],
  ['rangle', 'chevron.r'],
  ['vert', '|'],
  ['Vert', 'bar.v.double'],
  ['|', 'bar.v.double']
]);
const matrices = new Map([
  ['matrix', 'none'],
  ['pmatrix', '('],
  ['bmatrix', '['],
  ['Bmatrix', '{'],
  ['vmatrix', '|'],
  ['Vmatrix', '‖']
]);
const matrixEnvironments = new Map(Array.from(matrices, ([name, delimiter]) => [delimiter, name]));
const closingFence = {
  '(': ')',
  '[': ']',
  '{': '}',
  '|': '|',
  'chevron.l': 'chevron.r',
  'bar.v.double': 'bar.v.double'
};
const maxDepth = 48;
const end = '';

export function splitFormula(source, language) {
  if (source.length > formulaLimit) {
    throw new Error('公式不能超过 ' + formulaLimit + ' 字符');
  }
  const value = source.trim();
  if (language === 'latex') {
    for (const [open, close, display] of [
      ['\\[', '\\]', true],
      ['\\(', '\\)', false],
      ['$$', '$$', true]
    ]) {
      if (value.startsWith(open)) {
        if (value.length < open.length + close.length || !value.endsWith(close)) {
          throw new Error('公式分隔符尚未闭合');
        }
        return {
          body: value.slice(open.length, -close.length).trim(),
          display
        };
      }
    }
  }
  if (value.startsWith('$')) {
    if (value.length < 2 || !value.endsWith('$')) {
      throw new Error('公式分隔符尚未闭合');
    }
    const display = language === 'typst' && /^\$\s[\s\S]*\s\$$/.test(value);
    return {
      body: value.slice(1, -1).trim(),
      display
    };
  }
  return {
    body: value,
    display: null
  };
}

function tokenize(source, language) {
  const tokens = [];
  const pattern =
    language === 'latex'
      ? /\\(?:[A-Za-z]+|[^\r\n])|%[^\r\n]*|\s+|[\s\S]/gu
      : /"(?:[^"\\]|\\.)*"|[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*|[0-9]+(?:\.[0-9]+)?|<=|>=|!=|->|<-|\s+|[\s\S]/gu;
  for (const match of source.matchAll(pattern)) {
    if (/^\s/u.test(match[0]) || (language === 'latex' && match[0].startsWith('%'))) {
      continue;
    }
    tokens.push({
      value: match[0],
      index: match.index
    });
  }
  tokens.push({
    value: end,
    index: source.length
  });
  return tokens;
}

function fail(message) {
  throw new Error(message);
}

function nodeSequence(nodes) {
  return nodes.flatMap((node) => (node[0] === 'sequence' ? node[1] : [node]));
}

function atomize(nodes) {
  return nodes.length === 1 ? nodes[0] : ['sequence', nodes];
}

function textToLatex(text) {
  return text.replace(/[\\{}%$#&_~^]/g, (char) => {
    if (char === '\\') {
      return '\\textbackslash{}';
    }
    if (char === '~') {
      return '\\textasciitilde{}';
    }
    if (char === '^') {
      return '\\textasciicircum{}';
    }
    return '\\' + char;
  });
}

class FormulaParser {
  constructor(source, language) {
    this.source = source;
    this.language = language;
    this.tokens = tokenize(source, language);
    this.index = 0;
    this.depth = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.index + offset]?.value ?? end;
  }

  error(message) {
    fail(message + '（位置 ' + (this.tokens[this.index].index + 1) + '）');
  }

  take() {
    const token = this.peek();
    if (!token) {
      this.error('公式还没写完');
    }
    this.index++;
    return token;
  }

  accept(token) {
    if (this.peek() !== token) {
      return false;
    }
    this.index++;
    return true;
  }

  expect(token) {
    if (!this.accept(token)) {
      this.error('此处需要 ' + token);
    }
  }

  sequence(stops = []) {
    this.depth++;
    if (this.depth > maxDepth) {
      this.error('公式嵌套过深');
    }
    const output = [];
    while (this.peek() && !stops.includes(this.peek())) {
      const left = this.scripted();
      if (this.language === 'typst' && this.accept('/')) {
        const right = this.scripted();
        if (this.peek() === '/') {
          this.error('连续除号需要使用 frac 明确分组');
        }
        output.push(['frac', this.fractionOperand(left), this.fractionOperand(right)]);
      } else {
        output.push(left);
      }
    }
    this.depth--;
    return nodeSequence(output);
  }

  fractionOperand(node) {
    return node[0] === 'fence' && node[1] === '(' && node[2] === ')' && !node[4]
      ? node[3]
      : nodeSequence([node]);
  }

  scripted() {
    const base = this.atom();
    if (this.language === 'latex' && base[0] === 'number') {
      while (/^[0-9]$/.test(this.peek())) {
        base[1] += this.take();
      }
      if (this.peek() === '.' && /^[0-9]$/.test(this.peek(1))) {
        base[1] += this.take();
        while (/^[0-9]$/.test(this.peek())) {
          base[1] += this.take();
        }
      }
    }
    const scripts = {
      _: null,
      '^': null
    };
    while (this.peek() === '_' || this.peek() === '^') {
      const operator = this.take();
      if (scripts[operator] !== null) {
        this.error('重复的上下标');
      }
      scripts[operator] =
        this.language === 'latex' ? this.latexArgument() : this.typstScriptArgument();
    }
    if (scripts._ === null && scripts['^'] === null) {
      return base;
    }
    const normalizedBase = base[0] === 'sequence' ? atomize(base[1]) : base;
    return ['script', normalizedBase, scripts._, scripts['^']];
  }

  group(open, close) {
    this.expect(open);
    const value = this.sequence([close]);
    this.expect(close);
    return value;
  }

  latexArgument() {
    return this.peek() === '{' ? this.group('{', '}') : nodeSequence([this.atom()]);
  }

  typstScriptArgument() {
    const argument = this.peek() === '(' ? this.group('(', ')') : nodeSequence([this.atom()]);
    if (!argument.length) {
      this.error('上下标不能为空');
    }
    return argument;
  }

  delimiter() {
    const value = this.take();
    const normalized =
      this.language === 'latex' && value.startsWith('\\')
        ? latexDelimiters.get(value.slice(1))
        : ({
            'brace.l': '{',
            'brace.r': '}'
          }[value] ?? value);
    if (!delimiters.has(normalized)) {
      this.error('不支持的定界符 ' + value);
    }
    return normalized;
  }

  plainFence() {
    const opening = this.take();
    const closing = closingFence[opening];
    const value = this.sequence([closing]);
    this.expect(closing);
    return ['fence', opening, closing, value, false];
  }

  atom() {
    this.depth++;
    if (this.depth > maxDepth) {
      this.error('公式嵌套过深');
    }
    const node = this.language === 'latex' ? this.latexAtom() : this.typstAtom();
    this.depth--;
    return node;
  }

  latexAtom() {
    const token = this.take();
    if (token === '{') {
      this.index--;
      return ['sequence', this.group('{', '}')];
    }
    if (!token.startsWith('\\')) {
      if (/^[0-9]$/.test(token)) {
        return ['number', token];
      }
      if (token === '(' || token === '[') {
        this.index--;
        return this.plainFence();
      }
      if (literals.test(token) && !')]'.includes(token)) {
        return ['literal', token];
      }
      this.error('不支持的 LaTeX 字符 ' + token);
    }
    const name = latexAliases.get(token.slice(1)) ?? token.slice(1);
    if (symbols.has(name)) {
      return ['symbol', symbols.get(name)];
    }
    if (latexSpaces.has(name)) {
      return ['space', latexSpaces.get(name)];
    }
    if (name === 'mathbf') {
      return ['style', 'upright', [['style', 'bold', this.latexArgument()]]];
    }
    if (latexStyles.has(name)) {
      return ['style', latexStyles.get(name), this.latexArgument()];
    }
    if (['frac', 'dfrac', 'tfrac'].includes(name)) {
      const fraction = ['frac', this.latexArgument(), this.latexArgument()];
      return name === 'frac'
        ? fraction
        : ['sized-frac', name === 'dfrac' ? 'display' : 'inline', fraction];
    }
    if (name === 'sqrt') {
      const degree = this.peek() === '[' ? this.group('[', ']') : null;
      return ['root', degree, this.latexArgument()];
    }
    if (name === 'text') {
      return ['text', this.latexText()];
    }
    if (name === 'left') {
      const opening = this.delimiter();
      const body = this.sequence(['\\right']);
      this.expect('\\right');
      return ['fence', opening, this.delimiter(), body, true];
    }
    if (name === 'begin') {
      return this.latexEnvironment();
    }
    if (name === '{' || name === '}') {
      return ['literal', name];
    }
    this.error('暂不支持 LaTeX 命令 ' + token);
  }

  latexText() {
    const start = this.tokens[this.index].index;
    this.expect('{');
    const text = this.source.slice(start + 1);
    const match =
      /^(?:\\(?:textbackslash\{\}|textasciitilde\{\}|textasciicircum\{\}|[{}%$#&_])|[^\\{}%$#&_~^])*\}/u.exec(
        text
      );
    if (!match) {
      this.error('文本命令包含不支持的转义、嵌套或未闭合的花括号');
    }
    const nextIndex = start + 1 + match[0].length;
    while (this.tokens[this.index].index < nextIndex) {
      this.index++;
    }
    return match[0].slice(0, -1).replace(
      /\\(textbackslash\{\}|textasciitilde\{\}|textasciicircum\{\}|.)/gu,
      (_, value) =>
        ({
          'textbackslash{}': '\\',
          'textasciitilde{}': '~',
          'textasciicircum{}': '^'
        })[value] ?? value
    );
  }

  latexEnvironment() {
    const name = this.latexText();
    if (!matrices.has(name) && name !== 'cases') {
      this.error('暂不支持 LaTeX 环境 ' + name);
    }
    const rows = this.rows('&', '\\\\', ['\\end']);
    this.expect('\\end');
    if (this.latexText() !== name) {
      this.error('LaTeX 环境没有正确闭合');
    }
    return name === 'cases' ? ['cases', rows] : ['matrix', matrices.get(name), rows];
  }

  rows(column, row, ends) {
    const rows = [];
    do {
      const cells = [];
      do {
        cells.push(this.sequence([column, row, ...ends]));
      } while (this.accept(column));
      rows.push(cells);
    } while (this.accept(row));
    if (
      rows.some((cells) => cells.length !== rows[0].length || cells.some((cell) => !cell.length))
    ) {
      this.error('矩阵或分段函数的各行需要有相同数量的非空项');
    }
    return rows;
  }

  typstAtom() {
    const token = this.take();
    if (token.startsWith('"')) {
      try {
        const value = JSON.parse(token);
        if (/[^\S ]/u.test(value)) {
          this.error('公式文本仅支持普通空格');
        }
        return ['text', value];
      } catch {
        this.error('无效的 Typst 文本');
      }
    }
    if (token === '(' || token === '[' || token === '{') {
      this.index--;
      return this.plainFence();
    }
    const shorthand = {
      '<=': 'lt.eq',
      '>=': 'gt.eq',
      '!=': 'eq.not',
      '->': 'arrow.r',
      '<-': 'arrow.l'
    }[token];
    if (shorthand) {
      return ['symbol', shorthand];
    }
    if (reverseSymbols.has(token)) {
      return ['symbol', token];
    }
    if (typstSpaces.has(token)) {
      return ['space', token];
    }
    if (typstStyles.has(token)) {
      return ['style', token, this.group('(', ')')];
    }
    if (token === 'display' || token === 'inline') {
      const value = this.group('(', ')');
      if (value.length !== 1 || value[0][0] !== 'frac') {
        this.error('目前只支持给分数指定行内或独立公式样式');
      }
      return ['sized-frac', token, value[0]];
    }
    if (token === 'frac' || token === 'root' || token === 'sqrt') {
      this.expect('(');
      const first = this.sequence([',', ')']);
      if (token === 'sqrt') {
        this.expect(')');
        return ['root', null, first];
      }
      this.expect(',');
      const second = this.sequence([')']);
      this.expect(')');
      return [token, first, second];
    }
    if (token === 'group' || token === 'attach' || token === 'limits' || token === 'scripts') {
      this.error('暂不支持 Typst 结构 ' + token);
    }
    if (token === 'lr') {
      this.expect('(');
      const opening = this.delimiter();
      const closing = closingFence[opening];
      if (!closing) {
        this.error('暂不支持这种 Typst 定界符组合');
      }
      const body = this.sequence([closing]);
      this.expect(closing);
      this.expect(')');
      return ['fence', opening, closing, body, true];
    }
    if (token === 'mat') {
      this.expect('(');
      let delimiter = '(';
      if (this.accept('delim')) {
        this.expect(':');
        const value = this.take();
        delimiter = value === 'none' ? value : JSON.parse(value);
        if (!matrixEnvironments.has(delimiter)) {
          this.error('不支持此矩阵定界符');
        }
        this.expect(',');
      }
      const rows = this.rows(',', ';', [')']);
      this.expect(')');
      return ['matrix', delimiter, rows];
    }
    if (token === 'cases') {
      this.expect('(');
      const rows = this.rows('&', ',', [')']);
      this.expect(')');
      return ['cases', rows];
    }
    if (token === 'brace.l' || token === 'brace.r') {
      return ['literal', token.endsWith('l') ? '{' : '}'];
    }
    if (token === 'slash') {
      return ['literal', '/'];
    }
    if (token === 'comma') {
      return ['literal', ','];
    }
    if (token === 'semi') {
      return ['literal', ';'];
    }
    if (/^[0-9]+(?:\.[0-9]+)?$/.test(token)) {
      return ['number', token];
    }
    if (literals.test(token) && !')]/'.includes(token)) {
      return ['literal', token];
    }
    this.error('暂不支持 Typst 写法 ' + token);
  }
}

function latexFence(value) {
  return (
    {
      '{': '\\{',
      '}': '\\}',
      'chevron.l': '\\langle',
      'chevron.r': '\\rangle',
      'bar.v.double': '\\Vert'
    }[value] ?? value
  );
}

function typstFence(value) {
  return (
    {
      '{': 'brace.l',
      '}': 'brace.r'
    }[value] ?? value
  );
}

function renderNode(node, language) {
  const [kind, a, b, c, d] = node;
  const latex = language === 'latex';
  const render = (nodes) => renderSequence(nodes, language);
  switch (kind) {
    case 'number':
      return a;
    case 'literal':
      if (a === '{' || a === '}') {
        return latex ? '\\' + a : a === '{' ? 'brace.l' : 'brace.r';
      }
      if (a === '/' && !latex) {
        return 'slash';
      }
      if (a === ',' && !latex) {
        return 'comma';
      }
      if (a === ';' && !latex) {
        return 'semi';
      }
      return a;
    case 'symbol':
      return latex ? '\\' + reverseSymbols.get(a) : a;
    case 'space':
      return latex ? '\\' + typstSpaces.get(a) : a;
    case 'text':
      return latex ? '\\text{' + textToLatex(a) + '}' : JSON.stringify(a);
    case 'style':
      if (latex && a === 'upright' && b.length === 1 && b[0][0] === 'style' && b[0][1] === 'bold') {
        return '\\mathbf{' + render(b[0][2]) + '}';
      }
      return latex ? '\\' + typstStyles.get(a) + '{' + render(b) + '}' : a + '(' + render(b) + ')';
    case 'sequence':
      return render(a);
    case 'frac':
      return latex
        ? '\\frac{' + render(a) + '}{' + render(b) + '}'
        : 'frac(' + render(a) + ', ' + render(b) + ')';
    case 'sized-frac':
      return latex
        ? (a === 'display' ? '\\dfrac' : '\\tfrac') + '{' + render(b[1]) + '}{' + render(b[2]) + '}'
        : a + '(' + renderNode(b, language) + ')';
    case 'root':
      return latex
        ? '\\sqrt' + (a === null ? '' : '[' + render(a) + ']') + '{' + render(b) + '}'
        : a === null
          ? 'sqrt(' + render(b) + ')'
          : 'root(' + render(a) + ', ' + render(b) + ')';
    case 'script': {
      if (a[0] === 'sequence' && !latex) {
        fail('Typst 暂不支持这个复合底数的上下标转换');
      }
      const base =
        latex && a[0] === 'sequence' ? '{' + render(a[1]) + '}' : renderNode(a, language);
      return (
        base +
        [
          [b, '_'],
          [c, '^']
        ]
          .map(([script, operator]) => {
            if (script === null) {
              return '';
            }
            const value = render(script);
            return operator + (latex ? '{' + value + '}' : '(' + value + ')');
          })
          .join('')
      );
    }
    case 'fence': {
      const body = render(c);
      if (!d) {
        return a + body + b;
      }
      return latex
        ? '\\left' + latexFence(a) + ' ' + body + ' \\right' + latexFence(b)
        : 'lr(' + typstFence(a) + ' ' + body + ' ' + typstFence(b) + ')';
    }
    case 'matrix':
    case 'cases': {
      const matrix = kind === 'matrix';
      const rows = matrix ? b : a;
      if (latex) {
        const name = matrix ? matrixEnvironments.get(a) : 'cases';
        return (
          '\\begin{' +
          name +
          '}' +
          rows.map((row) => row.map(render).join(' & ')).join(' \\\\ ') +
          '\\end{' +
          name +
          '}'
        );
      }
      return matrix
        ? 'mat(delim: ' +
            (a === 'none' ? 'none' : JSON.stringify(a)) +
            ', ' +
            rows.map((row) => row.map(render).join(', ')).join('; ') +
            ')'
        : 'cases(' + rows.map((row) => row.map(render).join(' & ')).join(', ') + ')';
    }
    default:
      fail('无法转换此公式结构');
  }
}

function renderSequence(nodes, language) {
  return nodes.map((node) => renderNode(node, language)).join(' ');
}

export function parseFormula(source, language) {
  const { body, display } = splitFormula(source, language);
  if (!body) {
    fail('请输入公式');
  }
  const parser = new FormulaParser(body, language);
  const tree = parser.sequence();
  if (!tree.length) {
    fail('请输入公式');
  }
  return {
    tree,
    display
  };
}

export function convertFormula(source, language) {
  const { tree, display } = parseFormula(source, language);
  const signature = JSON.stringify(tree);
  const converted = {};
  for (const target of ['latex', 'typst']) {
    const output = renderSequence(tree, target);
    if (JSON.stringify(parseFormula(output, target).tree) !== signature) {
      fail('此写法暂时无法无损转换，请改用明确的公式分组');
    }
    converted[target] = output;
  }
  return {
    ...converted,
    signature,
    display
  };
}
