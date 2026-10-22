<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Underline, FillColor, Trash } from '@iconoir/vue';

const props = defineProps({
  /**
   * 限制划选监听的容器元素或选择器，为 null 时监听整篇文档
   */
  container: {
    type: [Object, String],
    default: null
  },
  /**
   * 是否禁用工具栏
   */
  disabled: {
    type: Boolean,
    default: false
  },
  /**
   * 默认标记模式：'highlight' (背景高亮) 或 'underline' (下划线)
   */
  defaultMode: {
    type: String,
    default: 'highlight',
    validator: (v) => ['highlight', 'underline'].includes(v)
  },
  /**
   * 点击颜色后是否自动向当前选区注入 DOM 标记 (<span class="m-selection-mark">)
   */
  autoApply: {
    type: Boolean,
    default: true
  },
  /**
   * 标记完成后是否自动清除浏览器原生蓝色选区，让标记效果立即呈现
   */
  collapseSelectionOnApply: {
    type: Boolean,
    default: true
  },
  /**
   * 预设颜色配置，严格遵循温和耐看的阅读色彩原则
   */
  presetColors: {
    type: Array,
    default: () => [
      {
        key: 'yellow',
        name: '柠檬黄',
        dot: '#facc15',
        underline: '#fde047',
        bg: 'rgba(250, 204, 21, 0.38)',
        text: '#fef9c3'
      },
      {
        key: 'green',
        name: '荧光绿',
        dot: '#22c55e',
        underline: '#4ade80',
        bg: 'rgba(34, 197, 94, 0.36)',
        text: '#dcfce7'
      },
      {
        key: 'blue',
        name: '湖光蓝',
        dot: '#06b6d4',
        underline: '#38bdf8',
        bg: 'rgba(6, 182, 212, 0.36)',
        text: '#e0f2fe'
      },
      {
        key: 'purple',
        name: '罗兰紫',
        dot: '#a855f7',
        underline: '#c084fc',
        bg: 'rgba(168, 85, 247, 0.36)',
        text: '#f3e8ff'
      },
      {
        key: 'coral',
        name: '蜜桃粉',
        dot: '#f43f5e',
        underline: '#fb7185',
        bg: 'rgba(244, 63, 94, 0.36)',
        text: '#ffe4e6'
      }
    ]
  }
});

const emit = defineEmits([
  'apply',
  'clear',
  'mode-change',
  'color-change',
  'show',
  'hide'
]);

// 状态管理
const isVisible = ref(false);
const activeMode = ref(props.defaultMode);
const toolbarRef = ref(null);

// 浮动定位坐标
const position = ref({ top: 0, left: 0 });

// 当前保存的选区数据
const savedRange = ref(null);
const savedText = ref('');
const isOverExistingMark = ref(false);

/**
 * 切换标记模式 (高亮 / 下划线)
 */
const setMode = (mode) => {
  activeMode.value = mode;
  emit('mode-change', mode);
};

/**
 * 点击颜色直接应用到选区
 */
const selectColor = (colorConfig) => {
  emit('color-change', colorConfig);
  applyCurrentMark(colorConfig);
};

/**
 * 获取绑定的有效容器元素
 */
const getTargetContainer = () => {
  if (!props.container) return null;
  if (typeof props.container === 'string') {
    return document.querySelector(props.container);
  }
  return props.container;
};

/**
 * 检查节点是否位于容器内
 */
const isNodeInsideContainer = (node, container) => {
  if (!container || !node) return true;
  return container.contains(node);
};

/**
 * 智能选区吸附与净化：
 * 1. 自动消除首尾多余空白（空格、Tab、换行），确保高亮色块严密贴合文本字符
 * 2. 数学公式原子吸附：若划选触碰公式内部，自动对齐至整式边界，避免公式被切断
 */
const sanitizeAndSnapRange = (range) => {
  if (!range || range.collapsed) return range;

  const newRange = range.cloneRange();

  // (1) 公式原子吸附：如果起止点处于公式内部，向外扩展至公式容器整式边界
  const startFormula = getFormulaAncestor(newRange.startContainer);
  if (startFormula) {
    newRange.setStartBefore(startFormula);
  }

  const endFormula = getFormulaAncestor(newRange.endContainer);
  if (endFormula) {
    newRange.setEndAfter(endFormula);
  }

  // (2) 首尾空白字符自动修剪
  trimRangeWhitespace(newRange);

  return newRange;
};

const getFormulaAncestor = (node) => {
  if (!node) return null;
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return el?.closest?.('math, .dm, .katex, .typlet, .td-math');
};

