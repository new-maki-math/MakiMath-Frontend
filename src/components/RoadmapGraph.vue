<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import * as d3 from 'd3';
import { fetchCourseGraph } from '../api/courses.js';
import {
  buildGraphFromCourseBundle,
  NODE_TYPE_LABELS
} from '../utils/roadmap-generator.js';
import { RoadmapWebGLRenderer } from '../utils/roadmap-webgl-renderer.js';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Expand,
  NavArrowRight
} from '@iconoir/vue';

const props = defineProps({
  // 外部直接传入的自定义拓扑数据 { nodes: [], links: [] }
  data: {
    type: Object,
    default: null
  },
  // 课程 ID：若未传入 data 则自动从服务端动态拉取该课程的关系图谱
  courseId: {
    type: String,
    default: 'kaoyan'
  },
  // 初始层级深度：1 (大编拓扑), 2 (讲次网络, 默认), 3 (全知识节点)
  initialLevel: {
    type: Number,
    default: 1
  },
  // 是否显示交互式悬浮工具栏
  showControls: {
    type: Boolean,
    default: true
  },
  // 是否显示实时搜索过滤框
  showSearch: {
    type: Boolean,
    default: true
  },
  // 是否在点击节点时弹出详情抽屉
  showDetails: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['select-node', 'navigate']);
const router = useRouter();

const containerRef = ref(null);
const canvasRef = ref(null);

const isLoading = ref(true);
const currentLevel = ref(props.initialLevel);
const searchQuery = ref('');
const isPhysicsRunning = ref(true);
const selectedNode = ref(null);
const hoveredNode = ref(null);

// 原始全量图数据与当前过滤渲染数据
const rawGraphData = ref({ nodes: [], links: [], chapters: [] });
let simulation = null;
let zoomBehavior = null;
let webglRenderer = null;
let dragBehavior = null;
let currentTransform = d3.zoomIdentity;
let targetTransform = { k: 1, x: 0, y: 0 };
let isSmoothZooming = false;
let smoothZoomRaf = null;
let resizeObserver = null;
let renderRequested = false;
let draggedNode = null;
let mouseDownPos = { x: 0, y: 0 };

// 尺寸管理
const dimensions = ref({ width: 800, height: 600 });

// 筛选后的节点与连线数据
const filteredGraph = computed(() => {
  const allNodes = rawGraphData.value.nodes || [];
  const allLinks = rawGraphData.value.links || [];

  // 1. 根据层级深度过滤节点
  const activeNodes = allNodes.filter(n => n.level <= currentLevel.value);
  const activeNodeIds = new Set(activeNodes.map(n => n.id));

  // 2. 根据可用节点过滤连线
  const activeLinks = allLinks.filter(l => {
    const sId = typeof l.source === 'object' ? l.source.id : l.source;
    const tId = typeof l.target === 'object' ? l.target.id : l.target;
    return activeNodeIds.has(sId) && activeNodeIds.has(tId);
  });

  return {
    nodes: activeNodes.map(n => ({ ...n })),
    links: activeLinks.map(l => ({ ...l }))
  };
});

// 计算当前高亮节点集合（悬浮或选中节点的直连邻居）
const highlightedNeighbors = computed(() => {
  const target = hoveredNode.value || selectedNode.value;
  if (!target) return null;

  const targetId = target.id;
  const inSet = new Set();
  const outSet = new Set();

  filteredGraph.value.links.forEach(l => {
    const sId = typeof l.source === 'object' ? l.source.id : l.source;
    const tId = typeof l.target === 'object' ? l.target.id : l.target;

    if (sId === targetId) {
      outSet.add(tId);
    }
    if (tId === targetId) {
      inSet.add(sId);
    }
  });

  return { targetId, inSet, outSet };
});

// 节流的 Canvas 渲染调度，确保 60FPS 丝滑不掉帧
const requestRender = () => {
  if (!renderRequested) {
    renderRequested = true;
    requestAnimationFrame(() => {
      renderRequested = false;
      renderCanvas();
    });
  }
};

// 在给定坐标下检索节点
const findNodeAt = (graphX, graphY) => {
  const nodes = filteredGraph.value.nodes;
  for (let i = nodes.length - 1; i >= 0; --i) {
    const n = nodes[i];
    if (n.x == null || n.y == null) continue;
    const dx = graphX - n.x;
    const dy = graphY - n.y;
    const hitRadius = (n.radius || 12) + 6;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return n;
    }
  }
  return null;
};

