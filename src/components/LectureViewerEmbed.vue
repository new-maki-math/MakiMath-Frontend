<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import 'katex/dist/katex.min.css';
import { capHTML, texHTML } from '../utils/lecture/core.js';
import { createLectureEngine } from '../utils/lecture/engine.js';
import MButton from './MButton.vue';
import MLoadingMask from './MLoadingMask.vue';
import MDrawer from './MDrawer.vue';

const props = defineProps({
  animation: {
    type: Object,
    required: true
  },
  initialPage: {
    type: Number,
    default: 1
  },
  initialStep: {
    type: Number,
    default: 1
  },
  title: {
    type: String,
    default: ''
  },
  buttonSize: {
    type: String,
    default: 'md'
  },
  active: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['step-change']);

const containerRef = ref(null);
const viewRef = ref(null);
const stageRef = ref(null);
const cvRef = ref(null);
const topRef = ref(null);
const domRef = ref(null);
const preRef = ref(null);

const isFullscreen = ref(false);
const showNote = ref(true);
const showToc = ref(false);
const errorMessage = ref('');

const pages = ref([]);
const pi = ref(0);
const si = ref(0);

const isLoading = ref(true);
const loadingText = ref('等待页面准备…');
const loadingProgress = ref(0);
let loadSessionId = 0;

let engine = null;
let animRaf = null;
let resizeObserver = null;

const displayTitle = computed(() => {
  return props.title || props.animation?.title || '板书交互动画';
});

const currentPage = computed(() => {
  return pages.value[pi.value] || null;
});

const totalSteps = computed(() => {
  return currentPage.value?.steps?.length || 1;
});

const canPrev = computed(() => {
  return pi.value > 0 || si.value > 0;
});

const canNext = computed(() => {
  if (!currentPage.value) return false;
  return pi.value < pages.value.length - 1 || si.value < totalSteps.value - 1;
});

const canPrevPage = computed(() => {
  return pi.value > 0;
});

const canNextPage = computed(() => {
  return pi.value < pages.value.length - 1;
});

const canExpand = computed(() => {
  return si.value < totalSteps.value - 1;
});

const canCollapse = computed(() => {
  return si.value > 0;
});

const cuesIn = (a, b) => {
  const cues = props.animation?.cues || [];
  return cues.filter((c) => c[1] > a + 0.05 && c[0] < b - 0.05);
};

const firstCue = (a, b) => {
  const cues = props.animation?.cues || [];
  const c = cues.find((x) => x[0] >= a - 0.05 && x[0] < b);
  return c ? c[2] : null;
};

const noteHtml = computed(() => {
  if (!showNote.value || !currentPage.value) return '';
  const P = currentPage.value;
  const n = totalSteps.value;
  const curS = si.value;
  const a = curS ? P.steps[curS - 1].b : P.t0;
  const b = curS === n - 1 ? P.t1 : P.steps[curS].b;
  const old = cuesIn(P.t0, a)
    .slice(-2)
    .map((c) => capHTML(c[2]))
    .join('，');
  const cur = cuesIn(a, b)
    .map((c) => capHTML(c[2]))
    .join('，');
  return (old ? `<span class="old">${old}，</span>` : '') + (cur || '<span class="old">（这一步没有讲解文字）</span>');
});

const stopAnim = () => {
  if (animRaf) {
    cancelAnimationFrame(animRaf);
    animRaf = null;
  }
};

const draw = (t) => {
  if (engine) {
    engine.renderAt(t);
  }
};

const play = (a, b, done) => {
  stopAnim();
  const dur = Math.max(0.15, Math.min(1.2, (b - a) * 0.6)) * 1000;
  const st = performance.now();
  const step = (now) => {
    const u = Math.min(1, (now - st) / dur);
    draw(a + (b - a) * u);
    if (u < 1) {
      animRaf = requestAnimationFrame(step);
    } else {
      animRaf = null;
      if (done) done();
    }
  };
  animRaf = requestAnimationFrame(step);
};

const go = (p, s, how) => {
  if (!pages.value.length) return;
  p = Math.max(0, Math.min(pages.value.length - 1, p));
  const P = pages.value[p];
  s = Math.max(0, Math.min(P.steps.length - 1, s));
  const S = P.steps[s];

  let from = null;
  if (how === 'anim') {
    if (p === pi.value && s === si.value + 1) {
      from = P.steps[s - 1].b;
    } else if (p !== pi.value && s === 0) {
      from = P.t0;
    }
  }

  pi.value = p;
  si.value = s;

  if (from != null) {
    play(from, S.b);
  } else {
    stopAnim();
    draw(S.b);
  }

  emit('step-change', {
    page: pi.value + 1,
    step: si.value + 1,
    steps: P.steps.length,
    pages: pages.value.length,
    title: P.title
  });
};

const next = () => {
  const P = currentPage.value;
  if (!P) return;
  if (si.value < P.steps.length - 1) {
    go(pi.value, si.value + 1, 'anim');
  } else if (pi.value < pages.value.length - 1) {
    go(pi.value + 1, 0, 'anim');
  }
};

const prev = () => {
  if (si.value > 0) {
    go(pi.value, si.value - 1);
  } else if (pi.value > 0) {
    go(pi.value - 1, pages.value[pi.value - 1].steps.length - 1);
  }
};

const nextPage = () => {
  if (pi.value < pages.value.length - 1) {
    go(pi.value + 1, 0, 'anim');
  }
};

const prevPage = () => {
  if (pi.value > 0) {
    go(pi.value - 1, 0);
  }
};

const expand = () => {
  if (currentPage.value) {
    go(pi.value, currentPage.value.steps.length - 1);
  }
};

const collapse = () => {
  go(pi.value, 0);
};

const updateFit = () => {
  if (!viewRef.value || !stageRef.value) return;
  const crop = props.animation?.config?.crop || { x: 0, y: 0, w: 1920, h: 960 };
  const s = viewRef.value.clientWidth / crop.w;
  viewRef.value.style.height = `${crop.h * s}px`;
  stageRef.value.style.transform = `translate(${-crop.x * s}px, ${-crop.y * s}px) scale(${s})`;
};

const buildPages = () => {
  const SC = engine ? engine.SCENES : [];
  const ST = {};
  (props.animation?.steps || []).forEach((p) => {
    ST[p.id] = p;
  });
  const parts = props.animation?.parts || [];
  let rmCount = 0;
  pages.value = SC.map((n, i) => {
    let title = n.title;
    let sec = null;
    if (/_rm/.test(n.id)) {
      title = '本讲路线';
      if (parts[rmCount]) sec = parts[rmCount];
      rmCount++;
    }
    if (!title) {
      title = i === 0 ? '开场' : firstCue(n.t0, n.t1) || '（无标题）';
    }
    const st = ST[n.id];
    const stepList =
      st && st.steps && st.steps.length
        ? st.steps
        : [
            { a: n.t0, b: Math.min(n.t1, n.t0 + 1.6) },
            { a: n.t0 + 1.6, b: n.t1 - 0.02 }
          ];
    return { id: n.id, t0: n.t0, t1: n.t1, title, sec, steps: stepList };
  });
};

const initPlayer = async () => {
  const sessionId = ++loadSessionId;
  errorMessage.value = '';
  stopAnim();
  if (engine) {
    engine.destroy();
    engine = null;
  }

  // 初始加载状态
  isLoading.value = true;
  loadingProgress.value = 10;
  loadingText.value = '正在载入交互动画…';

  // 延迟进入：让路由和页面先完成挂载与初次渲染，避免与页面进入动画产生竞争和掉帧
  await nextTick();
  await new Promise((r) => setTimeout(r, 60));
  if (sessionId !== loadSessionId) return;

  if (!cvRef.value || !topRef.value || !domRef.value) {
    isLoading.value = false;
    return;
  }

  try {
    loadingProgress.value = 30;
    loadingText.value = '准备画布与视口…';
    updateFit();
    await new Promise((r) => setTimeout(r, 20));
    if (sessionId !== loadSessionId) return;

    loadingProgress.value = 55;
    loadingText.value = '初始化动画引擎…';
    engine = createLectureEngine({
      cvEl: cvRef.value,
      topEl: topRef.value,
      domEl: domRef.value,
      capEl: null,
      preEl: preRef.value,
      cues: props.animation?.cues || [],
      parts: props.animation?.parts || [],
      config: props.animation?.config || {}
    });
    await new Promise((r) => setTimeout(r, 20));
    if (sessionId !== loadSessionId) return;

    loadingProgress.value = 75;
    loadingText.value = '构建场景动效与分步…';
    const code = props.animation?.scenes_code || '';
    if (code) {
      engine.executeScenes(code);
    }
    await new Promise((r) => setTimeout(r, 20));
    if (sessionId !== loadSessionId) return;

    loadingProgress.value = 90;
    loadingText.value = '预热数学公式与字体…';
    engine.preloadFonts();
    buildPages();

    if (pages.value.length) {
      const pIdx = Math.max(0, Math.min(pages.value.length - 1, (props.initialPage || 1) - 1));
      const sIdx = Math.max(0, Math.min(pages.value[pIdx].steps.length - 1, (props.initialStep || 1) - 1));
      go(pIdx, sIdx);
    }
    updateFit();

    loadingProgress.value = 100;
    loadingText.value = '加载完成';
    await new Promise((r) => setTimeout(r, 120));
    if (sessionId !== loadSessionId) return;
    isLoading.value = false;
  } catch (err) {
    console.error('[LectureViewer] 初始化异常:', err);
    errorMessage.value = '动画脚本执行出错: ' + err.message;
    isLoading.value = false;
  }
};

const handleViewClick = (e) => {
  if (!viewRef.value) return;
  const r = viewRef.value.getBoundingClientRect();
  if (e.clientX - r.left < r.width / 3) {
    prev();
  } else {
    next();
  }
};

const handleKeyDown = (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  const k = e.key;
  if (k === 'ArrowRight' || k === ' ' || k === 'Enter') {
    next();
    e.preventDefault();
  } else if (k === 'ArrowLeft') {
    prev();
    e.preventDefault();
  } else if (k === 'ArrowDown' || k === 'PageDown') {
    nextPage();
    e.preventDefault();
  } else if (k === 'ArrowUp' || k === 'PageUp') {
    prevPage();
    e.preventDefault();
  } else if (k === 'e' || k === 'E') {
    expand();
  } else if (k === 'c' || k === 'C') {
    collapse();
  } else if (k === 'Escape') {
    showToc.value = false;
  }
};

const toggleFullscreen = () => {
  if (!containerRef.value) return;
  if (!document.fullscreenElement) {
    containerRef.value.requestFullscreen?.().catch(() => {});
    isFullscreen.value = true;
  } else {
    document.exitFullscreen?.().catch(() => {});
    isFullscreen.value = false;
  }
};

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;
  nextTick(updateFit);
};

