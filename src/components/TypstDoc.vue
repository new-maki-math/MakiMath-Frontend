<script setup>
import { computed } from 'vue';

// 组件自引用递归渲染依赖组件名，显式声明 name 以保证递归稳健
defineOptions({ name: 'TypstDoc' });

const props = defineProps({
  // 根文档：既支持 { type: 'doc', children: [...] }，也支持裸的 children 数组
  doc: {
    type: [Object, Array],
    default: null
  },
  // 递归内部使用的节点数组（父组件也可借此只渲染一棵子树）
  nodes: {
    type: Array,
    default: null
  },
  // 解析告警：可由父组件传入，缺省时回落到 doc.warnings
  warnings: {
    type: Array,
    default: () => []
  },
  // flow = true 时不包裹外层容器，直接输出节点流（递归专用）
  flow: {
    type: Boolean,
    default: false
  }
});

// 共享空数组，避免每次渲染都产生新引用
const EMPTY = Object.freeze([]);

// 表格单元格对齐取值白名单
const CELL_ALIGNS = ['left', 'center', 'right'];

/* 卡片 / 标签的类型刻意不写死在组件里：不同讲义会不断引入新的框、面板与标签色。
   组件只把原始字段规范化成一个安全 token 透出去（class 与 data-kind 都用它），
   文案、配色全部由 styles/MakiTheme.css 决定。主题没覆盖到的新类型会自动
   回退显示原始字段（见 .td-box-label 的 attr() 规则），而不是被悄悄换成别的。 */
function kindToken(kind) {
  if (typeof kind !== 'string') return 'unknown';
  const token = kind.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return token || 'unknown';
}

/* ------------------------------------------------------------------
   基础取值助手
   ------------------------------------------------------------------ */

function isType(node, type) {
  return !!node && node.type === type;
}

function childrenOf(node) {
  return node && Array.isArray(node.children) ? node.children : EMPTY;
}

// 标题层级收敛到 h1–h6，非法值退化为 h3
function headingLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return 3;
  return Math.min(6, Math.max(1, Math.trunc(n)));
}

function headingTag(level) {
  return `h${headingLevel(level)}`;
}

// anchor 由 API 层下发；缺失时不渲染 id 属性（避免出现 id=""）
function anchorOf(node) {
  if (!node) return null;
  const anchor = node.anchor;
  if (typeof anchor !== 'string') return null;
  const trimmed = anchor.trim();
  return trimmed ? trimmed : null;
}

// 讲次编号：num 形如 "01"，补上 L 前缀；已带 L 前缀则原样使用
function lecBadge(num) {
  if (num === null || num === undefined) return '';
  const text = String(num).trim();
  if (!text) return '';
  return /^[Ll]/.test(text) ? text : `L${text}`;
}

// 标签原生色彩样式绑定 (Hex / rgb 优先直接挂载 CSS 变量)
function tagStyle(color) {
  if (!color) return null;
  const c = String(color).trim();
  if (c.startsWith('#') || c.startsWith('rgb') || c.startsWith('hsl')) {
    return { '--tag-color': c };
  }
  return null;
}

function listItems(node) {
  return node && Array.isArray(node.items) ? node.items : EMPTY;
}

function tableRows(node) {
  if (!node || !Array.isArray(node.rows)) return EMPTY;
  return node.rows.map(row => (Array.isArray(row) ? row : EMPTY));
}

function cellSpan(cell, key) {
  const value = Number(cell && cell[key]);
  return Number.isFinite(value) && value > 1 ? Math.trunc(value) : null;
}

// 单元格对齐走 class，避免无对齐时渲染出空的 style 属性
function cellAlignClass(cell) {
  const align = cell && CELL_ALIGNS.includes(cell.align) ? cell.align : null;
  return align ? `td-align-${align}` : '';
}

// 列数较多时给出最小宽度，交给外层容器横向滚动，避免单元格被压扁
function tableStyle(node) {
  const columns = Number(node && node.columns);
  if (!Number.isFinite(columns) || columns < 4) return null;
  return { minWidth: `${Math.min(columns, 8) * 96}px` };
}

// zt.statement 正常为 null（由业务层补齐），存在字符串时才展示
function statementText(node) {
  if (!node) return '';
  const statement = node.statement;
  return typeof statement === 'string' && statement.trim() ? statement.trim() : '';
}