const trimRangeWhitespace = (range) => {
  // 修剪起点多余空白
  while (
    range.startContainer.nodeType === Node.TEXT_NODE &&
    range.startOffset < range.startContainer.length
  ) {
    const char = range.startContainer.nodeValue[range.startOffset];
    if (/\s/.test(char)) {
      range.setStart(range.startContainer, range.startOffset + 1);
    } else {
      break;
    }
  }

  // 修剪终点多余空白
  while (
    range.endContainer.nodeType === Node.TEXT_NODE &&
    range.endOffset > 0
  ) {
    const char = range.endContainer.nodeValue[range.endOffset - 1];
    if (/\s/.test(char)) {
      range.setEnd(range.endContainer, range.endOffset - 1);
    } else {
      break;
    }
  }
};

const isNodeIntersectingRange = (node, range) => {
  if (!node || !range) return false;
  try {
    const nodeRange = document.createRange();
    nodeRange.selectNode(node);
    return (
      range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
    );
  } catch {
    return false;
  }
};

/**
 * 重新计算工具栏浮动坐标
 */
const updatePosition = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    hide();
    return;
  }

  const rawRange = selection.getRangeAt(0);
  const rawText = rawRange.toString().trim();
  if (!rawText) {
    hide();
    return;
  }

  const container = getTargetContainer();
  if (container) {
    if (
      !isNodeInsideContainer(rawRange.startContainer, container) ||
      !isNodeInsideContainer(rawRange.endContainer, container)
    ) {
      hide();
      return;
    }
  }

  // 执行智能吸附与修剪净化
  const range = sanitizeAndSnapRange(rawRange);
  const text = range.toString().trim();
  if (!text) {
    hide();
    return;
  }

  // 同步更新浏览器的原生选区高亮，使蓝色高亮边缘立即精准对齐文本与整式
  try {
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // 降级忽略选区替换异常
  }

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    hide();
    return;
  }

  // 检测选区是否处于已有标记内
  const commonAncestor = range.commonAncestorContainer;
  const ancestorEl = commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentElement : commonAncestor;
  isOverExistingMark.value = Boolean(
    ancestorEl?.closest?.('.m-selection-mark') ||
    (ancestorEl?.querySelector && ancestorEl.querySelector('.m-selection-mark'))
  );

  savedRange.value = range.cloneRange();
  savedText.value = text;

  // 计算居中横坐标
  const toolbarWidth = toolbarRef.value ? toolbarRef.value.offsetWidth : 240;
  const toolbarHeight = toolbarRef.value ? toolbarRef.value.offsetHeight : 38;

  let left = rect.left + rect.width / 2;
  // 边缘保护：距离视口左右两端至少保留 12px 安全距离
  const half = toolbarWidth / 2;
  left = Math.max(half + 12, Math.min(window.innerWidth - half - 12, left));

  // 计算纵坐标：优先显示在选区上方 8px，若触顶则翻转至选区下方 8px
  let top = rect.top - toolbarHeight - 8;
  if (top < 10) {
    top = rect.bottom + 8;
  }

  position.value = { top, left };

  if (!isVisible.value) {
    isVisible.value = true;
    emit('show', { range, text, rect });
  }
};

/**
 * 隐藏工具栏
 */
const hide = () => {
  if (isVisible.value) {
    isVisible.value = false;
    savedRange.value = null;
    savedText.value = '';
    isOverExistingMark.value = false;
    emit('hide');
  }
};

/**
 * 执行标记核心逻辑
 */
const applyCurrentMark = (targetColor = null) => {
  if (!savedRange.value) return;

  const mode = activeMode.value;
  const color = targetColor || props.presetColors[0];
  const range = savedRange.value;
  const text = savedText.value;

  let createdElements = [];

  if (props.autoApply) {
    createdElements = wrapRangeWithMark(range, {
      mode,
      color: mode === 'underline' ? color.underline : color.dot,
      bg: color.bg,
      text: color.text,
      colorKey: color.key
    });
  }

  emit('apply', {
    mode,
    colorKey: color.key,
    color,
    text,
    range,
    elements: createdElements
  });

  if (props.collapseSelectionOnApply) {
    window.getSelection()?.removeAllRanges();
  }

  hide();
};

/**
 * 清除当前选区内的所有标记
 */