watch(
  () => props.active,
  (isActive) => {
    if (isActive) {
      initPlayer();
    } else {
      stopAnim();
    }
  }
);

watch(
  () => [
    props.animation?.scenes_code,
    JSON.stringify(props.animation?.steps),
    JSON.stringify(props.animation?.cues),
    JSON.stringify(props.animation?.parts)
  ],
  () => {
    initPlayer();
  }
);

onMounted(() => {
  initPlayer();
  if (viewRef.value) {
    resizeObserver = new ResizeObserver(updateFit);
    resizeObserver.observe(viewRef.value);
  }
  window.addEventListener('keydown', handleKeyDown);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onBeforeUnmount(() => {
  loadSessionId++;
  stopAnim();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  window.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  if (engine) {
    engine.destroy();
    engine = null;
  }
});

defineExpose({
  go,
  next,
  prev,
  nextPage,
  prevPage,
  expand,
  collapse
});
</script>

<template>
  <div ref="containerRef" class="lecture-viewer-root" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="viewer-frame">
      <!-- 极简元信息与快捷操作栏 -->
      <div class="viewer-meta-bar">
        <div class="meta-left">
          <span v-if="pages.length" class="meta-page font-mono">
            第 {{ pi + 1 }} / {{ pages.length }} 页
          </span>
          <span
            class="meta-title"
            v-html="texHTML(currentPage?.title || displayTitle)"
          />
        </div>

        <div class="meta-actions">
          <MButton size="sm" variant="ghost" @click="showToc = true">
            目录
          </MButton>
          <MButton size="sm" variant="ghost" @click="toggleFullscreen">
            {{ isFullscreen ? '退出全屏' : '全屏' }}
          </MButton>
        </div>
      </div>

      <!-- 舞台核心视口（极简微边框，无多余嵌套包装） -->
      <div
        ref="viewRef"
        class="stage-viewport"
        @click="handleViewClick"
      >
        <div ref="stageRef" class="stage-canvas-box">
          <canvas ref="cvRef" width="1920" height="1080" class="canvas-layer"></canvas>
          <div ref="domRef" class="dom-layer"></div>
          <canvas ref="topRef" width="1920" height="1080" class="canvas-layer"></canvas>
          <div ref="preRef" class="pre-layer"></div>
        </div>

        <div v-if="errorMessage" class="stage-error">
          {{ errorMessage }}
        </div>

        <!-- 动画异步加载遮罩 -->
        <MLoadingMask
          :visible="isLoading"
          :text="loadingText"
          :progress="loadingProgress"
        />

        <!-- 动画目录抽屉：仅在动画显示的容器内右侧展开 -->
        <MDrawer
          :open="showToc"
          placement="right"
          title="ANIMATION // 目录"
          width="320px"
          :z-index="60"
          @close="showToc = false"
        >
          <div class="toc-list">
            <template v-for="(pItem, idx) in pages" :key="idx">
              <div v-if="pItem.sec" class="toc-sec-title" v-html="texHTML(pItem.sec)"></div>
              <div
                class="toc-row"
                :class="{ 'is-current': idx === pi }"
                @click="go(idx, 0, 'anim'); showToc = false;"
              >
                <span class="row-num font-mono">{{ idx + 1 }}</span>
                <span class="row-title" v-html="texHTML(pItem.title)"></span>
              </div>
            </template>
          </div>
        </MDrawer>
      </div>

      <!-- 底部控制条：单层紧凑排列 -->
      <div class="viewer-ctrl-row">
        <div class="ctrl-step-group">
          <MButton
            :size="buttonSize"
            variant="secondary"
            :disabled="!canPrev"
            @click="prev"
          >
            ‹ 上一步
          </MButton>

          <!-- 步骤进度指示圆点 -->
          <div v-if="currentPage && currentPage.steps.length > 1" class="step-dots">
            <i
              v-for="(_, k) in currentPage.steps"
              :key="k"
              :class="{ done: k < si, cur: k === si }"
              @click.stop="go(pi, k)"
            />
          </div>

          <span class="step-counter font-mono">
            {{ si + 1 }} / {{ totalSteps }}
          </span>

          <MButton
            :size="buttonSize"
            variant="primary"
            :disabled="!canNext"
            @click="next"
          >
            下一步 ›
          </MButton>
        </div>

        <div class="ctrl-page-group">
          <MButton
            :size="buttonSize"
            variant="secondary"
            :disabled="!canPrevPage"
            class="hide-s"
            @click="prevPage"
          >
            上一页
          </MButton>
          <MButton
            :size="buttonSize"
            variant="secondary"
            :disabled="!canNextPage"
            class="hide-s"
            @click="nextPage"
          >
            下一页
          </MButton>
          <MButton
            :size="buttonSize"
            :variant="showNote ? 'primary' : 'secondary'"
            @click="showNote = !showNote"
          >
            讲解
          </MButton>
        </div>
      </div>

      <!-- 讲解字幕：极简纯文本行，去除多层卡片边框嵌套 -->
      <div v-if="showNote && noteHtml" class="viewer-subtitle" v-html="noteHtml"></div>
    </div>
  </div>
</template>

<style scoped>
.lecture-viewer-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  font-family: var(--font-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
}

.viewer-frame {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-sm, 4px);
  background-color: var(--bg-surface, #202020);
  overflow: hidden;
}

.lecture-viewer-root.is-fullscreen {
  margin: 0;
  padding: 16px;
  background: #141414;
  height: 100vh;
  width: 100vw;
  box-sizing: border-box;
  border: none;
  border-radius: 0;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.lecture-viewer-root.is-fullscreen .viewer-frame {
  max-width: min(1320px, calc((100vh - 150px) * (1920 / 960)));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: var(--radius-sm, 4px);
  background-color: var(--bg-surface, #202020);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}

/* 顶栏元信息：居于外框内顶部 */
.viewer-meta-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background-color: var(--bg-surface, #202020);
}

.meta-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.meta-page {
  font-size: 12px;
  color: var(--accent-primary, #38bdf8);
  font-weight: 500;
}

.meta-title {
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
  font-weight: 500;
}

.meta-title :deep(.katex) {
  font-size: 1.05em;
  font-weight: normal;
}

.meta-actions {
  display: flex;
  gap: 4px;
}

/* 舞台视口：左右两侧顶格充满整个播放器外边框，无任何水平间隙 */
.stage-viewport {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-left: none;
  border-right: none;
  border-top: none;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 0;
  background-color: #f4eee0;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}

.stage-canvas-box {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  transform-origin: 0 0;
  overflow: hidden;
  background-color: #f4eee0;
  color: #2a2833;
}

.canvas-layer {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
}

.dom-layer {
  position: absolute;
  inset: 0;
}

:deep(.it) {
  position: absolute;
  white-space: nowrap;
  visibility: hidden;
  line-height: 1.25;
  font-family: "LXGW WenKai", "Noto Serif CJK SC", serif;
}

:deep(.it .katex) {
  font-size: 1em;
}

:deep(.mx) {
  display: inline-block;
  margin: 0 0.2em;
}

.pre-layer {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  pointer-events: none;
  font-size: 20px;
  white-space: nowrap;
}

.stage-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 20, 20, 0.85);
  color: #fb7185;
  font-size: 14px;
  padding: 20px;
  text-align: center;
}

/* 控制条：左右对齐，留有适度内边距 */
.viewer-ctrl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
}

.ctrl-step-group,
.ctrl-page-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-dots {
  display: flex;
  gap: 5px;
  align-items: center;
  padding: 0 4px;
}

.step-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  cursor: pointer;
  transition: all 0.14s ease;
}

.step-dots i.done {
  background: #8A6FE8;
  opacity: 0.65;
}

.step-dots i.cur {
  background: #38bdf8;
  transform: scale(1.3);
  opacity: 1;
}

.step-counter {
  min-width: 52px;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary, #cccccc);
}

/* 讲解字幕：自然排版，不套多余边框卡片 */
.viewer-subtitle {
  padding: 2px 14px 14px 14px;
  font-size: 16px;
  line-height: 1.7;
  color: var(--text-primary, #e8e8e8);
  font-family: "LXGW WenKai", "Noto Serif CJK SC", serif;
}

:deep(.viewer-subtitle .cm .katex) {
  font-size: 1.05em;
}

:deep(.viewer-subtitle .old) {
  color: var(--text-muted, #737373);
}

/* 目录列表 */
.toc-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
}

.toc-sec-title {
  margin: 14px 8px 6px;
  font-size: 13px;
  color: var(--accent-primary, #38bdf8);
  font-weight: 600;
}

.toc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--text-secondary, #cccccc);
  transition: all 0.12s ease;
}

.toc-row:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary, #ffffff);
}

.toc-row.is-current {
  background: rgba(0, 122, 204, 0.2);
  color: #38bdf8;
  font-weight: 500;
}

.row-num {
  font-size: 12px;
  color: var(--text-muted, #737373);
  min-width: 20px;
  text-align: right;
}

.row-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 640px) {
  .ctrl-page-group .hide-s {
    display: none;
  }
  .viewer-meta-bar {
    padding: 6px 10px;
  }
  .meta-title {
    max-width: 150px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
  }
  .viewer-ctrl-row {
    padding: 8px 10px;
    gap: 6px;
  }
  .ctrl-step-group {
    gap: 6px;
  }
  .step-counter {
    min-width: 44px;
    font-size: 12px;
  }
  .step-dots {
    display: none;
  }
  .viewer-subtitle {
    padding: 4px 10px 10px 10px;
    font-size: 14px;
    line-height: 1.6;
  }
}
</style>