// WebGL2 核心图谱绘制函数 (0 DOM 负担，GPU 硬件管线加速渲染连线、节点与文字)
const renderCanvas = () => {
  if (!webglRenderer) return;

  const { nodes, links } = filteredGraph.value;
  const hl = highlightedNeighbors.value;
  const query = searchQuery.value.trim().toLowerCase();

  const needsMoreFrames = webglRenderer.render({
    nodes,
    links,
    hl,
    query,
    transform: currentTransform
  });

  if (needsMoreFrames) {
    requestRender();
  }
};

// 加载课程或使用传入的数据源
const loadData = async () => {
  isLoading.value = true;
  try {
    if (props.data && Array.isArray(props.data.nodes)) {
      rawGraphData.value = props.data;
    } else {
      const bundle = await fetchCourseGraph(props.courseId);
      rawGraphData.value = buildGraphFromCourseBundle(bundle);
    }
    nextTick(() => {
      initCanvasAndD3();
    });
  } catch (err) {
    console.error('[RoadmapGraph] 数据解析失败:', err);
  } finally {
    isLoading.value = false;
  }
};

// 停止正在进行的平滑缩放动画
const stopSmoothZoom = () => {
  if (isSmoothZooming) {
    isSmoothZooming = false;
    if (smoothZoomRaf) cancelAnimationFrame(smoothZoomRaf);
    smoothZoomRaf = null;
  }
};

// 无极平滑惯性滚轮缩放核心算法 (亚像素级连续 Lerp 插值，消除所有机械滚轮离散阶梯顿挫感)
const onCanvasWheel = (e) => {
  e.preventDefault();
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // 标准化不同设备滚轮步长 (像素/行/页模式)
  let delta = e.deltaY;
  if (e.deltaMode === 1) delta *= 24;
  else if (e.deltaMode === 2) delta *= 100;

  // 极柔和对数阻尼缩放系数
  const zoomFactor = Math.exp(-delta * 0.0018);

  // 以当前目标状态计算鼠标光标所在的世界坐标 (gx, gy)，确保多次滚轮快速滚动时光标下的锚点严格恒定不漂移
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
};

const smoothZoomLoop = () => {
  if (!isSmoothZooming) return;

  const curK = currentTransform.k;
  const curX = currentTransform.x;
  const curY = currentTransform.y;

  const dk = targetTransform.k - curK;
  const dx = targetTransform.x - curX;
  const dy = targetTransform.y - curY;

  // 收敛停止阈值：微小差异时精准归位并停止 RAF 循环
  if (Math.abs(dk) < 0.0005 && Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
    currentTransform = d3.zoomIdentity.translate(targetTransform.x, targetTransform.y).scale(targetTransform.k);
    if (canvasRef.value) {
      canvasRef.value.__zoom = currentTransform;
    }
    isSmoothZooming = false;
    smoothZoomRaf = null;
    requestRender();
    return;
  }

  // 指数平滑插值 (Lerp)：每帧按 16% 平缓趋近目标，呈现丝滑无级缩放
  const ease = 0.16;
  const nextK = curK + dk * ease;
  const nextX = curX + dx * ease;
  const nextY = curY + dy * ease;

  currentTransform = d3.zoomIdentity.translate(nextX, nextY).scale(nextK);
  if (canvasRef.value) {
    canvasRef.value.__zoom = currentTransform;
  }
  requestRender();

  smoothZoomRaf = requestAnimationFrame(smoothZoomLoop);
};

