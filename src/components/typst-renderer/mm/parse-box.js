import { SyntaxKind as K } from 'typlet';

const mmBoxConfig = Object.freeze({
  'mm-box-definition': {
    title: '定义',
    tone: 'blue',
    icon: 'definition'
  },
  'mm-box-theorem': {
    title: '定理 / 公式',
    tone: 'purple',
    icon: 'theorem'
  },
  'mm-box-example': {
    title: '例题',
    tone: 'cyan',
    icon: 'example'
  },
  'mm-box-warn': {
    title: '提醒 / 易错',
    tone: 'amber',
    icon: 'warning'
  },
  'mm-box-conclusion': {
    title: '结论 / 推论',
    tone: 'green',
    icon: 'conclusion'
  },
  'mm-box-frequency': {
    title: '真题考频',
    tone: 'orange',
    icon: 'frequency'
  },
  'mm-box-homework': {
    title: '作业',
    tone: 'teal',
    icon: 'homework'
  },
  'mm-box-custom': {
    title: '',
    tone: 'neutral',
    icon: ''
  }
});

export function parseMmBox(name, parts, positioned) {
  if (!Object.hasOwn(mmBoxConfig, name)) {
    return null;
  }
  const values = parts.filter(
    ({ node }) => ![K.LeftParen, K.RightParen, K.Comma].includes(node.kind)
  );
  const body = values.at(-1);
  if (!body || body.node.kind !== K.ContentBlock || values.length > 2) {
    return {
      error: '教学框需要一个正文内容块和可选标题'
    };
  }
  if (values.length === 1) {
    return {
      body,
      title: null,
      config: mmBoxConfig[name]
    };
  }
  const argument = values[0];
  if (argument.node.kind !== K.Named) {
    return {
      error: '教学框仅支持 title 标题参数'
    };
  }
  const named = positioned(argument.node.children, argument.start).filter(
    ({ node }) => ![K.Space, K.Colon, K.LineComment, K.BlockComment].includes(node.kind)
  );
  if (
    named.length !== 2 ||
    named[0].node.kind !== K.Ident ||
    named[0].node.fullText() !== 'title' ||
    named[1].node.kind !== K.ContentBlock
  ) {
    return {
      error: '教学框的 title 必须是内容块'
    };
  }
  return {
    body,
    title: named[1],
    config: mmBoxConfig[name]
  };
}
