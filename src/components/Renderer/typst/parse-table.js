import { SyntaxKind as K } from 'typlet';
import { staticAlignment, staticColor, staticLength } from './static-values.js';

const trivia = new Set([K.Space, K.LineComment, K.BlockComment]);
const punctuation = new Set([K.LeftParen, K.RightParen, K.Comma]);

function valuesOf(entry, positioned) {
  return positioned(entry.node.children, entry.start).filter(({ node }) => !trivia.has(node.kind) && !punctuation.has(node.kind));
}

function namedValue(entry, positioned) {
  const items = positioned(entry.node.children, entry.start).filter(({ node }) => !trivia.has(node.kind) && node.kind !== K.Colon);
  if (items.length !== 2 || items[0].node.kind !== K.Ident) return null;
  return { name: items[0].node.fullText(), value: items[1] };
}

function callOf(entry, positioned) {
  if (entry.node.kind !== K.FuncCall) return null;
  const items = positioned(entry.node.children, entry.start).filter(({ node }) => !trivia.has(node.kind));
  if (items.length !== 2 || items[0].node.kind !== K.FieldAccess || items[1].node.kind !== K.Args) return null;
  return { name: items[0].node.fullText(), args: valuesOf(items[1], positioned) };
}

function positiveInt(entry) {
  if (entry?.node.kind !== K.Int || !/^\d+$/.test(entry.node.fullText())) return null;
  const value = Number(entry.node.fullText());
  return Number.isSafeInteger(value) && value > 0 && value <= 1000 ? value : null;
}

function nonnegativeInt(entry) {
  if (entry?.node.kind !== K.Int || !/^\d+$/.test(entry.node.fullText())) return null;
  const value = Number(entry.node.fullText());
  return Number.isSafeInteger(value) && value <= 20000 ? value : null;
}

function applyStyle(name, node, style, positioned) {
  if (node.kind === K.Auto && ['align', 'inset', 'fill'].includes(name)) return true;
  if (name === 'inset') {
    const value = staticLength(node);
    if (value !== null) { style.padding = value; return true; }
    if (node.kind !== K.Dict) return false;
    const items = positioned(node.children, 0).filter(({ node: child }) => !trivia.has(child.kind) && !punctuation.has(child.kind) && child.kind !== K.Colon);
    const inset = {};
    for (const item of items) {
      if (item.node.kind !== K.Named) return false;
      const named = namedValue(item, positioned);
      if (!named || !['rest', 'x', 'y', 'left', 'right', 'top', 'bottom'].includes(named.name) || Object.hasOwn(inset, named.name)) return false;
      inset[named.name] = staticLength(named.value.node);
      if (inset[named.name] === null) return false;
    }
    for (const [side, axis] of [['Left', 'x'], ['Right', 'x'], ['Top', 'y'], ['Bottom', 'y']]) {
      const resolved = inset[side.toLowerCase()] ?? inset[axis] ?? inset.rest;
      if (resolved !== undefined) style[`padding${side}`] = resolved;
    }
    return true;
  }
  if (name === 'align') {
    const value = staticAlignment(node);
    if (value === null) return false;
    style.textAlign = value;
    return true;
  }
  if (name === 'fill') {
    const color = staticColor(node);
    if (node.kind === K.None) style.backgroundColor = 'transparent';
    else if (color) style.backgroundColor = color;
    else return false;
    return true;
  }
  if (name === 'stroke') {
    const length = staticLength(node);
    const color = staticColor(node);
    if (node.kind === K.None) style.border = 'none';
    else if (length !== null && !length.endsWith('%')) style.border = `${length} solid currentColor`;
    else if (color) style.border = `0.5pt solid ${color}`;
    else if (node.kind === K.Dict) {
      const items = positioned(node.children, 0).filter(({ node: child }) => !trivia.has(child.kind) && !punctuation.has(child.kind) && child.kind !== K.Colon);
      const fields = {};
      for (const item of items) {
        if (item.node.kind !== K.Named) return false;
        const named = namedValue(item, positioned);
        if (!named || !['paint', 'thickness'].includes(named.name) || Object.hasOwn(fields, named.name)) return false;
        fields[named.name] = named.value.node;
      }
      const paint = staticColor(fields.paint);
      const thickness = staticLength(fields.thickness);
      if (!paint || thickness === null || thickness.endsWith('%')) return false;
      style.border = `${thickness} solid ${paint}`;
    } else return false;
    return true;
  }
  return false;
}