// 初始化 HTML5 Canvas 与 D3 力导向仿真 + 交互系统
const initCanvasAndD3 = () => {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const rect = container.getBoundingClientRect();
  const width = Math.round(rect.width) || 800;
  const height = Math.round(rect.height) || 600;
  dimensions.value = { width, height };

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // 初始化或调整 WebGL 渲染管线
  if (!webglRenderer) {
    webglRenderer = new RoadmapWebGLRenderer(canvas);
  }
  webglRenderer.resize(width, height, dpr);
  if (rawGraphData.value.nodes && rawGraphData.value.nodes.length > 0) {
    webglRenderer.buildTextAtlas(rawGraphData.value.nodes);
  }

  // 停止旧仿真
  if (simulation) simulation.stop();

  const { nodes, links } = filteredGraph.value;

  // 1. 力导向物理引擎配置 (重点优化小层级碰撞半径与排斥力，彻底消除标签文字挤压重叠)
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
      if (d.type === 'prereq') return 180;
      if (d.type === 'cluster') return 110;
      if (d.type === 'sequence') return 75;
      return 50;
    }).strength(d => {
      if (d.type === 'prereq') return 0.6;
      if (d.type === 'cluster') return 0.35;
      if (d.type === 'sequence') return 0.55;
      return 0.3;
    }))
    .force('charge', d3.forceManyBody().strength(d => {
      if (d.level === 1) return -550; // 一级大编强力撑开核心骨干
      if (d.level === 2) return -240; // 二级讲次大幅增强点间互斥力，彻底散开小球
      return -70;                    // 三级微观知识节点
    }))
    .force('collide', d3.forceCollide().radius(d => {
      // 动态分层有效碰撞半径：圆圈半径 + 预留横向文字宽度的安全保护圈
      if (d.level === 1) return (d.radius || 22) + 28; // ~50px 半径，两个大编节点保持 100px 安全隔离带
      if (d.level === 2) return (d.radius || 12) + 24; // ~36px 半径，相邻讲次保持 72px 宽度，充分容纳标题
      return (d.radius || 6) + 12;                     // ~18px 半径，微观节点防贴合
    }).iterations(2))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .alphaDecay(0.05);

  // 2. 内存预热 50 次，使新物理排斥力在挂载前直接计算归位
  for (let i = 0; i < 50; ++i) {
    simulation.tick();
  }

  // 每帧刷新坐标并触发 Canvas 重绘
  simulation.on('tick', () => {
    requestRender();
  });

  // 3. 缩放与画布平移漫游系统 (D3 Zoom 处理画布拖拽，平滑惯性系统接管滚轮缩放)
  targetTransform.k = currentTransform.k;
  targetTransform.x = currentTransform.x;
  targetTransform.y = currentTransform.y;

  zoomBehavior = d3.zoom()
    .scaleExtent([0.15, 6])
    .filter((event) => {
      // 鼠标按下时如果命中节点，放行给节点拖拽逻辑，不启动画布拖动
      if (event.type === 'mousedown') {
        if (!canvasRef.value) return true;
        const [x, y] = d3.pointer(event, canvasRef.value);
        const [gx, gy] = currentTransform.invert([x, y]);
        if (findNodeAt(gx, gy) != null) return false;
      }
      // 屏蔽 D3 原生阶梯滚轮，由自定义平滑惯性无极缩放接管
      if (event.type === 'wheel') return false;
      return !event.ctrlKey && !event.button;
    })
    .on('start', () => {
      stopSmoothZoom();
      if (canvasRef.value && !draggedNode) canvasRef.value.classList.add('is-grabbing');
    })
    .on('zoom', (event) => {
      currentTransform = event.transform;
      targetTransform.k = event.transform.k;
      targetTransform.x = event.transform.x;
      targetTransform.y = event.transform.y;
      requestRender();
    })
    .on('end', () => {
      if (canvasRef.value) canvasRef.value.classList.remove('is-grabbing');
    });

  d3.select(canvas).call(zoomBehavior);

  // 绑定原生非 passive 滚轮事件监听器，提供亚像素级无极连续缩放
  canvas.removeEventListener('wheel', onCanvasWheel);
  canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

  requestRender();
};

// 4. 节点拖拽与点击交互系统
const onCanvasMouseDown = (e) => {
  mouseDownPos = { x: e.clientX, y: e.clientY };
  if (!canvasRef.value) return;
  const [x, y] = d3.pointer(e, canvasRef.value);
  const [gx, gy] = currentTransform.invert([x, y]);
  const target = findNodeAt(gx, gy);

  if (target) {
    // 命中节点，开始节点拖拽并持续保持物理活跃
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
};

const onWindowMouseMove = (e) => {
  if (!draggedNode || !canvasRef.value) return;
  const [x, y] = d3.pointer(e, canvasRef.value);
  const [gx, gy] = currentTransform.invert([x, y]);
  draggedNode.fx = gx;
  draggedNode.fy = gy;
  requestRender();
};

const onWindowMouseUp = (e) => {
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseup', onWindowMouseUp);

  if (draggedNode) {
    if (simulation) simulation.alphaTarget(0);
    draggedNode.fx = null;
    draggedNode.fy = null;
    draggedNode = null;
    requestRender();
  }
};

const onCanvasClick = (e) => {
  // 如果鼠标位移小于 5 像素，判定为真实点击
  if (Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y) < 5) {
    if (!canvasRef.value) return;
    const [x, y] = d3.pointer(e, canvasRef.value);
    const [gx, gy] = currentTransform.invert([x, y]);
    const clicked = findNodeAt(gx, gy);

    selectedNode.value = clicked;
    emit('select-node', clicked);
    requestRender();
  }
};