/* ------------------------------------------------------------------
   根节点与告警
   ------------------------------------------------------------------ */

const rootNodes = computed(() => {
  if (Array.isArray(props.nodes)) return props.nodes;

  const doc = props.doc;
  if (Array.isArray(doc)) return doc;
  if (doc && typeof doc === 'object') {
    if (Array.isArray(doc.children)) return doc.children;
    // 容忍直接传入单个节点的情况
    if (doc.type && doc.type !== 'doc') return [doc];
  }
  return EMPTY;
});

const warningList = computed(() => {
  if (Array.isArray(props.warnings) && props.warnings.length) return props.warnings;
  const doc = props.doc;
  if (doc && !Array.isArray(doc) && Array.isArray(doc.warnings) && doc.warnings.length) {
    return doc.warnings;
  }
  return EMPTY;
});

function warningText(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item.message === 'string') return item.message;
  try {
    return JSON.stringify(item);
  } catch (err) {
    return String(item);
  }
}
</script>

<template>
  <!-- 根容器：承载正文排版与解析告警 -->
  <div v-if="!flow" class="typst-doc">
    <TypstDoc :nodes="rootNodes" flow />

    <div v-if="warningList.length" class="td-warnings">
      <div class="td-warnings-title">文档解析告警（{{ warningList.length }}）</div>
      <ul class="td-warnings-list">
        <li v-for="(item, index) in warningList" :key="index">{{ warningText(item) }}</li>
      </ul>
    </div>
  </div>

  <!-- 递归分支：直接输出节点流，不额外包裹元素 -->
  <template v-else>
    <template v-for="(node, index) in rootNodes" :key="index">
      <!-- 纯文本 -->
      <span v-if="isType(node, 'text')" class="td-text">{{ node.value }}</span>

      <!-- 加粗 -->
      <strong v-else-if="isType(node, 'strong')" class="td-strong">
        <TypstDoc :nodes="childrenOf(node)" flow />
      </strong>

      <!-- 强调 -->
      <em v-else-if="isType(node, 'emph')" class="td-emph">
        <TypstDoc :nodes="childrenOf(node)" flow />
      </em>

      <!-- 彩色标签 -->
      <span
        v-else-if="isType(node, 'tag')"
        class="td-tag"
        :class="tagStyle(node.color) ? null : `td-tag-${kindToken(node.color)}`"
        :style="tagStyle(node.color)"
        :data-tag="node.text"
      >{{ node.text }}</span>

      <!-- 数学公式：直接透传 Typst 原文 -->
      <component
        v-else-if="isType(node, 'math')"
        :is="node.display ? 'div' : 'span'"
        class="td-math-typst"
        :class="{ 'is-display': !!node.display }"
      >{{ node.typst }}</component>

      <!-- 标题（anchor 存在时作为 DOM id，供右侧大纲定位） -->
      <component
        v-else-if="isType(node, 'heading')"
        :is="headingTag(node.level)"
        :id="anchorOf(node)"
        class="td-heading"
        :class="`td-heading-${headingLevel(node.level)}`"
      >
        <TypstDoc v-if="childrenOf(node).length" :nodes="childrenOf(node)" flow />
        <template v-else>{{ node.text }}</template>
        <span v-if="Array.isArray(node.tags) && node.tags.length" class="td-heading-tags">
          <span
            v-for="(tag, tagIndex) in node.tags"
            :key="tagIndex"
            class="td-tag"
            :class="tagStyle(tag && tag.color) ? null : `td-tag-${kindToken(tag && tag.color)}`"
            :style="tagStyle(tag && tag.color)"
            :data-tag="tag && tag.text"
          >{{ tag && tag.text }}</span>
        </span>
      </component>

      <!-- 段落 -->
      <p v-else-if="isType(node, 'para')" class="td-para">
        <TypstDoc :nodes="childrenOf(node)" flow />
      </p>

      <!-- 列表 -->
      <component
        v-else-if="isType(node, 'list')"
        :is="node.ordered ? 'ol' : 'ul'"
        class="td-list"
      >
        <li v-for="(item, itemIndex) in listItems(node)" :key="itemIndex" class="td-list-item">
          <TypstDoc :nodes="childrenOf(item)" flow />
        </li>
      </component>

      <!-- 游离的列表项：兜底渲染其子节点 -->
      <div v-else-if="isType(node, 'item')" class="td-item">
        <TypstDoc :nodes="childrenOf(node)" flow />
      </div>

      <!-- 提示框：title / titleChildren 二选一，都没有时只显示 kind 标签 -->
      <div
        v-else-if="isType(node, 'box')"
        class="td-box"
        :class="`td-box-${kindToken(node.kind)}`"
      >
        <div class="td-box-head">
          <span class="td-box-label" :data-kind="kindToken(node.kind)"></span>
          <span
            v-if="Array.isArray(node.titleChildren) && node.titleChildren.length"
            class="td-box-title"
          >
            <TypstDoc :nodes="node.titleChildren" flow />
          </span>
          <span v-else-if="node.title" class="td-box-title">{{ node.title }}</span>
        </div>
        <div class="td-box-body">
          <TypstDoc :nodes="childrenOf(node)" flow />
        </div>
      </div>

      <!-- 侧栏面板：考频 / 作业 -->
      <aside
        v-else-if="isType(node, 'panel')"
        class="td-panel"
        :class="`td-panel-${kindToken(node.kind)}`"
      >
        <div class="td-panel-head">
          <span
            class="td-panel-label"
            :data-kind="kindToken(node.kind)"
          ></span>
        </div>
        <div class="td-panel-body">
          <TypstDoc :nodes="childrenOf(node)" flow />
        </div>
      </aside>

      <!-- 讲次区块：编号 + 标题 + 标签 + 正文 -->
      <section
        v-else-if="isType(node, 'lec')"
        :id="anchorOf(node)"
        class="td-lec"
      >
        <header class="td-lec-head">
          <span v-if="lecBadge(node.num)" class="td-lec-num">{{ lecBadge(node.num) }}</span>
          <span v-if="Array.isArray(node.tags) && node.tags.length" class="td-lec-tags">
            <span
              v-for="(tag, tagIndex) in node.tags"
              :key="tagIndex"
              class="td-tag"
              :class="tagStyle(tag && tag.color) ? null : `td-tag-${kindToken(tag && tag.color)}`"
              :style="tagStyle(tag && tag.color)"
              :data-tag="tag && tag.text"
            >{{ tag && tag.text }}</span>
          </span>
          <span class="td-lec-title">{{ node.title }}</span>
        </header>
        <div class="td-lec-body">
          <TypstDoc :nodes="childrenOf(node)" flow />
        </div>
      </section>

      <!-- 真题引证卡：只展示 source + title（statement 由业务层补齐） -->
      <div v-else-if="isType(node, 'zt')" class="td-zt">
        <span class="td-zt-badge">真题</span>
        <div class="td-zt-main">
          <div class="td-zt-title">{{ node.title || node.source || '未命名真题' }}</div>
          <div v-if="node.source && node.title" class="td-zt-source">{{ node.source }}</div>
          <div v-if="statementText(node)" class="td-zt-statement">{{ statementText(node) }}</div>
        </div>
        <span v-if="node.id" class="td-zt-id">{{ node.id }}</span>
      </div>

      <!-- 表格 -->
      <div v-else-if="isType(node, 'table')" class="td-table-wrap">
        <table class="td-table" :style="tableStyle(node)">
          <tbody>
            <tr v-for="(row, rowIndex) in tableRows(node)" :key="rowIndex">
              <td
                v-for="(cell, cellIndex) in row"
                :key="cellIndex"
                class="td-cell"
                :class="cellAlignClass(cell)"
                :colspan="cellSpan(cell, 'colspan')"
                :rowspan="cellSpan(cell, 'rowspan')"
              >
                <TypstDoc :nodes="childrenOf(cell)" flow />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 嵌套 doc 节点 -->
      <TypstDoc v-else-if="isType(node, 'doc')" :nodes="childrenOf(node)" flow />

      <!-- 未知类型兜底：有 children 就继续渲染，否则什么都不输出 -->
      <TypstDoc v-else-if="childrenOf(node).length" :nodes="childrenOf(node)" flow />
    </template>
  </template>
</template>
