import { parser } from 'codemirror-lang-typst/lezer';

export function findKnowledgeReferences(source) {
  const references = [];
  parser.parse(source).iterate({
    enter(node) {
      if (['Str', 'Raw', 'LineComment', 'BlockComment'].includes(node.name)) return false;
      if (node.name !== 'FuncCall') return;
      const call = node.node;
      if (call.parent?.name === 'FieldAccess') return;
      const ident = call.getChild('Ident');
      const args = call.getChild('Args');
      const hash = call.prevSibling;
      if (!ident || !args || !hash || hash.name !== 'Hash' || hash.to !== call.from) return;
      if (source.slice(ident.from, ident.to) !== 'mm-knowledge') return;
      const match = /^\(\s*([1-9]\d*)\s*\)$/.exec(source.slice(args.from, args.to));
      if (!match) return;
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id)) return;
      references.push({ id, from: hash.from, to: call.to });
    }
  });
  return references;
}
