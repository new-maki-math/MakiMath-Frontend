import { SyntaxKind as K } from 'typlet';

import { staticColor, staticString } from '../typst/static-values.js';
import { mmTagPresets } from './tag-config.js';

export function parseMmTag(name, parts, positioned) {
  if (name !== 'mm-tag') {
    return null;
  }
  const values = parts.filter(
    ({ node }) => ![K.LeftParen, K.RightParen, K.Comma].includes(node.kind)
  );
  const body = values.at(-1);
  if (!body || body.node.kind !== K.ContentBlock) {
    return {
      error: '标签需要一个正文内容块'
    };
  }
  let color = {
    preset: 'blue'
  };
  let warning = null;
  if (values.length > 2) {
    return {
      body,
      color,
      warning: {
        ...values[0],
        message: '标签仅支持一个 color 参数，已使用默认颜色'
      }
    };
  }
  if (values.length === 2) {
    const argument = values[0];
    const named =
      argument.node.kind === K.Named
        ? positioned(argument.node.children, argument.start).filter(
            ({ node }) => ![K.Space, K.Colon, K.LineComment, K.BlockComment].includes(node.kind)
          )
        : [];
    if (
      named.length === 2 &&
      named[0].node.kind === K.Ident &&
      named[0].node.fullText() === 'color'
    ) {
      const value = named[1].node;
      const preset = staticString(value);
      if (preset && Object.hasOwn(mmTagPresets, preset)) {
        color = {
          preset
        };
      } else if (
        value.kind === K.FuncCall &&
        ['rgb', 'color.rgb'].includes(
          value.children
            .find((child) => ![K.Space, K.LineComment, K.BlockComment].includes(child.kind))
            ?.fullText()
        ) &&
        staticColor(value)
      ) {
        color = {
          custom: staticColor(value)
        };
      } else {
        warning = {
          ...named[1],
          message: '标签颜色无效或暂不支持，已使用默认颜色'
        };
      }
    } else {
      warning = {
        ...argument,
        message: '标签仅支持 color 命名参数，已使用默认颜色'
      };
    }
  }
  return {
    body,
    color,
    warning
  };
}