function readCell(entry, header, positioned) {
  if (entry.node.kind === K.ContentBlock) return { body: entry, header, colspan: 1, rowspan: 1 };
  const call = callOf(entry, positioned);
  if (!call || call.name !== 'table.cell') return null;
  let body = null;
  const spans = {};
  const position = {};
  const style = {};
  const names = new Set();
  for (const item of call.args) {
    if (item.node.kind === K.ContentBlock && !body) body = item;
    else if (item.node.kind === K.Named) {
      const named = namedValue(item, positioned);
      if (!named || names.has(named.name)) return null;
      names.add(named.name);
      if (['colspan', 'rowspan'].includes(named.name)) {
        spans[named.name] = positiveInt(named.value);
        if (!spans[named.name]) return null;
      } else if (['x', 'y'].includes(named.name)) {
        if (named.value.node.kind !== K.Auto) {
          position[named.name] = nonnegativeInt(named.value);
          if (position[named.name] === null) return null;
        }
      } else if (!applyStyle(named.name, named.value.node, style, positioned)) return null;
    } else return null;
  }
  return body ? { body, header, colspan: spans.colspan || 1, rowspan: spans.rowspan || 1, ...position, style } : null;
}

export function parseTable(parts, positioned, convertChildren) {
  const values = parts.filter(({ node }) => !punctuation.has(node.kind));
  let columns = 1;
  let hasColumns = false;
  let widths = null;
  let fractional = false;
  let mixedColumns = false;
  let hasHeader = false;
  const tableStyle = {};
  const columnStyles = {};
  const names = new Set();
  const cells = [];
  const lines = [];
  const verticalLines = [];
  for (const value of values) {
    if (value.node.kind === K.Named) {
      const named = namedValue(value, positioned);
      if (!named || names.has(named.name) || cells.length) return { error: '暂不支持此表格参数' };
      names.add(named.name);
      if (named.name === 'columns') {
        if (hasColumns) return { error: '重复指定表格列数' };
        if (named.value.node.kind === K.Array) {
          const tracks = valuesOf(named.value, positioned);
          const fractions = tracks.map(({ node }) => {
            const text = node.fullText();
            return node.kind === K.Numeric && /^(?:\d+(?:\.\d+)?|\.\d+)fr$/.test(text) ? Number.parseFloat(text) : null;
          });
          if (fractions.some((value) => value !== null)) {
            const total = fractions.reduce((sum, value) => sum + (value ?? 0), 0);
            if (!Number.isFinite(total) || total <= 0) return { error: '表格比例列宽总和必须大于零' };
            widths = tracks.map(({ node }, index) => fractions[index] === null
              ? (node.kind === K.Auto ? 'auto' : staticLength(node))
              : `${fractions[index] / total * 100}%`);
            fractional = true;
            mixedColumns = fractions.some((value) => value === null);
          } else widths = tracks.map(({ node }) => node.kind === K.Auto ? 'auto' : staticLength(node));
          if (!widths.length || widths.length > 1000 || widths.some((width) => width === null)) return { error: '暂不支持此表格列宽' };
          columns = widths.length;
        } else {
          columns = positiveInt(named.value);
          if (!columns) return { error: '表格列数必须是 1 至 1000 的静态整数或支持的列宽数组' };
        }
        hasColumns = true;
      } else if (named.value.node.kind === K.Array && ['inset', 'align', 'fill', 'stroke'].includes(named.name)) {
        const items = valuesOf(named.value, positioned);
        if (!items.length) return { error: '表格样式数组不能为空' };
        const resolved = items.map(({ node }) => {
          const style = {};
          return applyStyle(named.name, node, style, positioned) ? style : null;
        });
        if (resolved.some((style) => style === null)) return { error: '暂不支持此表格样式数组' };
        columnStyles[named.name] = resolved;
      } else if (!applyStyle(named.name, named.value.node, tableStyle, positioned)) return { error: '暂不支持此表格参数' };
      continue;
    }
    const call = callOf(value, positioned);
    if (call?.name === 'table.hline') {
      const line = { y: null, start: 0, end: null, stroke: '1px solid var(--border-hover)' };
      const seen = new Set();
      for (const item of call.args) {
        if (item.node.kind !== K.Named) return { error: '暂不支持此横线参数' };
        const named = namedValue(item, positioned);
        if (!named || seen.has(named.name)) return { error: '横线参数无效或重复' };
        seen.add(named.name);
        if (['y', 'start', 'end'].includes(named.name)) {
          if (named.name === 'end' && named.value.node.kind === K.None) continue;
          line[named.name] = nonnegativeInt(named.value);
          if (line[named.name] === null) return { error: '横线位置必须是静态非负整数' };
        } else if (named.name === 'stroke') {
          const style = {};
          if (named.value.node.kind === K.None || !applyStyle('stroke', named.value.node, style, positioned)) return { error: '暂不支持此横线描边' };
          line.stroke = style.border;
        } else return { error: '暂不支持此横线参数' };
      }
      if (line.y === null) return { error: '暂不支持自动横线位置' };
      lines.push(line);
      continue;
    }
    if (call?.name === 'table.vline') {
      const line = { x: null, start: 0, end: null, stroke: '1px solid var(--border-hover)' };
      const seen = new Set();
      for (const item of call.args) {
        if (item.node.kind !== K.Named) return { error: '暂不支持此竖线参数' };
        const named = namedValue(item, positioned);
        if (!named || seen.has(named.name)) return { error: '竖线参数无效或重复' };
        seen.add(named.name);
        if (['x', 'start', 'end'].includes(named.name)) {
          if (named.name === 'end' && named.value.node.kind === K.None) continue;
          line[named.name] = nonnegativeInt(named.value);
          if (line[named.name] === null) return { error: '竖线位置必须是静态非负整数' };
        } else if (named.name === 'stroke') {
          const style = {};
          if (named.value.node.kind === K.None || !applyStyle('stroke', named.value.node, style, positioned)) return { error: '暂不支持此竖线描边' };
          line.stroke = style.border;
        } else return { error: '暂不支持此竖线参数' };
      }
      if (line.x === null) return { error: '暂不支持自动竖线位置' };
      verticalLines.push(line);
      continue;
    }
    if (call?.name === 'table.header') {
      if (hasHeader || cells.length) return { error: '暂不支持此表头位置' };
      hasHeader = true;
      for (const item of call.args) {
        const cell = readCell(item, true, positioned);
        if (!cell) return { error: '暂不支持此表头内容或参数' };
        cells.push(cell);
      }
      continue;
    }
    const cell = readCell(value, false, positioned);
    if (!cell) return { error: '暂不支持此表格单元格或参数' };
    cells.push(cell);
  }

  const rows = [];
  const occupied = [];
  let cursor = 0;
  for (const cell of cells) {
    if (cell.colspan > columns || (cell.x !== undefined && cell.x + cell.colspan > columns)) return { error: '单元格位置或跨列数超过表格列数' };
    let row = cell.y ?? (cell.x === undefined ? Math.floor(cursor / columns) : 0);
    let col = cell.x ?? (cell.y === undefined ? cursor % columns : 0);
    while (true) {
      if ((row + cell.rowspan) * columns > 20000) return { error: '表格规模超过当前渲染限制' };
      let free = col + cell.colspan <= columns;
      for (let y = row; y < row + cell.rowspan && free; y++) {
        for (let x = col; x < col + cell.colspan; x++) if (occupied[y]?.[x]) { free = false; break; }
      }
      if (free) break;
      if (cell.x !== undefined && cell.y !== undefined) return { error: '指定的单元格位置已被占用' };
      if (cell.x !== undefined) row++;
      else if (cell.y !== undefined) {
        col++;
        if (col + cell.colspan > columns) return { error: '指定行没有足够的空位' };
      } else {
        col++;
        if (col + cell.colspan > columns) { row++; col = 0; }
      }
    }
    for (let y = row; y < row + cell.rowspan; y++) {
      occupied[y] ||= [];
      for (let x = col; x < col + cell.colspan; x++) occupied[y][x] = true;
    }
    rows[row] ||= [];
    rows[row].push({ ...cell, col });
    if (cell.x === undefined && cell.y === undefined) cursor = row * columns + col + cell.colspan;
  }
  for (let row = 0; row < occupied.length; row++) {
    rows[row] ||= [];
    for (let col = 0; col < columns; col++) if (!occupied[row]?.[col]) rows[row].push({ col, empty: true });
    rows[row].sort((a, b) => a.col - b.col);
  }
  for (const line of lines) {
    const { y, start, stroke } = line;
    const end = line.end ?? columns;
    if (y > rows.length || !rows.length || start > end || end > columns) return { error: '横线位置超出表格范围' };
    if (y > 0 && rows.slice(0, y).some((row, index) => row.some((cell) => !cell.empty && index + cell.rowspan > y && cell.col < end && cell.col + cell.colspan > start))) {
      return { error: '暂不支持横线穿过跨行单元格' };
    }
    const row = y === rows.length ? rows[y - 1] : rows[y];
    const side = y === rows.length ? 'borderBottom' : 'borderTop';
    for (const cell of row) {
      const right = cell.col + (cell.colspan || 1);
      if (cell.col < end && right > start) {
        if (cell.col < start || right > end) return { error: '暂不支持横线穿过跨列单元格' };
        if (y === rows.length) {
          cell.bottomLine = stroke;
          cell.lineStyle = { ...cell.lineStyle, borderBottom: 'none' };
        } else {
          cell.lineStyle = { ...cell.lineStyle, [side]: stroke };
        }
      }
    }
  }
  for (const line of verticalLines) {
    const { x, start, stroke } = line;
    const end = line.end ?? rows.length;
    if (x > columns || start > end || end > rows.length || !rows.length) return { error: '竖线位置超出表格范围' };
    for (let y = 0; y < rows.length; y++) {
      for (const cell of rows[y]) {
        const height = cell.rowspan || 1;
        const right = cell.col + (cell.colspan || 1);
        if (y < end && y + height > start && cell.col < x && right > x) return { error: '暂不支持竖线穿过跨列单元格' };
        const side = x === columns ? (right === x ? 'borderRight' : null) : (cell.col === x ? 'borderLeft' : null);
        if (side && y < end && y + height > start) {
          if (y < start || y + height > end) return { error: '暂不支持竖线穿过跨行单元格' };
          cell.lineStyle = { ...cell.lineStyle, [side]: stroke };
        }
      }
    }
  }
  const hasBottomLine = rows.some((row) => row.some((cell) => cell.bottomLine));
  return { widths, fractional, mixedColumns, hasBottomLine, rows: rows.map((row) => row.map((cell) => {
    const columnStyle = Object.values(columnStyles).reduce((style, values) => Object.assign(style, values[cell.col % values.length]), {});
    const style = { ...tableStyle, ...columnStyle, ...cell.style, ...cell.lineStyle };
    if (cell.bottomLine) style['--typst-bottom-line'] = cell.bottomLine;
    return cell.empty ? { ...cell, style } : {
      start: cell.body.start, end: cell.body.end, header: cell.header, colspan: cell.colspan, rowspan: cell.rowspan, bottomLine: Boolean(cell.bottomLine), style,
      children: convertChildren(cell.body.node, cell.body.start)
    };
  })) };
}
