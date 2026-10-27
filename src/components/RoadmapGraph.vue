<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import * as d3 from 'd3';
import { fetchCourseTree } from '../api/courses.js';
import { RoadmapWebGLRenderer } from '../utils/roadmap-webgl-renderer.js';
import {
  ZoomIn,
  ZoomOut,
  Expand,
  Play,
  Pause,
  Search,
  Xmark,
  HandCard,
  Lock
} from '@iconoir/vue';

const props = defineProps({
  // 可直接传入已加载的目录树对象：{ id, title, chapters: [...] }
  tree: {
    type: Object,
    default: null
  },
  // 课程 ID
  courseId: {
    type: [String, Number],
    default: ''
  },
  // 初始视图模式：'chapter' (显示课程+章节) 或 'section' (全部显示)
  initialMode: {
    type: String,
    default: 'chapter' // 'chapter' | 'section'
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
// 模式：'chapter'（1级课程 + 2级章节） 或 'section'（全部：1级课程 + 2级章节 + 3级小节）
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
let targetTransform = { k: 1, x: 0, y: 0 };
let isSmoothZooming = false;
let smoothZoomRaf = null;
let webglRenderer = null;
let resizeObserver = null;
let animFrameId = null;
let draggedNode = null;
let mouseDownPos = { x: 0, y: 0 };
let currentSimLinks = [];

// 章节调色板
const CHAPTER_PALETTE = [
  '#3b82f6', // 蓝
  '#10b981', // 翡翠绿
  '#8b5cf6', // 紫
  '#ec4899', // 洋红
  '#06b6d4', // 蔚蓝
  '#f43f5e', // 绯红
  '#14b8a6', // 青
  '#a855f7'  // 紫罗兰
];

// 将课程 tree 直接构建为三级节点与层级关系：1. 课程 -> 2. 章节 -> 3. 小节
const graphData = computed(() => {
  const tree = rawTree.value;
  if (!tree || !tree.id) {
    return { nodes: [], links: [] };
  }

  const nodes = [];
  const links = [];

  // 一级节点：本课程
  const courseNodeId = `course-${tree.id}`;
  nodes.push({
    id: courseNodeId,
    rawId: tree.id,
    title: tree.title || '当前课程',
    tag: '课程',
    level: 1,
    type: 'course',
    color: '#f59e0b',
    radius: 22,
    isOrigin: true
  });

  const chapters = Array.isArray(tree.chapters) ? tree.chapters : [];
  chapters.forEach((ch, chIdx) => {
    const chColor = CHAPTER_PALETTE[chIdx % CHAPTER_PALETTE.length];
    // 二级节点：章节
    const chNodeId = `ch-${ch.id}`;
    nodes.push({
      id: chNodeId,
      rawId: ch.id,
      courseId: tree.id,
      title: ch.title,
      tag: ch.tag || `第${chIdx + 1}章`,
      level: 2,
      type: 'chapter',
      parentId: courseNodeId,
      chapterIndex: chIdx,
      color: chColor,
      radius: 14,
      sectionsCount: ch.sections?.length || 0
    });

    // 连线：课程 -> 章节
    links.push({
      id: `${courseNodeId}->${chNodeId}`,
      sourceId: courseNodeId,
      targetId: chNodeId,
      level: 2,
      type: 'hierarchy'
    });

    // 三级节点：小节
    const sections = Array.isArray(ch.sections) ? ch.sections : [];
    sections.forEach((sec) => {
      const secNodeId = `sec-${sec.id}`;
      nodes.push({
        id: secNodeId,
        rawId: sec.id,
        chapterId: ch.id,
        courseId: tree.id,
        title: sec.title,
        tag: sec.tag,
        level: 3,
        type: 'section',
        parentId: chNodeId,
        chapterIndex: chIdx,
        color: chColor,
        radius: 8
      });

      // 连线：章节 -> 小节
      links.push({
        id: `${chNodeId}->${secNodeId}`,
        sourceId: chNodeId,
        targetId: secNodeId,
        level: 3,
        type: 'hierarchy'
      });
    });
  });

  return { nodes, links };
});

// 选择章节时显示一级节点+二级节点，选择小节时全部显示
const activeGraph = computed(() => {
  const { nodes: allNodes, links: allLinks } = graphData.value;
  const maxLevel = currentMode.value === 'chapter' ? 2 : 3;

  const nodes = allNodes.filter((n) => n.level <= maxLevel);
  const activeIds = new Set(nodes.map((n) => n.id));

  const links = allLinks.filter((l) => {
    return activeIds.has(l.sourceId) && activeIds.has(l.targetId);
  });

  return { nodes, links };
});

// 计算高亮集（用于 WebGL 着色器聚焦）
const highlightState = computed(() => {
  const target = hoveredNode.value;
  if (!target) return null;

  const inSet = new Set();
  const outSet = new Set();

  for (const l of currentSimLinks) {
    const sId = typeof l.source === 'object' ? l.source.id : l.source;
    const tId = typeof l.target === 'object' ? l.target.id : l.target;
    if (sId === target.id) outSet.add(tId);
    if (tId === target.id) inSet.add(sId);
  }

  return {
    targetId: target.id,
    inSet,
    outSet
  };
});

// 加载数据（无兜底）
async function loadTreeData() {
  isLoading.value = true;
  errorMsg.value = '';
  hoveredNode.value = null;

  try {
    if (props.tree) {
      rawTree.value = props.tree;
    } else if (props.courseId) {
      const tree = await fetchCourseTree(props.courseId);
      if (!tree || !tree.id) {
        throw new Error('未获取到有效的课程目录树数据');
      }
      rawTree.value = tree;
    } else {
      throw new Error('缺少课程标识或目录树数据');
    }
  } catch (err) {
    console.error('[RoadmapGraph] 加载目录树失败:', err);
    errorMsg.value = err?.message || '目录树数据加载失败';
    rawTree.value = null;
  } finally {
    isLoading.value = false;
    updateSimulation();
  }
}

// 调整 WebGL 视口尺寸
function resizeCanvas() {
  const container = containerRef.value;
  const canvas = canvasRef.value;
  if (!container || !canvas || !webglRenderer) return;

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
  if (!containerRef.value) return;
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
      const dist = n.level === 1 ? 0 : (n.level === 2 ? 180 : 320);
      n.x = width / 2 + Math.cos(angle) * dist;
      n.y = height / 2 + Math.sin(angle) * dist;
    }
    nodeMap.set(n.id, n);
  });

  // 构建具备 node 实体引用的 links（WebGL 需要直接读取 source.x/target.x）
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
    .force('charge', d3.forceManyBody().strength((d) => {
      if (d.level === 1) return -850;
      if (d.level === 2) return -400;
      return -160;
    }))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius((d) => (d.radius || 12) + 16).strength(0.85))
    .on('tick', () => {
      requestRender();
    });

  if (!isPhysicsRunning.value) {
    simulation.stop();
  }
}

