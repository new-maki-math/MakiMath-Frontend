import { SyntaxKind as K } from 'typlet';
import { mmBoxConfig } from './box-config.js';

export function parseMmBox(name, parts, positioned) {
  if (!Object.hasOwn(mmBoxConfig, name)) return null;
  const values = parts.filter(({ node }) => ![K.LeftParen, K.RightParen, K.Comma].includes(node.kind));
  const body = values.at(-1);
  if (!body || body.node.kind !== K.ContentBlock || values.length > 2) return { error: '教学框需要一个正文内容块和可选标题' };
  if (values.length === 1) return { body, title: null, config: mmBoxConfig[name] };
  const argument = values[0];
  if (argument.node.kind !== K.Named) return { error: '教学框仅支持 title 标题参数' };
  const named = positioned(argument.node.children, argument.start).filter(({ node }) => ![K.Space, K.Colon, K.LineComment, K.BlockComment].includes(node.kind));
  if (named.length !== 2 || named[0].node.kind !== K.Ident || named[0].node.fullText() !== 'title' || named[1].node.kind !== K.ContentBlock) {
    return { error: '教学框的 title 必须是内容块' };
  }
  return { body, title: named[1], config: mmBoxConfig[name] };
}
