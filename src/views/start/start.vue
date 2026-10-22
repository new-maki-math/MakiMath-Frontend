<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Search, Xmark, Terminal, Compass, ArrowRight, Book, Sparks } from '@iconoir/vue';
import { renderToString } from 'typlet';
import { getCourseCategories } from '../../api';
import { useLectureSearch, getCourseTagVariant, getSectionTags, getSectionTagVariant } from '../../utils';
import StartBackground from './StartBackground.vue';

const router = useRouter();

// DOM 引用
const heroSearchBoxRef = ref(null);
const heroInputRef = ref(null);
const listRef = ref(null);

// 搜索状态与动画控制
const isOpen = ref(false);
const isFlying = ref(false);
const flightStyle = ref({});

// 占位提示轮播
const placeholders = [
  '搜索考研高数核心定理，如: 泰勒公式...',
  '搜索课程或章节，如: 极限与连续...',
  '键入 Typst 公式代码，如: $f(x) = \\int_0^x e^{-t^2} dt$...',
  '搜索线性代数，如: 特征值与相似对角化...'
];
const currentPlaceholder = ref(placeholders[0]);
let placeholderTimer = null;
let phIndex = 0;

const startPlaceholderLoop = () => {
  placeholderTimer = setInterval(() => {
    phIndex = (phIndex + 1) % placeholders.length;
    currentPlaceholder.value = placeholders[phIndex];
  }, 3600);
};

// 预设数学节点数据
const sampleMathNodes = [
  { id: 'm1', title: '泰勒中值定理与佩亚诺余项', tag: '定理', courseTitle: '考研数学精讲', excerpt: '若函数在区间内存在直至连续高阶导数则泰勒公式展开式余项可由佩亚诺形式精确表示', path: '/course/kaoyan/doc/sec-2-3' },
  { id: 'm2', title: '实数确界存在定理与单调有界准则', tag: '公理', courseTitle: '考研数学精讲', excerpt: '非空有上界的实数集必有上确界从而奠定极限论单调有界收敛原理的基石', path: '/course/kaoyan/doc/sec-1-1' },
  { id: 'm3', title: '定积分的几何应用：旋转体体积与弧长', tag: '应用', courseTitle: '考研数学精讲', excerpt: '平面曲线绕轴旋转生成的旋转体体积微元与平滑弧长积分计算法则详解', path: '/course/kaoyan/doc/sec-3-2' },
  { id: 'm4', title: '特征值、特征向量与矩阵正交对角化', tag: '方法', courseTitle: '线性代数精讲', excerpt: '实对称矩阵不同特征值对应的特征向量相互正交且必可通过正交矩阵相似对角化', path: '/course/kaoyan' },
  { id: 'm5', title: '拉格朗日中值定理与柯西中值定理', tag: '定理', courseTitle: '考研数学精讲', excerpt: '可导函数在闭区间连续开区间可导则必存在中值点其导数值等于割线斜率', path: '/course/kaoyan/doc/sec-2-2' }
];

const {
  query,
  isSearching,
  activeIndex,
  displayResults: filteredResults,
  clear: clearQuery,
  handleKeyNavigation
} = useLectureSearch({
  defaultItems: () => sampleMathNodes.slice(0, 4),
  limit: 15,
  listRef
});

// 头部胶囊文字解码动效
const TARGET_PILL_TEXT = 'MAKIMATH // ADVANCED MATHEMATICAL WORKSTATION';
const displayPillText = ref('');

const runDecodeAnimation = () => {
  const chars = '01#_*/Σ∂∫λΔΩπ∇+-=<>[]';
  const target = TARGET_PILL_TEXT;
  const length = target.length;
  let iteration = 0;
  const totalFrames = 42;

  const interval = setInterval(() => {
    displayPillText.value = target
      .split('')
      .map((letter, index) => {
        if (letter === ' ' || letter === '/') return letter;
        if (index < (iteration / totalFrames) * length) {
          return target[index];
        }
        return chars[Math.floor(Math.random() * chars.length)];
      })
      .join('');

    iteration++;
    if (iteration > totalFrames) {
      clearInterval(interval);
      displayPillText.value = target;
    }
  }, 36);
};