// 触发 WebGL 绘制
function requestRender() {
  if (animFrameId) return;
  animFrameId = requestAnimationFrame(() => {
    animFrameId = null;
    if (!webglRenderer) return;

    const { nodes } = activeGraph.value;
    const needsMoreFrames = webglRenderer.render({
      nodes,
      links: currentSimLinks,
      hl: highlightState.value,
      query: searchQuery.value.trim().toLowerCase(),
      transform: currentTransform
    });

    if (needsMoreFrames) {
      requestRender();
    }
  });
}

// 查找世界坐标 (graphX, graphY) 下的节点
function findNodeAt(graphX, graphY) {
  const { nodes } = activeGraph.value;
  for (let i = nodes.length - 1; i >= 0; --i) {
    const n = nodes[i];
    if (n.x == null || n.y == null) continue;
    const r = (n.radius || 12) + 6;
    const dx = graphX - n.x;
    const dy = graphY - n.y;
    if (dx * dx + dy * dy <= r * r) {
      return n;
    }
  }
  return null;
}

// 平滑滚轮缩放循环
function stopSmoothZoom() {
  if (isSmoothZooming) {
    isSmoothZooming = false;
    if (smoothZoomRaf) cancelAnimationFrame(smoothZoomRaf);
    smoothZoomRaf = null;
  }
}

function smoothZoomLoop() {
  if (!isSmoothZooming) return;

  const curK = currentTransform.k;
  const curX = currentTransform.x;
  const curY = currentTransform.y;

  const ease = 0.22;
  const dk = targetTransform.k - curK;
  const dx = targetTransform.x - curX;
  const dy = targetTransform.y - curY;

  if (Math.abs(dk) < 0.0005 && Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
    currentTransform = d3.zoomIdentity.translate(targetTransform.x, targetTransform.y).scale(targetTransform.k);
    if (canvasRef.value) canvasRef.value.__zoom = currentTransform;
    isSmoothZooming = false;
    smoothZoomRaf = null;
    requestRender();
    return;
  }

  const nextK = curK + dk * ease;
  const nextX = curX + dx * ease;
  const nextY = curY + dy * ease;

  currentTransform = d3.zoomIdentity.translate(nextX, nextY).scale(nextK);
  if (canvasRef.value) canvasRef.value.__zoom = currentTransform;
  requestRender();

  smoothZoomRaf = requestAnimationFrame(smoothZoomLoop);
}