const onCanvasMouseMove = (e) => {
  if (draggedNode || !canvasRef.value) return;
  const [x, y] = d3.pointer(e, canvasRef.value);
  const [gx, gy] = currentTransform.invert([x, y]);
  const hovered = findNodeAt(gx, gy);

  if (hovered !== hoveredNode.value) {
    hoveredNode.value = hovered;
    canvasRef.value.style.cursor = hovered ? 'pointer' : 'grab';
    requestRender();
  }
};

const onCanvasMouseLeave = () => {
  if (hoveredNode.value) {
    hoveredNode.value = null;
    if (canvasRef.value) canvasRef.value.style.cursor = 'grab';
    requestRender();
  }
};

// 交互操作工具方法
const handleZoomIn = () => {
  stopSmoothZoom();
  if (canvasRef.value && zoomBehavior) {
    d3.select(canvasRef.value).transition().duration(260).call(zoomBehavior.scaleBy, 1.35);
  }
};

const handleZoomOut = () => {
  stopSmoothZoom();
  if (canvasRef.value && zoomBehavior) {
    d3.select(canvasRef.value).transition().duration(260).call(zoomBehavior.scaleBy, 0.75);
  }
};

const handleResetView = () => {
  stopSmoothZoom();
  if (canvasRef.value && zoomBehavior) {
    d3.select(canvasRef.value).transition().duration(380).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(0, 0).scale(1)
    );
  }
};

const togglePhysics = () => {
  isPhysicsRunning.value = !isPhysicsRunning.value;
  if (!simulation) return;
  if (isPhysicsRunning.value) {
    simulation.alpha(0.3).restart();
  } else {
    simulation.stop();
  }
};

// 聚焦到指定节点
const focusNode = (nodeId) => {
  stopSmoothZoom();
  const target = filteredGraph.value.nodes.find(n => n.id === nodeId);
  if (!target || !canvasRef.value || !zoomBehavior) return;

  selectedNode.value = target;
  const { width, height } = dimensions.value;
  const scale = target.level === 1 ? 1.8 : 2.8;
  const x = width / 2 - target.x * scale;
  const y = height / 2 - target.y * scale;

  d3.select(canvasRef.value).transition().duration(450).call(
    zoomBehavior.transform,
    d3.zoomIdentity.translate(x, y).scale(scale)
  );

  requestRender();
};

// 跳转到该小节/讲次的阅读页
const navigateToLecture = (node) => {
  let course = props.courseId || 'kaoyan';
  let section = node.id;

  if (node.level === 3 && node.parentId) {
    section = node.parentId;
  }

  const path = `/course/${course}/doc/${section}`;
  emit('navigate', { path, node });
  router.push(path);
};

// 响应容器尺寸变化
const handleResize = () => {
  if (!containerRef.value || !canvasRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  if (width > 0 && height > 0) {
    dimensions.value = { width, height };
    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.value;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (webglRenderer) {
      webglRenderer.resize(width, height, dpr);
    }

    if (simulation) {
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
      simulation.alpha(0.15).restart();
    }
    requestRender();
  }
};

// 监听层级切换，重新渲染
watch(currentLevel, () => {
  selectedNode.value = null;
  hoveredNode.value = null;
  initCanvasAndD3();
});

// 监听搜索词变化
watch(searchQuery, () => {
  requestRender();
});

// 监听 props 变化
watch(
  () => [props.courseId, props.data],
  () => {
    loadData();
  }
);

onMounted(() => {
  loadData();

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  if (simulation) simulation.stop();
  if (resizeObserver) resizeObserver.disconnect();
  stopSmoothZoom();
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('wheel', onCanvasWheel);
  }
  if (webglRenderer) {
    webglRenderer.destroy();
    webglRenderer = null;
  }
});
</script>