// 加载课程列表
onMounted(async () => {
  runDecodeAnimation();
  startPlaceholderLoop();
  try {
    const cats = await getCourseCategories();
    const list = [];
    cats.forEach(cat => {
      (cat.courses || []).forEach(c => {
        list.push({
          id: `c_${c.id}`,
          title: c.title,
          type: '精品课程',
          variant: 'green',
          path: `/course/${c.id}`,
          tag: 'COURSE'
        });
      });
    });
    realCourses.value = list;
  } catch (err) {
    console.warn('[StartView] 获取课程失败，使用默认节点', err);
  }
});

onUnmounted(() => {
  if (placeholderTimer) clearInterval(placeholderTimer);
});

// 检测 Typst 公式输入并即时编译
const typstPreviewHtml = computed(() => {
  const q = query.value.trim();
  if (!q) return null;
  // 包含数学符号时即时编译
  if (q.startsWith('$') || q.includes('\\') || q.includes('^') || q.includes('_') || q.includes('=')) {
    try {
      const cleanTypst = q.replace(/^\$+|\$+$/g, '').trim();
      if (!cleanTypst) return null;
      return renderToString(cleanTypst, { displayMode: true });
    } catch {
      return null;
    }
  }
  return null;
});

// 快捷导航项
const quickShortcuts = [
  { label: '考研数学精讲', path: '/course/kaoyan', icon: Book },
  { label: '讲义工作台', path: '/workbench', icon: Terminal },
  { label: '讲义推荐路线', path: '/recom-lecture', icon: Compass },
  { label: '如何使用平台', path: '/how-to-use', icon: Sparks }
];

// 聚焦与失焦处理
const handleFocus = () => {
  isOpen.value = true;
};

const handleBlur = () => {
  // 延迟失焦确保点击触发
  setTimeout(() => {
    isOpen.value = false;
  }, 180);
};