function onCanvasWheel(e) {
  e.preventDefault();
  if (!canvasRef.value) return;

  const [mouseX, mouseY] = d3.pointer(e, canvasRef.value);
  let delta = e.deltaY;
  if (e.deltaMode === 1) delta *= 30;
  else if (e.deltaMode === 2) delta *= 100;

  const zoomFactor = Math.exp(-delta * 0.0018);
  const gx = (mouseX - targetTransform.x) / targetTransform.k;
  const gy = (mouseY - targetTransform.y) / targetTransform.k;

  const nextK = Math.max(0.15, Math.min(6.0, targetTransform.k * zoomFactor));
  targetTransform.k = nextK;
  targetTransform.x = mouseX - gx * nextK;
  targetTransform.y = mouseY - gy * nextK;

  if (!isSmoothZooming) {
    isSmoothZooming = true;
    smoothZoomRaf = requestAnimationFrame(smoothZoomLoop);
  }
}

// 鼠标悬停
function onCanvasMouseMove(e) {
  if (draggedNode || !canvasRef.value) return;
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
    if (canvasRef.value) canvasRef.value.style.cursor = 'grab';
    requestRender();
  }
}

// 节点拖拽与点击
function onCanvasMouseDown(e) {
  if (!canvasRef.value) return;
  mouseDownPos = { x: e.clientX, y: e.clientY };

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
  if (!draggedNode || !canvasRef.value) return;
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
    if (simulation) simulation.alphaTarget(0);
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

    // 1. 点击课程 - 无反应
    if (clicked.level === 1 || clicked.type === 'course') {
      return;
    }

    // 2. 点击章节 - 滚动到页面对应的章节处
    if (clicked.level === 2 || clicked.type === 'chapter') {
      const chapterId = clicked.rawId || clicked.id;
      emit('select-chapter', chapterId);
      emit('select-node', clicked);
      const el = document.getElementById(`chapter-${chapterId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    // 3. 点击小节 - 跳转小节页面
    if (clicked.level === 3 || clicked.type === 'section') {
      emit('select-node', clicked);
      goToSectionDoc(clicked);
      return;
    }
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
  if (!simulation) return;
  if (isPhysicsRunning.value) {
    simulation.alpha(0.3).restart();
  } else {
    simulation.stop();
  }
}

// 切换模式：'chapter' (显示课程+章节) 或 'section' (全部显示)
function setMode(mode) {
  if (currentMode.value === mode) return;
  currentMode.value = mode;
  updateSimulation();
}

// 小节阅读跳转
function goToSectionDoc(node) {
  if (!node) return;
  const secId = node.rawId || node.id;
  const cid = props.courseId || rawTree.value?.id;
  emit('navigate', `/course/${cid}/doc/${secId}`);
  router.push(`/course/${cid}/doc/${secId}`);
}

// 移动端触控点击检测 (零延迟响应)
let touchStartPos = { x: 0, y: 0 };
let touchStartTime = 0;

function onCanvasTouchStart(e) {
  if (!canvasRef.value || !e.touches || e.touches.length !== 1) return;
  touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  touchStartTime = Date.now();
}

function onCanvasTouchEnd(e) {
  if (!canvasRef.value || !e.changedTouches || e.changedTouches.length !== 1) return;
  const touch = e.changedTouches[0];
  const dist = Math.hypot(touch.clientX - touchStartPos.x, touch.clientY - touchStartPos.y);
  const duration = Date.now() - touchStartTime;

  // 短按且位移小于 10px 判定为点击节点
  if (dist < 10 && duration < 380) {
    const [x, y] = d3.pointer(touch, canvasRef.value);
    const [gx, gy] = currentTransform.invert([x, y]);
    const clicked = findNodeAt(gx, gy);
    if (!clicked) return;

    if (clicked.level === 2 || clicked.type === 'chapter') {
      const chapterId = clicked.rawId || clicked.id;
      emit('select-chapter', chapterId);
      emit('select-node', clicked);
      const el = document.getElementById(`chapter-${chapterId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (clicked.level === 3 || clicked.type === 'section') {
      emit('select-node', clicked);
      goToSectionDoc(clicked);
      return;
    }
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

    // 平移缩放行为：点击空白平移，命中节点放行拖拽；移动端单指默认放行滚动，开启手势后才拦截
    zoomBehavior = d3
      .zoom()
      .scaleExtent([0.15, 6])
      .filter((event) => {
        if (event.type === 'touchstart' || event.type === 'touchmove') {
          return Boolean(isTouchPanActive.value);
        }
        if (event.type === 'mousedown') {
          if (!canvasRef.value) return true;
          const [x, y] = d3.pointer(event, canvasRef.value);
          const [gx, gy] = currentTransform.invert([x, y]);
          if (findNodeAt(gx, gy) != null) return false; // 命中节点交给拖拽
        }
        if (event.type === 'wheel') return false; // 使用定制平滑滚轮
        return !event.ctrlKey && !event.button;
      })
      .on('start', () => {
        stopSmoothZoom();
        if (canvasRef.value && !draggedNode) canvasRef.value.style.cursor = 'grabbing';
      })
      .on('zoom', (event) => {
        currentTransform = event.transform;
        targetTransform.k = event.transform.k;
        targetTransform.x = event.transform.x;
        targetTransform.y = event.transform.y;
        requestRender();
      })
      .on('end', () => {
        if (canvasRef.value && !draggedNode) canvasRef.value.style.cursor = 'grab';
      });

    d3.select(canvas).call(zoomBehavior);

    // 绑定平滑滚轮与鼠标拖拽事件
    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: true });
    canvas.addEventListener('touchend', onCanvasTouchEnd, { passive: true });
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
  if (simulation) {
    simulation.stop();
    simulation = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  stopSmoothZoom();
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
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

watch(() => props.courseId, () => {
  loadTreeData();
});

watch(() => props.tree, (newVal) => {
  if (newVal) {
    rawTree.value = newVal;
    updateSimulation();
  }
});
</script>

<template>
  <div ref="containerRef" class="roadmap-graph-container font-mono">
    <!-- 顶部控制栏 -->
    <div v-if="showControls" class="graph-toolbar">
      <!-- 搜索框 -->
      <div class="search-box">
        <Search width="14" height="14" class="search-icon" />
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
          @click="searchQuery = ''; requestRender()"
        >
          <Xmark width="12" height="12" />
        </button>
      </div>

      <!-- 层级切换控件：选择章节时显示一级(课程)+二级(章节)，选择小节时全部显示 -->
      <div class="level-selector">
        <button
          type="button"
          class="level-btn"
          :class="{ active: currentMode === 'chapter' }"
          @click="setMode('chapter')"
        >
          章节
        </button>
        <button
          type="button"
          class="level-btn"
          :class="{ active: currentMode === 'section' }"
          @click="setMode('section')"
        >
          小节
        </button>
      </div>

      <!-- 视图控制 -->
      <div class="view-controls">
        <button type="button" class="tool-btn" title="放大" @click="zoomIn">
          <ZoomIn width="15" height="15" />
        </button>
        <button type="button" class="tool-btn" title="缩小" @click="zoomOut">
          <ZoomOut width="15" height="15" />
        </button>
        <button type="button" class="tool-btn" title="重置视角" @click="resetZoom">
          <Expand width="15" height="15" />
        </button>
        <button
          type="button"
          class="tool-btn"
          :title="isPhysicsRunning ? '暂停物理力学' : '恢复物理力学'"
          @click="togglePhysics"
        >
          <Pause v-if="isPhysicsRunning" width="15" height="15" />
          <Play v-else width="15" height="15" />
        </button>
      </div>
    </div>

    <!-- WebGL 画布 -->
    <canvas ref="canvasRef" class="graph-canvas" />

    <!-- 移动端手势防劫持开关与提示浮标 -->
    <button
      type="button"
      class="touch-pan-pill font-mono"
      :class="{ 'is-active': isTouchPanActive }"
      @click="isTouchPanActive = !isTouchPanActive"
    >
      <component :is="isTouchPanActive ? HandCard : Lock" width="13" height="13" />
      <span>{{ isTouchPanActive ? '手势已开启 (点击锁定)' : '点击开启平移手势' }}</span>
    </button>

    <!-- 加载中 -->
    <div v-if="isLoading" class="graph-overlay">
      <div class="spinner"></div>
      <span>正在构建路线图...</span>
    </div>

    <!-- 错误状态（无兜底） -->
    <div v-else-if="errorMsg" class="graph-overlay error-state">
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
  to { transform: rotate(360deg); }
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
    background-color: rgba(24, 24, 27, 0.88);
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