<template>
  <div ref="containerRef" class="roadmap-graph-container" aria-label="知识图谱路线图">
    <!-- WebGL2 核心硬件加速画布 (几何拓扑连线、箭头、SDF 亚像素抗锯齿圆球) -->
    <canvas
      ref="canvasRef"
      class="graph-canvas"
      @mousedown="onCanvasMouseDown"
      @click="onCanvasClick"
      @mousemove="onCanvasMouseMove"
      @mouseleave="onCanvasMouseLeave"
    ></canvas>

    <!-- 顶部状态指示与工具栏 (Obsidian 极简风格浮层) -->
    <div v-if="showControls" class="graph-floating-panel top-panel">
      <!-- 实时搜索输入框 -->
      <div v-if="showSearch" class="search-input-wrap">
        <Search width="14" height="14" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          class="graph-search-input font-mono"
          placeholder="搜索节点或真题..."
        />
        <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">×</button>
      </div>

      <!-- 层级深度切换器 (支持多层嵌套) -->
      <div class="level-selector font-mono">
        <button
          class="level-btn"
          :class="{ active: currentLevel === 1 }"
          title="仅显示顶层大编拓扑依赖"
          @click="currentLevel = 1"
        >
          L1 // 大编
        </button>
        <button
          class="level-btn"
          :class="{ active: currentLevel === 2 }"
          title="展开至具体讲次网络"
          @click="currentLevel = 2"
        >
          L2 // 讲次
        </button>
        <button
          class="level-btn"
          :class="{ active: currentLevel === 3 }"
          title="完全展开至全节点"
          @click="currentLevel = 3"
        >
          L3 // 全谱
        </button>
      </div>
    </div>

    <!-- 右下角视图缩放与仿真控制栏 -->
    <div v-if="showControls" class="graph-floating-panel bottom-panel font-mono">
      <button class="tool-btn" title="放大 (+)" @click="handleZoomIn">
        <ZoomIn width="15" height="15" />
      </button>
      <button class="tool-btn" title="缩小 (-)" @click="handleZoomOut">
        <ZoomOut width="15" height="15" />
      </button>
      <button class="tool-btn" title="重置居中" @click="handleResetView">
        <Expand width="15" height="15" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: !isPhysicsRunning }"
        :title="isPhysicsRunning ? '暂停物理力导向' : '恢复物理力导向'"
        @click="togglePhysics"
      >
        <Pause v-if="isPhysicsRunning" width="15" height="15" />
        <Play v-else width="15" height="15" />
      </button>
    </div>

    <!-- 加载中占位 -->
    <div v-if="isLoading" class="graph-loading font-mono">
      <div class="loading-spinner"></div>
      <span>GENERATING KNOWLEDGE NETWORK...</span>
    </div>

    <!-- 节点详情侧边信息卡片 (点击节点时展开) -->
    <transition name="slide-fade">
      <aside v-if="showDetails && selectedNode" class="node-inspector-drawer">
        <div class="drawer-header">
          <div class="drawer-type-badge font-mono" :style="{ borderColor: selectedNode.color, color: selectedNode.color }">
            {{ NODE_TYPE_LABELS[selectedNode.type] || selectedNode.type }}
          </div>
          <button class="close-drawer-btn" @click="selectedNode = null">×</button>
        </div>

        <h3 class="drawer-title">{{ selectedNode.tag ? `${selectedNode.tag} · ${selectedNode.title}` : selectedNode.title }}</h3>
        <p v-if="selectedNode.desc" class="drawer-desc">{{ selectedNode.desc }}</p>

        <!-- 前置要求说明 -->
        <div v-if="selectedNode.prereqText" class="drawer-field">
          <div class="field-label font-mono">PREREQUISITE // 前置依赖</div>
          <div class="field-value font-mono">{{ selectedNode.prereqText }}</div>
        </div>

        <!-- 节点指标参数 -->
        <div class="drawer-meta-grid font-mono">
          <div v-if="selectedNode.sectionsCount" class="meta-item">
            <span class="meta-label">收录讲次</span>
            <span class="meta-val">{{ selectedNode.sectionsCount }} 讲</span>
          </div>
          <div v-if="selectedNode.nodesCount" class="meta-item">
            <span class="meta-label">知识节点</span>
            <span class="meta-val">{{ selectedNode.nodesCount }} 点</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">拓扑层级</span>
            <span class="meta-val">LEVEL {{ selectedNode.level }}</span>
          </div>
        </div>

        <!-- 操作按钮：进入讲义阅读 -->
        <div class="drawer-action-wrap">
          <button
            v-if="selectedNode.level >= 2"
            class="enter-lecture-btn font-mono"
            @click="navigateToLecture(selectedNode)"
          >
            <span>进入讲义阅读</span>
            <NavArrowRight width="14" height="14" />
          </button>
          <button
            v-else-if="selectedNode.level === 1"
            class="enter-lecture-btn font-mono"
            @click="currentLevel = 2; focusNode(selectedNode.id)"
          >
            <span>展开该编下属讲次</span>
            <NavArrowRight width="14" height="14" />
          </button>
        </div>
      </aside>
    </transition>
  </div>