// 启动向顶栏的飞行动画并跳转
const flyAndNavigate = (targetPath) => {
  if (isFlying.value) return;

  isOpen.value = false;
  const heroEl = heroSearchBoxRef.value;
  const targetEl = document.querySelector('.topbar-center');

  if (!heroEl || !targetEl) {
    router.push(targetPath);
    return;
  }

  const heroRect = heroEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  // 计算飞行动画位移与缩放
  const dx = targetRect.left - heroRect.left;
  const dy = targetRect.top - heroRect.top;
  const sx = targetRect.width / heroRect.width;
  const sy = targetRect.height / heroRect.height;

  flightStyle.value = {
    transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`,
    transformOrigin: 'top left'
  };

  isFlying.value = true;

  // 动画结束切换路由
  setTimeout(() => {
    router.push(targetPath);
  }, 280);
};

// 键盘导航控制
const handleKeyDown = (e) => {
  if (e.key === 'Escape') {
    isOpen.value = false;
    heroInputRef.value?.blur();
    return;
  }
  handleKeyNavigation(e, (item) => {
    flyAndNavigate(item.path || '/course/kaoyan');
  });
};
</script>

<template>
  <div class="start-viewport" :class="{ 'is-flying': isFlying }">
    <!-- 动态拓扑背景独立组件 -->
    <StartBackground />

    <div class="start-main-container" :class="{ 'is-leaving': isFlying }">
      <!-- 极客头部标识与副标题 -->
      <header class="start-header">
        <div class="brand-pill font-mono">
          <Terminal width="13" height="13" class="pill-icon" />
          <span>{{ displayPillText || TARGET_PILL_TEXT }}</span>
        </div>
        <h1 class="start-title">
          结构化数学讲义与知识拓扑平台
        </h1>
        <p class="start-desc">
          毫秒级 Typst 公式排版 · 前置定理依赖图谱 · 沉浸式 IDE 极客视界
        </p>
      </header>

      <!-- 中央超级检索舱 -->
      <div class="hero-search-wrapper">
        <div
          ref="heroSearchBoxRef"
          class="hero-search-box"
          :class="{ 'is-focused': isOpen, 'is-in-flight': isFlying }"
          :style="isFlying ? flightStyle : {}"
          @click="heroInputRef?.focus()"
        >
          <div class="hero-search-inner">
            <Search width="19" height="19" class="hero-search-icon" />
            <div class="input-field-wrapper">
              <input
                ref="heroInputRef"
                v-model="query"
                type="text"
                class="hero-native-input"
                @focus="handleFocus"
                @blur="handleBlur"
                @keydown="handleKeyDown"
              />
              <!-- 动态垂直滚动翻转的提示文字 -->
              <div v-if="!query" class="animated-placeholder-box">
                <transition name="placeholder-roll" mode="out-in">
                  <span :key="currentPlaceholder" class="placeholder-text">
                    {{ currentPlaceholder }}
                  </span>
                </transition>
              </div>
            </div>
            <button
              v-if="query && !isFlying"
              class="clear-btn"
              title="清除"
              @click.stop="query = ''; heroInputRef?.focus()"
            >
              <Xmark width="16" height="16" />
            </button>
            <div v-else class="hero-kbd-wrap font-mono">
              <kbd class="hero-kbd">Ctrl+K</kbd>
            </div>
          </div>
        </div>

        <!-- 实时搜索结果浮层面板 -->
        <transition name="dropdown-fade">
          <div v-if="isOpen && !isFlying" class="hero-dropdown-card">
            <!-- Typst 实时公式预览条目 -->
            <transition name="preview-slide">
              <div v-if="typstPreviewHtml" class="typst-preview-box">
                <div class="preview-header font-mono">
                  <span class="preview-tag">TYPST LIVE COMPILED</span>
                  <span class="preview-hint">毫秒级公式即时排版预览</span>
                </div>
                <div class="preview-body" v-html="typstPreviewHtml"></div>
              </div>
            </transition>

            <!-- 搜索结果列表 -->
            <div class="dropdown-header">
              <span>{{ query ? '匹配数学讲义与小节' : '推荐核心数学定理与章节' }}</span>
              <span class="count-tag font-mono">{{ filteredResults.length }} 节点</span>
            </div>

            <!-- 带平滑重排与交错过渡的列表项容器 -->
            <TransitionGroup
              v-if="filteredResults.length"
              ref="listRef"
              name="result-item"
              tag="div"
              class="dropdown-list"
            >
              <div
                v-for="(item, idx) in filteredResults"
                :key="item.id"
                class="result-row"
                :class="{ 'is-active': activeIndex === idx }"
                @mousedown.prevent="flyAndNavigate(item.path)"
                @mouseenter="activeIndex = idx"
              >
                <!-- 标签列包含课程名称与小节标签 -->
                <div class="result-tag-col">
                  <MTag :variant="getCourseTagVariant(item.courseTitle || item.course)" size="sm" :mono="false">
                    {{ item.courseTitle || item.course }}
                  </MTag>
                  <MTag
                    v-for="(st, stIdx) in getSectionTags(item.tag)"
                    :key="stIdx"
                    :variant="getSectionTagVariant(st)"
                    size="sm"
                    :mono="false"
                  >
                    {{ st }}
                  </MTag>
                </div>
                <div class="result-content-col">
                  <!-- 标题为该小节名称 -->
                  <span class="result-title">{{ item.title }}</span>
                  <!-- 副标题为搜索关键词所在的语句节选 -->
                  <span class="result-excerpt font-mono">
                    {{ item.excerpt || item.summary || item.chapterTitle }}
                  </span>
                </div>
                <ArrowRight width="14" height="14" class="result-arrow" />
              </div>
            </TransitionGroup>

            <div v-else class="empty-state">
              <span>未检索到与 "{{ query }}" 相关的数学节点</span>
            </div>

            <div class="dropdown-footer font-mono">
              <span><kbd>↑</kbd><kbd>↓</kbd> 导航</span>
              <span><kbd>Enter</kbd> 确认并跳转</span>
              <span><kbd>Esc</kbd> 退出</span>
            </div>
          </div>
        </transition>
      </div>

      <!-- 快捷胶囊入口 -->
      <div class="shortcuts-row">
        <span class="shortcuts-label font-mono">FAST TRACK //</span>
        <button
          v-for="sc in quickShortcuts"
          :key="sc.path"
          class="shortcut-btn"
          @click="flyAndNavigate(sc.path)"
        >
          <component :is="sc.icon" width="14" height="14" class="sc-icon" />
          <span>{{ sc.label }}</span>
        </button>
      </div>
    </div>

    <!-- 底部悬挂备案信息 -->
    <footer class="start-beian-footer font-mono" :class="{ 'is-leaving': isFlying }">
      <span class="beian-item copyright">© 2026 MakiMath</span>
      <span class="beian-sep">/</span>
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        class="beian-link"
      >
        沪ICP备2022010774号
      </a>
    </footer>
  </div>
</template>

<style scoped>
/* 欢迎页视口布局 */
.start-viewport {
  width: 100%;
  height: 100%;
  min-height: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  background-color: var(--bg-app);
  user-select: none;
  padding-top: clamp(80px, 17vh, 150px);
}

/* 主容器 */
.start-main-container {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
  max-width: 720px;
  padding: 0 24px;
  transition: opacity 260ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 飞行动画淡出周围元素 */
.start-main-container.is-leaving .start-header,
.start-main-container.is-leaving .shortcuts-row {
  opacity: 0;
  transition: opacity 200ms ease;
  pointer-events: none;
}

/* 顶部标题栏 */
.start-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}

.brand-pill {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: var(--radius-xs);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  font-size: var(--font-size-smallest);
  color: var(--accent-primary);
  letter-spacing: 0.75px;
}

/* 微光扫光动效 */
.brand-pill::after {
  content: '';
  position: absolute;
  top: 0;
  left: -120%;
  width: 65%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 20%,
    rgba(255, 255, 255, 0.42) 50%,
    rgba(255, 255, 255, 0.06) 80%,
    transparent 100%
  );
  transform: skewX(-20deg);
  animation: pillShimmer 2.8s 0.25s cubic-bezier(0.25, 0.9, 0.35, 1) forwards;
  pointer-events: none;
}

@keyframes pillShimmer {
  from {
    left: -100%;
  }
  to {
    left: 200%;
  }
}

.pill-icon {
  color: var(--accent-primary);
}

.start-title {
  font-size: 26px;
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

.start-desc {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  max-width: 520px;
  line-height: 1.6;
}

/* 检索舱容器 */
.hero-search-wrapper {
  position: relative;
  width: 100%;
  max-width: 640px;
}

.hero-search-box {
  width: 100%;
  height: 52px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  cursor: text;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transition: border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease;
  will-change: transform;
}

.hero-search-box:hover {
  background-color: var(--bg-elevated);
  border-color: var(--border-hover);
}

.hero-search-box.is-focused {
  background-color: var(--bg-elevated);
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--accent-primary), 0 8px 30px rgba(0, 0, 0, 0.25);
}

/* 飞行状态 */
.hero-search-box.is-in-flight {
  border-color: var(--border-subtle) !important;
  box-shadow: none !important;
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease !important;
  pointer-events: none;
  z-index: 999;
}

.hero-search-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  padding: 0 16px;
}

.hero-search-icon {
  flex-shrink: 0;
  color: var(--accent-primary);
}

.input-field-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
  overflow: hidden;
}

.hero-native-input {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: var(--font-size);
  font-family: var(--font-ui);
  position: relative;
  z-index: 2;
}

/* 占位文字层 */
.animated-placeholder-box {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 1;
}

.placeholder-text {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
}

/* 占位文字动效 */
.placeholder-roll-enter-active,
.placeholder-roll-leave-active {
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease;
}

.placeholder-roll-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.placeholder-roll-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.clear-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: var(--radius-xs);
}

.clear-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-base);
}

.hero-kbd-wrap {
  display: flex;
  align-items: center;
}

.hero-kbd {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background-color: var(--bg-base);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
}

/* 下拉卡片 */
.hero-dropdown-card {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 50;
  max-height: 380px;
}

/* Typst 编译预览 */
.typst-preview-box {
  padding: 12px 16px;
  background-color: var(--bg-base);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.preview-slide-enter-active,
.preview-slide-leave-active {
  transition: all 220ms cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 140px;
  overflow: hidden;
}

.preview-slide-enter-from,
.preview-slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  transform: translateY(-6px);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-tag {
  font-size: 11px;
  color: var(--accent-primary);
  font-weight: var(--font-weight-medium);
}

.preview-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.preview-body {
  padding: 6px 10px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.dropdown-header {
  padding: 10px 16px;
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
}

.count-tag {
  font-size: 11px;
}

.dropdown-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: 220px;
  position: relative;
}

/* 结果项动画 */
.result-item-move {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.result-item-enter-active {
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.result-item-leave-active {
  transition: all 160ms ease-in;
  position: absolute;
  width: 100%;
}

.result-item-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.99);
}

.result-item-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* 列表行样式 */
.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background-color 160ms cubic-bezier(0.16, 1, 0.3, 1),
              border-left-color 160ms cubic-bezier(0.16, 1, 0.3, 1),
              padding-left 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.result-row:hover,
.result-row.is-active {
  background-color: var(--bg-elevated);
  border-left-color: var(--accent-primary);
  padding-left: 20px;
}

.result-tag-col {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  transition: transform 160ms ease;
}

.start-tag-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--accent-primary);
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.result-content-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  transition: transform 160ms ease;
}

.result-title {
  font-size: var(--font-size);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-path {
  font-size: 11px;
  color: var(--text-muted);
}

.result-excerpt {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.result-arrow {
  color: var(--text-muted);
  opacity: 0.3;
  flex-shrink: 0;
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
              opacity 180ms ease,
              color 180ms ease;
}

.result-row:hover .result-arrow,
.result-row.is-active .result-arrow {
  color: var(--accent-primary);
  opacity: 1;
  transform: translateX(4px);
}

.empty-state {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}

.dropdown-footer {
  padding: 8px 16px;
  background-color: var(--bg-base);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 11px;
  color: var(--text-muted);
}

.dropdown-footer kbd {
  padding: 1px 4px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  margin-right: 4px;
}

/* 下拉渐隐动画 */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* 快捷导航入口 */
.shortcuts-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  transition: all 240ms ease;
}

.shortcuts-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-right: 4px;
}

.shortcut-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-size: var(--font-size-smallest);
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.shortcut-btn:hover {
  background-color: var(--bg-elevated);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.sc-icon {
  color: var(--text-muted);
}

.shortcut-btn:hover .sc-icon {
  color: var(--accent-primary);
}

/* 底部备案信息 */
.start-beian-footer {
  position: absolute;
  bottom: 14px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.6;
  transition: opacity 200ms ease;
  z-index: 10;
  user-select: text;
}

.start-beian-footer:hover {
  opacity: 0.95;
}

.start-beian-footer.is-leaving {
  opacity: 0;
  pointer-events: none;
}

.beian-link {
  color: var(--text-muted);
  text-decoration: none;
  transition: color 140ms ease;
}

.beian-link:hover {
  color: var(--accent-primary);
  text-decoration: underline;
}

.beian-sep {
  opacity: 0.35;
}
</style>
