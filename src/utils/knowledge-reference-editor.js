import { parse, SyntaxKind as K } from 'typlet';

function isMarkupHash(source, offset) {
  try {
    const root = parse(source, { mode: 'markup' });
    function visit(node, start) {
      if (offset < start || offset >= start + node.len) return false;
      if ([K.LineComment, K.BlockComment, K.Str, K.Raw].includes(node.kind)) return false;
      if (node.kind === K.Hash) return start === offset;
      let position = start;
      for (const child of node.children || []) {
        if (visit(child, position)) return true;
        position += child.len;
      }
      return false;
    }
    return visit(root, 0);
  } catch { return false; }
}
export function findKnowledgeInsertion(model, selection, automatic = false) {
  if (!model || !selection) return null;
  const start = model.getOffsetAt(selection.getStartPosition());
  const end = model.getOffsetAt(selection.getEndPosition());
  if (start !== end) return automatic ? null : { start, end };
  const source = model.getValue();
  const before = source.slice(0, start);
  const match = before.match(/#mm-knowledge(?:\([ \t]*(?:slug[ \t]*:[ \t]*""[ \t]*)?\)?)?$/);
  if (match) {
    const begin = start - match[0].length;
    if (!isMarkupHash(source, begin)) return null;
    if (match[0].endsWith(')')) return { start: begin, end: start };
    const after = source.slice(start);
    if (!match[0].includes('(') && /^[ \t]*\([ \t]*[^ \t)]/.test(after)) return null;
    if (!match[0].includes('(') && /^[\w-]/.test(after)) return null;
    const rest = match[0].includes('(') ? after.match(/^[ \t]*\)/) : after.match(/^[ \t]*\([ \t]*\)/);
    if (match[0].includes('(') && !rest && /^[ \t]*[^ \t)]/.test(after)) return null;
    return { start: begin, end: start + (rest?.[0].length || 0) };
  }
  if (automatic) return null;
  const line = model.getLineContent(selection.positionLineNumber);
  const column = selection.positionColumn - 1;
  for (const reference of line.matchAll(/#mm-knowledge[ \t]*\([^)]*\)/g)) {
    if (column >= reference.index && column <= reference.index + reference[0].length) return null;
  }
  return { start, end };
}
