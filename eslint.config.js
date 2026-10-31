import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importSort from 'eslint-plugin-simple-import-sort';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

const commentStyle = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      invalid: '使用简单的一行中文注释，JavaScript 注释使用 //。'
    }
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (/^\s*(eslint|global|prettier|@vite)/.test(comment.value)) {
            continue;
          }
          if (
            comment.type !== 'Line' ||
            comment.loc.start.line !== comment.loc.end.line ||
            !/[\u3400-\u9fff]/.test(comment.value) ||
            /^\s*(?:[=-]{3,}|\d+\.)/.test(comment.value)
          ) {
            context.report({
              loc: comment.loc,
              messageId: 'invalid'
            });
          }
        }
      }
    };
  }
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'docs/**', 'doc/**', 'src/vendor/**']
  },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser
    },
    plugins: {
      'simple-import-sort': importSort,
      maki: {
        rules: {
          'comment-style': commentStyle
        }
      }
    },
    rules: {
      'maki/comment-style': 'error',
      'no-unused-vars': [
        'error',
        {
          args: 'after-used',
          caughtErrors: 'none'
        }
      ],
      'no-duplicate-imports': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'vue/multi-word-component-names': 'error',
      'vue/no-undef-components': 'error',
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/component-name-in-template-casing': [
        'error',
        'PascalCase',
        {
          registeredComponentsOnly: true
        }
      ],
      'vue/block-order': [
        'error',
        {
          order: ['script', 'template', 'style']
        }
      ]
    }
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['src/views/knowledge/knowledge-canvas2d-worker.js'],
    languageOptions: {
      globals: globals.worker
    }
  },
  prettier,
  {
    rules: {
      curly: ['error', 'all'],
      'brace-style': [
        'error',
        '1tbs',
        {
          allowSingleLine: false
        }
      ],
      'object-curly-newline': [
        'error',
        {
          ObjectExpression: {
            minProperties: 1,
            consistent: true
          }
        }
      ],
      'object-property-newline': [
        'error',
        {
          allowAllPropertiesOnSameLine: false
        }
      ],
      'vue/object-curly-newline': [
        'error',
        {
          ObjectExpression: {
            minProperties: 1,
            consistent: true
          }
        }
      ],
      'vue/object-property-newline': [
        'error',
        {
          allowAllPropertiesOnSameLine: false
        }
      ],
      'vue/max-attributes-per-line': [
        'error',
        {
          singleline: 1,
          multiline: 1
        }
      ]
    }
  }
];