const clearMarks = () => {
  if (!savedRange.value) return;

  const range = savedRange.value;
  const text = savedText.value;
  let removed = [];

  if (props.autoApply) {
    removed = removeMarksInRange(range);
  }

  emit('clear', {
    range,
    text,
    removedElements: removed
  });

  if (props.collapseSelectionOnApply) {
    window.getSelection()?.removeAllRanges();
  }

  hide();
};

/**
 * 安全标记算法：
 * - 普通文本：安全切片包裹 <span class="m-selection-mark">
 * - 数学公式 (math, .dm, .katex)：
 *   绝不在 MathML 或 KaTeX 内部注入任何 <span>，
 *   而是将整个公式作为原子，在外层包裹 <span class="m-selection-mark">，
 *   保证 MathML / KaTeX 内部 DOM 树结构、数学斜体字号与对齐 100% 原始不变！
 */
/**
 * 安全连续包裹算法：
 * 将划选的连续文字与公式合并为一个统一的 <span class="m-selection-mark">，
 * 绝不在同一行内拆成多个高低不齐的小 span！
 * 同一行的背景高亮由最外层的连续 span 统一渲染，高度严格一致，并以最高的内容（公式）为准！
 */
const wrapRangeWithMark = (range, config) => {
  const markId = `mk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 获取所属的块级容器 (如 p, li, h1-h6, div.dm 等)
  const startBlock = getBlockAncestor(range.startContainer);
  const endBlock = getBlockAncestor(range.endContainer);

  const createdElements = [];

  // 1. 同一自然段/块级容器内的划选（最常见情况：文字 + 行内公式一体化包裹）
  if (startBlock && startBlock === endBlock) {
    try {
      const wrapper = document.createElement('span');
      wrapper.className = `m-selection-mark m-mark-${config.mode}`;
      applyMarkStyles(wrapper, config, markId);

      const fragment = range.extractContents();
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);
      createdElements.push(wrapper);
      return createdElements;
    } catch {
      // 出现异常降级
    }
  }

  // 2. 跨段落划选处理：按块级切分子选区，每个段落内部独立保持整段一体化包裹
  const container = startBlock?.parentElement || document.body;
  const blocks = getIntersectingBlocks(container, range);

  if (blocks.length <= 1) {
    try {
      const wrapper = document.createElement('span');
      wrapper.className = `m-selection-mark m-mark-${config.mode}`;
      applyMarkStyles(wrapper, config, markId);
      const fragment = range.extractContents();
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);
      createdElements.push(wrapper);
      return createdElements;
    } catch {}
  }

  blocks.forEach((block) => {
    try {
      const subRange = document.createRange();
      subRange.selectNodeContents(block);

      if (range.compareBoundaryPoints(Range.START_TO_START, subRange) > 0) {
        subRange.setStart(range.startContainer, range.startOffset);
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, subRange) < 0) {
        subRange.setEnd(range.endContainer, range.endOffset);
      }

      if (!subRange.collapsed && subRange.toString().trim()) {
        const wrapper = document.createElement('span');
        wrapper.className = `m-selection-mark m-mark-${config.mode}`;
        applyMarkStyles(wrapper, config, markId);

        const fragment = subRange.extractContents();
        wrapper.appendChild(fragment);
        subRange.insertNode(wrapper);
        createdElements.push(wrapper);
      }
    } catch {}
  });

  return createdElements;
};

const getBlockAncestor = (node) => {
  if (!node) return null;
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return el?.closest?.('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, div.dm, article') || el;
};

const getIntersectingBlocks = (container, range) => {
  const blocks = [];
  const candidateTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div.dm'];
  const elements = container.querySelectorAll(candidateTags.join(', '));
  elements.forEach((el) => {
    if (isNodeIntersectingRange(el, range)) {
      blocks.push(el);
    }
  });
  return blocks;
};

const applyMarkStyles = (el, config, markId) => {
  el.dataset.markId = markId;
  el.dataset.markMode = config.mode;
  el.dataset.markColor = config.colorKey;

  if (config.mode === 'highlight') {
    el.style.backgroundColor = config.bg;
    el.style.color = config.text || '';
    el.style.borderRadius = '3px';
    el.style.padding = '0.15em 0.3em';
    el.style.borderBottom = 'none';
    el.style.paddingBottom = '';
    el.style.textDecoration = 'none';
  } else {
    el.style.backgroundColor = 'transparent';
    el.style.color = '';
    el.style.borderBottom = `2px solid ${config.color}`;
    el.style.paddingBottom = '2px';
    el.style.textDecoration = 'none';
  }
};

/**
 * 解包并清除范围内的所有已有标记
 */
const removeMarksInRange = (range) => {
  const commonAncestor = range.commonAncestorContainer;
  const root = commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentNode : commonAncestor;

  const parentMark = root.closest ? root.closest('.m-selection-mark') : null;
  if (parentMark) {
    unwrapElement(parentMark);
    return [parentMark];
  }

  const marks = root.querySelectorAll ? Array.from(root.querySelectorAll('.m-selection-mark')) : [];
  const removed = [];
  marks.forEach((mark) => {
    if (isNodeIntersectingRange(mark, range)) {
      unwrapElement(mark);
      removed.push(mark);
    }
  });

  return removed;
};

const unwrapElement = (el) => {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
  parent.normalize();
};

// 交互事件监听
const handleMouseUp = () => {
  if (props.disabled) return;
  // 延迟一帧，等待浏览器就绪并完成选区更新
  requestAnimationFrame(() => {
    updatePosition();
  });
};

const handleKeyUp = (e) => {
  if (props.disabled) return;
  if (e.key === 'Escape') {
    hide();
    return;
  }
  requestAnimationFrame(() => {
    updatePosition();
  });
};

const handleScroll = () => {
  if (isVisible.value) {
    // 页面滚动时实时平滑跟随重算，若选区滚出可视区则隐藏
    updatePosition();
  }
};

onMounted(() => {
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keyup', handleKeyUp);
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onBeforeUnmount(() => {
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('scroll', handleScroll);
});

// 对外暴露的方法与属性
defineExpose({
  show: updatePosition,
  hide,
  applyCurrentMark,
  clearMarks,
  isVisible,
  activeMode,
  savedText,
  savedRange
});
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-toolbar">
      <div
        v-if="isVisible && !disabled"
        ref="toolbarRef"
        class="m-selection-toolbar"
        :style="{
          top: `${position.top}px`,
          left: `${position.left}px`
        }"
        role="toolbar"
        aria-label="文本划选标记工具栏"
        @mousedown.prevent
      >
        <!-- 1. 标记模式切换区 (下划线 / 背景高亮) -->
        <div class="toolbar-mode-group">
          <button
            type="button"
            class="mode-btn"
            :class="{ 'is-active': activeMode === 'underline' }"
            title="下划线标记"
            @click="setMode('underline')"
          >
            <Underline width="15" height="15" />
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ 'is-active': activeMode === 'highlight' }"
            title="背景高亮标记"
            @click="setMode('highlight')"
          >
            <FillColor width="15" height="15" />
          </button>
        </div>

        <!-- 分隔竖线 -->
        <div class="toolbar-divider" />

        <!-- 2. 预设颜色色盘列表 (选定方式后点击颜色即直接应用) -->
        <div class="toolbar-colors-group">
          <button
            v-for="color in presetColors"
            :key="color.key"
            type="button"
            class="color-swatch-btn"
            :title="`以${color.name}${activeMode === 'underline' ? '划下划线' : '高亮'}`"
            @click="selectColor(color)"
          >
            <span class="color-dot" :style="{ backgroundColor: color.dot }" />
          </button>
        </div>

        <!-- 3. 清除已有标记按钮 -->
        <template v-if="isOverExistingMark">
          <div class="toolbar-divider" />
          <button
            type="button"
            class="clear-btn"
            title="清除选区标记"
            @click="clearMarks"
          >
            <Trash width="14" height="14" />
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m-selection-toolbar {
  position: fixed;
  z-index: 9999;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

/* 分隔竖线 */
.toolbar-divider {
  width: 1px;
  height: 16px;
  background-color: var(--border-subtle);
  flex-shrink: 0;
  margin: 0 2px;
}

/* 模式切换按钮组 */
.toolbar-mode-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.mode-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.mode-btn.is-active {
  background-color: var(--bg-elevated);
  color: var(--accent-primary);
}

/* 颜色选择色盘组 */
.toolbar-colors-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.color-swatch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: transform 120ms ease;
}

.color-swatch-btn:hover {
  transform: scale(1.22);
}

.color-dot {
  display: block;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition: box-shadow 120ms ease;
}

.color-swatch-btn:hover .color-dot {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4);
}

/* 清除标记按钮 */
.clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.clear-btn:hover {
  background-color: rgba(244, 63, 94, 0.15);
  color: #fb7185;
}

/* 快速轻盈的淡入淡出动画 */
.fade-toolbar-enter-active,
.fade-toolbar-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.fade-toolbar-enter-from,
.fade-toolbar-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px) scale(0.97);
}
</style>