</template>

<style scoped>
.roadmap-graph-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
  position: relative;
  overflow: hidden;
  isolation: isolate; /* 建立独立层叠上下文，杜绝内部所有绝对定位浮层穿透到页面级导航栏或 Layout */
  z-index: 1;
  background-color: var(--bg-app);
  display: flex;
  user-select: none;
}

.graph-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
}

.graph-canvas.is-grabbing {
  cursor: grabbing;
}

/* 浮动控制面板 (Obsidian 沉浸暗色风格) */
.graph-floating-panel {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.top-panel {
  top: 14px;
  left: 16px;
}

.bottom-panel {
  bottom: 14px;
  right: 16px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* 搜索框 */
.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 0 10px;
  height: 32px;
  width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  margin-right: 6px;
}

.graph-search-input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--font-size-smallest);
  outline: none;
}

.graph-search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
}

.clear-btn:hover {
  color: var(--text-primary);
}

/* 层级切换按钮组 */
.level-selector {
  display: flex;
  align-items: center;
  height: 32px;
  box-sizing: border-box;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 3px;
  gap: 2px;
}

.level-btn {
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  padding: 0 10px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: color 120ms ease, background-color 120ms ease;
}

.level-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.level-btn.active {
  background-color: var(--bg-elevated);
  color: var(--text-primary);
  font-weight: 600;
}

/* 工具栏按钮 */
.tool-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all 120ms ease;
}

.tool-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.tool-btn.active {
  color: var(--accent-primary);
  background-color: var(--bg-elevated);
}

/* 加载中 */
.graph-loading {
  position: absolute;
  inset: 0;
  background-color: rgba(11, 15, 25, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 8;
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
  letter-spacing: 0.5px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 节点详情卡片抽屉 (Obsidian 风格沉浸侧卡) */
.node-inspector-drawer {
  position: absolute;
  top: 14px;
  right: 14px;
  bottom: 14px;
  width: 320px;
  max-width: calc(100% - 28px);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-type-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid;
  letter-spacing: 0.5px;
}

.close-drawer-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}

.close-drawer-btn:hover {
  color: var(--text-primary);
}

.drawer-title {
  font-size: var(--font-size);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
  line-height: 1.4;
}

.drawer-desc {
  font-size: var(--font-size-smaller);
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.drawer-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  background-color: var(--bg-app);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
}

.field-label {
  font-size: 10px;
  color: var(--text-muted);
}

.field-value {
  font-size: var(--font-size-smallest);
  color: var(--accent-secondary, #10b981);
}

.drawer-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background-color: var(--bg-elevated);
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
}

.meta-label {
  font-size: 10px;
  color: var(--text-muted);
}

.meta-val {
  font-size: var(--font-size-smallest);
  color: var(--text-primary);
  font-weight: 600;
}

.drawer-action-wrap {
  margin-top: auto;
  padding-top: 10px;
}

.enter-lecture-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: var(--accent-primary);
  color: #ffffff;
  border: none;
  padding: 10px 14px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-smaller);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 120ms ease;
}

.enter-lecture-btn:hover {
  opacity: 0.9;
}

/* 抽屉过渡动效 */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(12px);
  opacity: 0;
}
</style>
