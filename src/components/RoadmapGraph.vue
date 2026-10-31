<script setup>
import { Expand, HandCard, Lock, Pause, Play, Search, Xmark, ZoomIn, ZoomOut } from '@iconoir/vue';
import * as d3 from 'd3';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { fetchCourseTree } from '../api/courses.js';
import { lectureLocation, lectureNavigationOrigin } from '../utils/lecture-route.js';
import { buildLectureGraph } from './roadmap/lecture-graph.js';
import { createRenderScheduler } from './roadmap/render-scheduler.js';
import { RoadmapWebGLRenderer } from './roadmap/roadmap-webgl-renderer.js';
import { createSmoothZoom } from './roadmap/smooth-zoom.js';

const props = defineProps({
  // 复用页面已加载的目录树
  tree: {
    type: Object,
    default: null
  },
  // 课程 ID
  lectureId: {
    type: [String, Number],
    default: ''
  },
  source: {
    type: String,
    default: ''
  },
  lectureSlug: {
    type: String,
    default: ''
  },
  revisionId: {
    type: [String, Number],
    default: ''
  },
  // 设置初始展示层级
  initialMode: {
    type: String,
    default: 'chapter'
  },
  // 是否显示控制栏
  showControls: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['select-node', 'select-chapter', 'navigate']);
const router = useRouter();

// 容器与画布引用
const containerRef = ref(null);
const canvasRef = ref(null);

// 状态管理
const isLoading = ref(true);
const errorMsg = ref('');
// 选择章节或小节层级
const currentMode = ref(props.initialMode === 'section' ? 'section' : 'chapter');
const searchQuery = ref('');
const isPhysicsRunning = ref(true);
const hoveredNode = ref(null);
const isTouchPanActive = ref(false);

// 课程 tree 原始数据
const rawTree = ref(null);

// 当前力导向仿真对象与解析后的连线缓存
let simulation = null;
let zoomBehavior = null;
let currentTransform = d3.zoomIdentity;
const targetTransform = {
  k: 1,
  x: 0,
  y: 0
};
let webglRenderer = null;
let resizeObserver = null;
let draggedNode = null;
let mouseDownPos = {
  x: 0,
  y: 0
};
let currentSimLinks = [];
let treeRequest = 0;

const graphData = computed(() => buildLectureGraph(rawTree.value));

const activeGraph = computed(() => {
  const { nodes, links } = graphData.value;
  const visibleNodes = nodes.filter(
    (node) => node.level <= (currentMode.value === 'chapter' ? 2 : 3)
  );
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  return {
    nodes: visibleNodes,
    links: links.filter((link) => visibleIds.has(link.sourceId) && visibleIds.has(link.targetId))
  };
});

// 计算高亮集（用于 WebGL 着色器聚焦）
const highlightState = computed(() => {
  const target = hoveredNode.value;
  if (!target) {
    return null;
  }

  const inSet = new Set();
  const outSet = new Set();

  for (const l of currentSimLinks) {
    const sId = typeof l.source === 'object' ? l.source.id : l.source;
    const tId = typeof l.target === 'object' ? l.target.id : l.target;
    if (sId === target.id) {
      outSet.add(tId);
    }
    if (tId === target.id) {
      inSet.add(sId);
    }
  }

  return {
    targetId: target.id,
    inSet,
    outSet
  };
});

// 加载数据（无兜底）
async function loadTreeData() {
  const requestId = ++treeRequest;
  isLoading.value = true;
  errorMsg.value = '';
  hoveredNode.value = null;

  try {
    let tree;
    if (props.tree) {
      tree = props.tree;
    } else if (props.lectureSlug) {
      tree = await fetchCourseTree(props.lectureSlug, props.revisionId);
      if (!tree || !tree.id) {
        throw new Error('未获取到有效的课程目录树数据');
      }
    } else {
      throw new Error('缺少课程标识或目录树数据');
    }
    if (requestId !== treeRequest) {
      return;
    }
    rawTree.value = tree;
  } catch (err) {
    if (requestId !== treeRequest) {
      return;
    }
    console.error('[RoadmapGraph] 加载目录树失败:', err);
    errorMsg.value = err?.message || '目录树数据加载失败';
    rawTree.value = null;
  } finally {
    if (requestId === treeRequest) {
      isLoading.value = false;
      updateSimulation();
    }
  }
}

// 调整 WebGL 视口尺寸
function resizeCanvas() {
  const container = containerRef.value;
  const canvas = canvasRef.value;
  if (!container || !canvas || !webglRenderer) {
    return;
  }

  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  webglRenderer.resize(rect.width, rect.height, dpr);

  if (simulation) {
    simulation.force('center', d3.forceCenter(rect.width / 2, rect.height / 2));
    simulation.alpha(0.3).restart();
  } else {
    requestRender();
  }
}

// 启动并刷新 D3 力导向物理引擎
function updateSimulation() {
  if (!containerRef.value) {
    return;
  }
  const rect = containerRef.value.getBoundingClientRect();
  const width = rect.width || 800;
  const height = rect.height || 600;

  const { nodes, links } = activeGraph.value;

  if (simulation) {
    simulation.stop();
    simulation = null;
  }

  if (webglRenderer) {
    webglRenderer.buildTextAtlas(nodes);
  }

  if (nodes.length === 0) {
    currentSimLinks = [];
    requestRender();
    return;
  }

  // 为节点分配初始位置（若未存在）
  const nodeMap = new Map();
  nodes.forEach((n, idx) => {
    if (n.x == null || n.y == null) {
      const angle = (idx / nodes.length) * Math.PI * 2;
      const dist = n.level === 1 ? 0 : n.level === 2 ? 180 : 320;
      n.x = width / 2 + Math.cos(angle) * dist;
      n.y = height / 2 + Math.sin(angle) * dist;
    }
    nodeMap.set(n.id, n);
  });

  // 让连线直接引用节点坐标
  currentSimLinks = links
    .map((l) => ({
      ...l,
      source: nodeMap.get(l.sourceId),
      target: nodeMap.get(l.targetId)
    }))
    .filter((l) => l.source && l.target);

  simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(currentSimLinks)
        .id((d) => d.id)
        .distance((d) => (d.level === 2 ? 210 : 135))
        .strength(0.85)
    )
    .force(
      'charge',
      d3.forceManyBody().strength((d) => {
        if (d.level === 1) {
          return -850;
        }
        if (d.level === 2) {
          return -400;
        }
        return -160;
      })
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'collide',
      d3
        .forceCollide()
        .radius((d) => (d.radius || 12) + 16)
        .strength(0.85)
    )
    .on('tick', () => {
      requestRender();
    });

  if (!isPhysicsRunning.value) {
    simulation.stop();
  }
}

