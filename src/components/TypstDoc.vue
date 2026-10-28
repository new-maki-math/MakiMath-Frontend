<script setup>
import { computed } from 'vue';
import { renderToString } from 'typlet';

// 递归渲染依赖组件名
defineOptions({ name: 'TypstDoc' });

const props = defineProps({
  // 根文档数据
  doc: {
    type: [Object, Array],
    default: null
  },
  // 子节点列表
  nodes: {
    type: Array,
    default: null
  },
  // 解析告警列表
  warnings: {
    type: Array,
    default: () => []
  },
  // 递归模式不包裹外层容器
  flow: {
    type: Boolean,
    default: false
  }
});

// 共享空数组引用
const EMPTY = Object.freeze([]);

// 单元格对齐白名单
const CELL_ALIGNS = ['left', 'center', 'right'];

// 渲染数学公式
function renderMath(node) {
  if (!node) return '';
  const typst = typeof node.typst === 'string'
    ? node.typst
    : (typeof node.value === 'string' ? node.value : (typeof node.text === 'string' ? node.text : ''));
  if (!typst.trim()) return '';

  try {
    return renderToString(typst, { displayMode: Boolean(node.display), output: 'html' });
  } catch (err) {
    console.warn('[TypstDoc] typlet 数学公式渲染失败:', typst, err);
    const escaped = typst.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="td-math-error" title="${err.message}">${escaped}</span>`;
  }
}

// 规范化卡片与标签类型标识
function kindToken(kind) {
  if (typeof kind !== 'string') return 'unknown';
  const token = kind.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return token || 'unknown';
}

// 基础取值助手
function isType(node, type) {
  return !!node && node.type === type;
}

function childrenOf(node) {
  return node && Array.isArray(node.children) ? node.children : EMPTY;
}

// 标题层级收敛至 h1 到 h6
function headingLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return 3;
  return Math.min(6, Math.max(1, Math.trunc(n)));
}

function headingTag(level) {
  return `h${headingLevel(level)}`;
}

// 获取节点锚点标识
function anchorOf(node) {
  if (!node) return null;
  const anchor = node.anchor;
  if (typeof anchor !== 'string') return null;
  const trimmed = anchor.trim();
  return trimmed ? trimmed : null;
}

// 标签变体映射
const TAG_VARIANTS = Object.freeze({
  red: 'red',
  blue: 'blue',
  green: 'green',
  orange: 'orange',
  amber: 'amber',
  gray: 'gray',
  grey: 'gray',
  muted: 'muted',
  purple: 'purple',
  cyan: 'cyan',
  teal: 'teal',
  lime: 'lime'
});

function tagVariant(color) {
  if (!color) return 'gray';
  const token = kindToken(color);
  return TAG_VARIANTS[token] || (String(color).trim().startsWith('#') || String(color).trim().startsWith('rgb') ? null : 'gray');
}

function tagCustomColor(color) {
  if (!color) return '';
  const c = String(color).trim();
  return (c.startsWith('#') || c.startsWith('rgb') || c.startsWith('hsl')) ? c : '';
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

// 单元格对齐类名
function cellAlignClass(cell) {
  const align = cell && CELL_ALIGNS.includes(cell.align) ? cell.align : null;
  return align ? `td-align-${align}` : '';
}

// 表格最小宽度计算
function tableStyle(node) {
  const columns = Number(node && node.columns);
  if (!Number.isFinite(columns) || columns < 4) return null;
  return { minWidth: `${Math.min(columns, 8) * 96}px` };
}

// 根节点与告警计算
const rootNodes = computed(() => {
  if (Array.isArray(props.nodes)) return props.nodes;

  const doc = props.doc;
  if (Array.isArray(doc)) return doc;
  if (doc && typeof doc === 'object') {
    if (Array.isArray(doc.children)) return doc.children;
    // 兼容直接传入单个节点
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
  <!-- 根容器 -->
  <div v-if="!flow" class="typst-doc">
    <TypstDoc :nodes="rootNodes" flow />

    <div v-if="warningList.length" class="td-warnings">
      <div class="td-warnings-title">文档解析告警（{{ warningList.length }}）</div>
      <ul class="td-warnings-list">
        <li v-for="(item, index) in warningList" :key="index">{{ warningText(item) }}</li>
      </ul>
    </div>
  </div>

  <!-- 递归输出节点流 -->
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

      <!-- 标签 -->
      <MTag
        v-else-if="isType(node, 'tag')"
        size="sm"
        :variant="tagVariant(node.color)"
        :color="tagCustomColor(node.color)"
      >{{ node.text }}</MTag>

      <!-- 数学公式 -->
      <component
        v-else-if="isType(node, 'math')"
        :is="node.display ? 'div' : 'span'"
        class="td-math"
        :class="{ 'is-display': !!node.display }"
        v-html="renderMath(node)"
      />

      <!-- 标题 -->
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
          <MTag
            v-for="(tag, tagIndex) in node.tags"
            :key="tagIndex"
            size="sm"
            :variant="tagVariant(tag && tag.color)"
            :color="tagCustomColor(tag && tag.color)"
          >{{ tag && tag.text }}</MTag>
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

      <!-- 游离列表项 -->
      <div v-else-if="isType(node, 'item')" class="td-item">
        <TypstDoc :nodes="childrenOf(node)" flow />
      </div>

      <!-- 提示框 -->
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

      <!-- 侧栏面板 -->
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

      <!-- 通用容器 -->
      <component
        v-else-if="isType(node, 'container') || isType(node, 'section')"
        :is="node.tag || (isType(node, 'section') ? 'section' : 'div')"
        :id="anchorOf(node)"
        :class="node.class"
        :style="node.style"
      >
        <TypstDoc :nodes="childrenOf(node)" flow />
      </component>

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

      <!-- 嵌套文档节点 -->
      <TypstDoc v-else-if="isType(node, 'doc')" :nodes="childrenOf(node)" flow />

      <!-- 未知类型兜底 -->
      <TypstDoc v-else-if="childrenOf(node).length" :nodes="childrenOf(node)" flow />
    </template>
  </template>
</template>
