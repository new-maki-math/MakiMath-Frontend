import { SyntaxKind as K } from 'typlet';

import { staticLength, staticString } from '../typst/static-values.js';

const macroNames = new Set(['mm-question', 'mm-question-options', 'mm-question-blank']);
const punctuation = new Set([K.LeftParen, K.RightParen, K.Comma]);
const trivia = new Set([K.Space, K.LineComment, K.BlockComment]);

export function parseMmQuestion(name, parts, positioned) {
  if (!macroNames.has(name)) {
    return null;
  }
  const values = parts.filter(({ node }) => !punctuation.has(node.kind));
  const bodies = [];
  const params = {};
  for (const item of values) {
    if (item.node.kind === K.ContentBlock) {
      bodies.push(item);
      continue;
    }
    if (item.node.kind !== K.Named) {
      return {
        error: '题目宏仅支持命名参数和内容块'
      };
    }
    const pair = positioned(item.node.children, item.start).filter(
      ({ node }) => !trivia.has(node.kind) && node.kind !== K.Colon
    );
    if (pair.length !== 2 || pair[0].node.kind !== K.Ident) {
      return {
        error: '题目宏参数格式不正确'
      };
    }
    const key = pair[0].node.fullText();
    if (Object.hasOwn(params, key)) {
      return {
        error: `题目宏参数重复：${key}`
      };
    }
    params[key] = pair[1];
  }
  if (name === 'mm-question' && params.slug) {
    const allowed = [
      'slug',
      'number',
      'difficulty',
      'knowledge',
      'focus',
      'solution',
      'conclusion',
      'pitfalls',
      'tags'
    ];
    if (bodies.length || Object.keys(params).some((key) => !allowed.includes(key))) {
      return {
        error: '题目引用不支持正文或其他参数'
      };
    }
    const slug = staticString(params.slug.node);
    const number = params.number ? staticString(params.number.node) : '';
    if (!slug || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || number === null) {
      return {
        error: '题目引用需要有效的 slug 与题号字符串'
      };
    }
    const overrides = {};
    for (const key of [
      'difficulty',
      'knowledge',
      'focus',
      'solution',
      'conclusion',
      'pitfalls',
      'tags'
    ]) {
      if (!params[key]) {
        continue;
      }
      const item = params[key];
      const value = item.node.fullText();
      if (value === 'false' && key !== 'tags') {
        overrides[key] = false;
      } else if (key === 'difficulty' && item.node.kind === K.Int && /^[1-5]$/.test(value)) {
        overrides[key] = Number(value);
      } else if (
        ['focus', 'solution', 'conclusion', 'pitfalls'].includes(key) &&
        item.node.kind === K.ContentBlock
      ) {
        overrides[key] = item;
      } else if (['knowledge', 'tags'].includes(key) && item.node.kind === K.Array) {
        const entries = positioned(item.node.children, item.start).filter(
          ({ node }) =>
            ![
              K.Space,
              K.LeftParen,
              K.RightParen,
              K.Comma,
              K.LineComment,
              K.BlockComment,
              K.Hash
            ].includes(node.kind)
        );
        if (key === 'knowledge') {
          const slugs = entries.map(({ node }) => staticString(node));
          if (
            slugs.some(
              (value) => !value || value.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
            )
          ) {
            return {
              error: '知识点覆盖需要 slug 字符串元组'
            };
          }
          overrides.knowledge = slugs;
        } else {
          if (
            entries.some(
              ({ node }) =>
                node.kind !== K.ContentBlock &&
                !(node.kind === K.FuncCall && node.fullText().startsWith('mm-tag'))
            )
          ) {
            return {
              error: '题目标签需要内容块或 mm-tag'
            };
          }
          overrides.tags = entries.map(({ node }) =>
            node.kind === K.ContentBlock ? node.fullText().slice(1, -1) : `#${node.fullText()}`
          );
        }
      } else {
        return {
          error: `题目引用参数 ${key} 格式不正确`
        };
      }
    }
    return {
      kind: 'reference',
      slug,
      number,
      overrides
    };
  }
  if (name === 'mm-question') {
    if (
      bodies.length > 1 ||
      Object.keys(params).some((key) => !['source', 'title', 'difficulty', 'id'].includes(key))
    ) {
      return {
        error: '题目参数或正文数量不正确'
      };
    }
    const source = params.source ? staticString(params.source.node) : '';
    const id = params.id ? staticString(params.id.node) : '';
    if (source === null || id === null) {
      return {
        error: '题目来源和标识必须是字符串'
      };
    }
    if (params.title && params.title.node.kind !== K.ContentBlock) {
      return {
        error: '题目补充标题必须是内容块'
      };
    }
    let difficulty = null;
    if (params.difficulty) {
      const value = params.difficulty.node.fullText();
      if (params.difficulty.node.kind !== K.Int || !/^[1-5]$/.test(value)) {
        return {
          error: '题目难度必须是 1 至 5 的整数'
        };
      }
      difficulty = Number(value);
    }
    return {
      kind: 'question',
      body: bodies[0] || null,
      title: params.title || null,
      source,
      id,
      difficulty
    };
  }
  if (name === 'mm-question-options') {
    if (!bodies.length || Object.keys(params).some((key) => key !== 'columns')) {
      return {
        error: '选项需要内容块，仅支持 columns 参数'
      };
    }
    let columns = null;
    if (params.columns) {
      const value = params.columns.node.fullText();
      if (params.columns.node.kind !== K.Int || !['1', '2', '4'].includes(value)) {
        return {
          error: '选项列数仅支持 1、2 或 4'
        };
      }
      columns = Number(value);
    }
    return {
      kind: 'options',
      bodies,
      columns
    };
  }
  if (bodies.length || Object.keys(params).some((key) => key !== 'width')) {
    return {
      error: '填空仅支持 width 参数'
    };
  }
  const width = params.width ? staticLength(params.width.node) : '4em';
  if (width === null) {
    return {
      error: '填空宽度必须是静态非负长度'
    };
  }
  return {
    kind: 'blank',
    width
  };
}