const { requestRender, cancelRender } = createRenderScheduler(() => {
  if (!webglRenderer) {
    return false;
  }
  return webglRenderer.render({
    nodes: activeGraph.value.nodes,
    links: currentSimLinks,
    hl: highlightState.value,
    query: searchQuery.value.trim().toLowerCase(),
    transform: currentTransform
  });
});

// 查找世界坐标 (graphX, graphY) 下的节点
function findNodeAt(graphX, graphY) {
  const { nodes } = activeGraph.value;
  for (let i = nodes.length - 1; i >= 0; --i) {
    const n = nodes[i];
    if (n.x == null || n.y == null) {
      continue;
    }
    const r = (n.radius || 12) + 6;
    const dx = graphX - n.x;
    const dy = graphY - n.y;
    if (dx * dx + dy * dy <= r * r) {
      return n;
    }
  }
  return null;
}

const { stop: stopSmoothZoom, onWheel: onCanvasWheel } = createSmoothZoom({
  canvas: () => canvasRef.value,
  getTransform: () => currentTransform,
  setTransform: (transform) => {
    currentTransform = transform;
  },
  target: targetTransform,
  render: requestRender
});

// 鼠标悬停
function onCanvasMouseMove(e) {
  if (draggedNode || !canvasRef.value) {
    return;
  }
  const [x, y] = d3.pointer(e, canvasRef.value);
  const [gx, gy] = currentTransform.invert([x, y]);
  const hovered = findNodeAt(gx, gy);

  if (hovered !== hoveredNode.value) {
    hoveredNode.value = hovered;
    canvasRef.value.style.cursor = hovered ? 'pointer' : 'grab';
    requestRender();
  }
}

function onCanvasMouseLeave() {
  if (hoveredNode.value) {
    hoveredNode.value = null;
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'grab';
    }
    requestRender();
  }
}

// 节点拖拽与点击
function onCanvasMouseDown(e) {
  if (!canvasRef.value) {
    return;
  }
  mouseDownPos = {
    x: e.clientX,
    y: e.clientY
  };

  const [x, y] = d3.pointer(e, canvasRef.value);
  const [gx, gy] = currentTransform.invert([x, y]);
  const target = findNodeAt(gx, gy);

  if (target) {
    draggedNode = target;
    if (simulation) {
      simulation.alphaTarget(0.2).restart();
      isPhysicsRunning.value = true;
    }
    draggedNode.fx = target.x;
    draggedNode.fy = target.y;

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  }
}

function onWindowMouseMove(e) {
  if (!draggedNode || !canvasRef.value) {
    return;
  }
  const [x, y] = d3.pointer(e, canvasRef.value);
  const [gx, gy] = currentTransform.invert([x, y]);
  draggedNode.fx = gx;
  draggedNode.fy = gy;
  requestRender();
}

function onWindowMouseUp(e) {
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseup', onWindowMouseUp);

  if (draggedNode) {
    if (simulation) {
      simulation.alphaTarget(0);
    }
    draggedNode.fx = null;
    draggedNode.fy = null;
    draggedNode = null;
    requestRender();
  }

  // 判定是否为单纯点击
  const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
  if (dist < 5 && canvasRef.value) {
    const [x, y] = d3.pointer(e, canvasRef.value);
    const [gx, gy] = currentTransform.invert([x, y]);
    const clicked = findNodeAt(gx, gy);
    if (!clicked) {
      return;
    }

    activateNode(clicked);
  }
}

function activateNode(node) {
  if (node.level === 2 || node.type === 'chapter') {
    const chapterId = node.rawId || node.id;
    emit('select-chapter', chapterId);
    emit('select-node', node);
    document.getElementById(`chapter-${chapterId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  } else if (node.level === 3 || node.type === 'section') {
    emit('select-node', node);
    goToSectionDoc(node);
  }
}

// 缩放控制按钮
function zoomIn() {
  stopSmoothZoom();
  if (canvasRef.value && zoomBehavior) {
    d3.select(canvasRef.value).transition().duration(250).call(zoomBehavior.scaleBy, 1.35);
  }
}

function zoomOut() {
  stopSmoothZoom();
  if (canvasRef.value && zoomBehavior) {
    d3.select(canvasRef.value).transition().duration(250).call(zoomBehavior.scaleBy, 0.75);
  }
}

function resetZoom() {
  stopSmoothZoom();
  if (canvasRef.value && zoomBehavior) {
    d3.select(canvasRef.value)
      .transition()
      .duration(350)
      .call(zoomBehavior.transform, d3.zoomIdentity);
  }
}

// 仿真启停
function togglePhysics() {
  isPhysicsRunning.value = !isPhysicsRunning.value;
  if (!simulation) {
    return;
  }
  if (isPhysicsRunning.value) {
    simulation.alpha(0.3).restart();
  } else {
    simulation.stop();
  }
}

// 切换展示层级
function setMode(mode) {
  if (currentMode.value === mode) {
    return;
  }
  currentMode.value = mode;
  updateSimulation();
}

// 小节阅读跳转
function goToSectionDoc(node) {
  if (!node) {
    return;
  }
  const chapter = rawTree.value?.chapters?.find(
    (item) => String(item.id) === String(node.chapterId)
  );
  const section = chapter?.sections?.find(
    (item) => String(item.id) === String(node.rawId || node.id)
  );
  if (!chapter || !section) {
    return;
  }
  const target = lectureLocation({
    source: props.source,
    slug: props.lectureSlug,
    chapterSlug: chapter.slug,
    sectionSlug: section.slug,
    revisionId: props.revisionId,
    origin: lectureNavigationOrigin()
  });
  emit('navigate', router.resolve(target).href);
  router.push(target);
}

// 移动端触控点击检测 (零延迟响应)
let touchStartPos = {
  x: 0,
  y: 0
};
let touchStartTime = 0;

function onCanvasTouchStart(e) {
  if (!canvasRef.value || !e.touches || e.touches.length !== 1) {
    return;
  }
  touchStartPos = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY
  };
  touchStartTime = Date.now();
}

function onCanvasTouchEnd(e) {
  if (!canvasRef.value || !e.changedTouches || e.changedTouches.length !== 1) {
    return;
  }
  const touch = e.changedTouches[0];
  const dist = Math.hypot(touch.clientX - touchStartPos.x, touch.clientY - touchStartPos.y);
  const duration = Date.now() - touchStartTime;

  // 短按且位移小于 10px 判定为点击节点
  if (dist < 10 && duration < 380) {
    const [x, y] = d3.pointer(touch, canvasRef.value);
    const [gx, gy] = currentTransform.invert([x, y]);
    const clicked = findNodeAt(gx, gy);
    if (!clicked) {
      return;
    }

    activateNode(clicked);
  }
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (canvas) {
    try {
      webglRenderer = new RoadmapWebGLRenderer(canvas);
    } catch (err) {
      console.error('[RoadmapGraph] WebGL 初始化失败:', err);
      errorMsg.value = '浏览器不支持 WebGL 硬件加速渲染';
    }

    targetTransform.x = currentTransform.x;
    targetTransform.y = currentTransform.y;
    targetTransform.k = currentTransform.k;

    // 分离画布平移、节点拖拽和移动端滚动
    zoomBehavior = d3
      .zoom()
      .scaleExtent([0.15, 6])
      .filter((event) => {
        if (event.type === 'touchstart' || event.type === 'touchmove') {
          return Boolean(isTouchPanActive.value);
        }
        if (event.type === 'mousedown') {
          if (!canvasRef.value) {
            return true;
          }
          const [x, y] = d3.pointer(event, canvasRef.value);
          const [gx, gy] = currentTransform.invert([x, y]);
          if (findNodeAt(gx, gy) != null) {
            return false;
          } // 命中节点交给拖拽
        }
        if (event.type === 'wheel') {
          return false;
        } // 使用定制平滑滚轮
        return !event.ctrlKey && !event.button;
      })
      .on('start', () => {
        stopSmoothZoom();
        if (canvasRef.value && !draggedNode) {
          canvasRef.value.style.cursor = 'grabbing';
        }
      })
      .on('zoom', (event) => {
        currentTransform = event.transform;
        targetTransform.k = event.transform.k;
        targetTransform.x = event.transform.x;
        targetTransform.y = event.transform.y;
        requestRender();
      })
      .on('end', () => {
        if (canvasRef.value && !draggedNode) {
          canvasRef.value.style.cursor = 'grab';
        }
      });

    d3.select(canvas).call(zoomBehavior);

    // 绑定平滑滚轮与鼠标拖拽事件
    canvas.addEventListener('wheel', onCanvasWheel, {
      passive: false
    });
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    canvas.addEventListener('touchstart', onCanvasTouchStart, {
      passive: true
    });
    canvas.addEventListener('touchend', onCanvasTouchEnd, {
      passive: true
    });
  }

  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(containerRef.value);
  }

  loadTreeData();
});

onBeforeUnmount(() => {
  treeRequest++;
  if (simulation) {
    simulation.stop();
    simulation = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  stopSmoothZoom();
  cancelRender();
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('wheel', onCanvasWheel);
    canvasRef.value.removeEventListener('mousedown', onCanvasMouseDown);
    canvasRef.value.removeEventListener('mousemove', onCanvasMouseMove);
    canvasRef.value.removeEventListener('mouseleave', onCanvasMouseLeave);
    canvasRef.value.removeEventListener('touchstart', onCanvasTouchStart);
    canvasRef.value.removeEventListener('touchend', onCanvasTouchEnd);
  }
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseup', onWindowMouseUp);
  if (webglRenderer) {
    webglRenderer.destroy();
    webglRenderer = null;
  }
});

watch(() => [props.tree, props.lectureId, props.lectureSlug, props.revisionId], loadTreeData);
</script>

<template>
  <div
    ref="containerRef"
    class="roadmap-graph-container font-mono"
  >
    <!-- 顶部控制栏 -->
    <div
      v-if="showControls"
      class="graph-toolbar"
    >
      <!-- 搜索框 -->
      <div class="search-box">
        <Search
          width="14"
          height="14"
          class="search-icon"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="检索节点..."
          class="search-input"
          @input="requestRender"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="clear-btn"
          @click="
            searchQuery = '';
            requestRender();
          "
        >
          <Xmark
            width="12"
            height="12"
          />
        </button>
      </div>

      <!-- 切换章节和小节层级 -->
      <div class="level-selector">
        <button
          type="button"
          class="level-btn"
          :class="{
            active: currentMode === 'chapter'
          }"
          @click="setMode('chapter')"
        >
          章节
        </button>
        <button
          type="button"
          class="level-btn"
          :class="{
            active: currentMode === 'section'
          }"
          @click="setMode('section')"
        >
          小节
        </button>
      </div>

      <!-- 视图控制 -->
      <div class="view-controls">
        <button
          type="button"
          class="tool-btn"
          title="放大"
          @click="zoomIn"
        >
          <ZoomIn
            width="15"
            height="15"
          />
        </button>
        <button
          type="button"
          class="tool-btn"
          title="缩小"
          @click="zoomOut"
        >
          <ZoomOut
            width="15"
            height="15"
          />
        </button>
        <button
          type="button"
          class="tool-btn"
          title="重置视角"
          @click="resetZoom"
        >
          <Expand
            width="15"
            height="15"
          />
        </button>
        <button
          type="button"
          class="tool-btn"
          :title="isPhysicsRunning ? '暂停物理力学' : '恢复物理力学'"
          @click="togglePhysics"
        >
          <Pause
            v-if="isPhysicsRunning"
            width="15"
            height="15"
          />
          <Play
            v-else
            width="15"
            height="15"
          />
        </button>
      </div>
    </div>

    <!-- WebGL 画布 -->
    <canvas
      ref="canvasRef"
      class="graph-canvas"
    />

    <!-- 移动端手势防劫持开关与提示浮标 -->
    <button
      type="button"
      class="touch-pan-pill font-mono"
      :class="{
        'is-active': isTouchPanActive
      }"
      @click="isTouchPanActive = !isTouchPanActive"
    >
      <component
        :is="isTouchPanActive ? HandCard : Lock"
        width="13"
        height="13"
      />
      <span>{{ isTouchPanActive ? '手势已开启 (点击锁定)' : '点击开启平移手势' }}</span>
    </button>

    <!-- 加载中 -->
    <div
      v-if="isLoading"
      class="graph-overlay"
    >
      <div class="spinner"></div>
      <span>正在构建路线图...</span>
    </div>

    <!-- 错误状态（无兜底） -->
    <div
      v-else-if="errorMsg"
      class="graph-overlay error-state"
    >
      <span class="error-title">无法加载路线图</span>
      <span class="error-desc">{{ errorMsg }}</span>
    </div>
  </div>
</template>

<style scoped>
.roadmap-graph-container {
  position: relative;
  width: 100%;
  height: 580px;
  background-color: var(--bg-app, #121212);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-sm, 6px);
  overflow: hidden;
  user-select: none;
}

.graph-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

/* 控制栏 */
.graph-toolbar {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
  z-index: 5;
}

.graph-toolbar > * {
  pointer-events: auto;
}

/* 搜索框 */
.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  background-color: var(--bg-surface, #1e1e1e);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 4px);
  padding: 0 10px;
  width: 180px;
}

.search-icon {
  color: var(--text-muted, #737373);
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary, #ffffff);
  font-size: 11px;
  width: 100%;
}

.search-input::placeholder {
  color: var(--text-muted, #666666);
}

.clear-btn {
  background: transparent;
  border: none;
  color: var(--text-muted, #888888);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
}

/* 层级切换 */
.level-selector {
  display: flex;
  align-items: center;
  height: 32px;
  background-color: var(--bg-surface, #1e1e1e);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 4px);
  padding: 3px;
  gap: 3px;
}

.level-btn {
  height: 100%;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted, #888888);
  font-size: 11px;
  padding: 0 14px;
  border-radius: var(--radius-xs, 3px);
  cursor: pointer;
  transition: all 120ms ease;
  white-space: nowrap;
}

.level-btn:hover {
  color: var(--text-primary, #ffffff);
  background-color: var(--bg-hover, rgba(255, 255, 255, 0.05));
}

.level-btn.active {
  background-color: var(--bg-elevated, #282828);
  border-color: var(--border-subtle, rgba(255, 255, 255, 0.15));
  color: var(--text-primary, #ffffff);
  font-weight: 600;
}

/* 按钮组 */
.view-controls {
  display: flex;
  align-items: center;
  height: 32px;
  background-color: var(--bg-surface, #1e1e1e);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm, 4px);
  padding: 2px 4px;
  gap: 2px;
}

.tool-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted, #888888);
  border-radius: var(--radius-xs, 3px);
  cursor: pointer;
  transition: all 120ms ease;
}

.tool-btn:hover {
  color: var(--text-primary, #ffffff);
  background-color: var(--bg-hover, rgba(255, 255, 255, 0.08));
}

/* 遮罩与状态 */
.graph-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(18, 18, 18, 0.85);
  color: var(--text-muted, #888888);
  font-size: 12px;
  gap: 10px;
  z-index: 8;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-top-color: var(--accent-primary, #f59e0b);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  color: #ef4444;
}

.error-title {
  font-weight: 600;
  font-size: 13px;
}

.error-desc {
  color: var(--text-muted, #888888);
  font-size: 11px;
}

.touch-pan-pill {
  display: none;
}

@media (max-width: 768px) {
  .roadmap-graph-container {
    height: 360px;
  }

  .graph-toolbar {
    top: 8px;
    left: 8px;
    right: 8px;
    gap: 6px;
  }

  .search-box {
    display: none;
  }

  .level-btn {
    padding: 0 10px;
    font-size: 11px;
  }

  .view-controls {
    gap: 1px;
    padding: 2px;
  }

  .tool-btn {
    width: 28px;
    height: 28px;
  }

  /* 移动端手势防劫持浮标 */
  .touch-pan-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    position: absolute;
    bottom: 10px;
    right: 10px;
    z-index: 10;
    padding: 6px 12px;
    border-radius: var(--radius-full, 9999px);
    background-color: var(--bg-surface);
    background-color: color-mix(in srgb, var(--bg-surface) 88%, transparent);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
    color: var(--text-secondary, #a1a1aa);
    font-size: 11.5px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    transition: all 140ms ease;
  }

  .touch-pan-pill.is-active {
    background-color: var(--accent-primary, #38bdf8);
    color: #09090b;
    font-weight: 600;
    border-color: var(--accent-primary, #38bdf8);
  }
}
</style>
