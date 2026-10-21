<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUpdate, nextTick } from 'vue';

const props = defineProps({
  outlines: {
    type: Array,
    default: () => []
  },
  activeId: {
    type: String,
    default: ''
  },
  scrollContainer: {
    type: [Object, null],
    default: null
  }
});

const emit = defineEmits(['select-outline', 'active-change']);

const trackRef = ref(null);
const itemRefs = ref([]);
const barTop = ref(0);
const barHeight = 20;
const currentActiveId = ref(props.activeId || (props.outlines[0]?.id ?? ''));

let containerEl = null;

const setItemRef = (el, idx) => {
  if (el) {
    itemRefs.value[idx] = el;
  }
};

onBeforeUpdate(() => {
  itemRefs.value = [];
});

const activeBarStyle = computed(() => {
  return {
    transform: `translateY(${barTop.value}px)`,
    height: `${barHeight}px`
  };
});

const resolveContainer = () => {
  if (props.scrollContainer) {
    return props.scrollContainer instanceof HTMLElement
      ? props.scrollContainer
      : props.scrollContainer?.$el || props.scrollContainer;
  }
  return document.querySelector('.reading-viewport');
};

const updateBar = () => {
  const container = containerEl || resolveContainer();
  if (!container || !trackRef.value) return;

  const N = props.outlines.length;
  if (N === 0) return;

  const trackHeight = trackRef.value.clientHeight;
  const maxTravel = Math.max(0, trackHeight - barHeight);
  const maxScroll = container.scrollHeight - container.clientHeight;

  if (maxScroll <= 0) {
    barTop.value = 0;
    currentActiveId.value = props.outlines[0]?.id || '';
    return;
  }

  // 1. 获取各 outline 按钮在其轨道中的垂直中心位置
  const itemCenters = [];
  for (let i = 0; i < N; i++) {
    const el = itemRefs.value[i];
    if (el) {
      itemCenters.push(el.offsetTop + el.offsetHeight / 2);
    } else {
      itemCenters.push((i / (N - 1 || 1)) * maxTravel + barHeight / 2);
    }
  }

  // 2. 计算每个 outline 目标位置 Y_i（首项贴顶 0，末项贴底 maxTravel，中间居中对齐文字）
  const targets = [];
  for (let i = 0; i < N; i++) {
    if (i === 0) {
      targets.push(0);
    } else if (i === N - 1) {
      targets.push(maxTravel);
    } else {
      targets.push(Math.max(0, Math.min(itemCenters[i] - barHeight / 2, maxTravel)));
    }
  }

  // 3. 获取正文中各 section 标题在容器中的实际滚动距离 S_i
  const containerRect = container.getBoundingClientRect();
  const currentScroll = container.scrollTop;
  const sectionScrollTops = [];
  for (let i = 0; i < N; i++) {
    const secEl = document.getElementById(props.outlines[i].id);
    if (secEl) {
      const s = secEl.getBoundingClientRect().top - containerRect.top + currentScroll - 60;
      sectionScrollTops.push(Math.max(0, s));
    } else {
      sectionScrollTops.push((i / (N - 1 || 1)) * maxScroll);
    }
  }

  // 4. 连续映射计算色条位置
  let newBarTop = 0;

  if (currentScroll >= maxScroll - 2) {
    // 已经滚动到容器最底部：完全贴底，0 缝隙
    newBarTop = maxTravel;
  } else if (currentScroll <= sectionScrollTops[0]) {
    // 在第一个 section 之前
    const ratio = sectionScrollTops[0] > 0 ? Math.min(currentScroll / sectionScrollTops[0], 1) : 0;
    newBarTop = ratio * Math.max(0, itemCenters[0] - barHeight / 2);
  } else if (currentScroll >= sectionScrollTops[N - 1]) {
    // 在最后一个 section 之后，平滑过渡到底部
    const remaining = maxScroll - sectionScrollTops[N - 1];
    const ratio = remaining > 0 ? Math.min((currentScroll - sectionScrollTops[N - 1]) / remaining, 1) : 1;
    const startY = targets[N - 1];
    newBarTop = startY + ratio * (maxTravel - startY);
  } else {
    // 在区间 [i, i + 1] 之间连续线性插值
    for (let i = 0; i < N - 1; i++) {
      const sA = sectionScrollTops[i];
      const sB = sectionScrollTops[i + 1];
      if (currentScroll >= sA && currentScroll < sB) {
        const span = sB - sA;
        const progress = span > 0 ? (currentScroll - sA) / span : 0;
        newBarTop = targets[i] + progress * (targets[i + 1] - targets[i]);
        break;
      }
    }
  }

  barTop.value = Math.max(0, Math.min(newBarTop, maxTravel));

  // 5. 标题高亮严格与色条物理位置对齐：激活离当前色条最近的大纲项
  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < N; i++) {
    const diff = Math.abs((itemCenters[i] - barHeight / 2) - barTop.value);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  const newActiveId = props.outlines[closestIdx]?.id || '';
  if (newActiveId && currentActiveId.value !== newActiveId) {
    currentActiveId.value = newActiveId;
    emit('active-change', newActiveId);
  }
};

const handleClick = (id) => {
  currentActiveId.value = id;
  emit('select-outline', id);
};

watch(
  () => props.activeId,
  (val) => {
    if (val && val !== currentActiveId.value) {
      currentActiveId.value = val;
    }
  }
);

watch(
  () => props.outlines,
  () => {
    itemRefs.value = [];
    nextTick(updateBar);
  },
  { deep: true }
);

watch(
  () => props.scrollContainer,
  (newContainer) => {
    if (containerEl) {
      containerEl.removeEventListener('scroll', updateBar);
    }
    containerEl = resolveContainer();
    if (containerEl) {
      containerEl.addEventListener('scroll', updateBar, { passive: true });
    }
    nextTick(updateBar);
  }
);

onMounted(() => {
  containerEl = resolveContainer();
  if (containerEl) {
    containerEl.addEventListener('scroll', updateBar, { passive: true });
  }
  window.addEventListener('resize', updateBar);
  nextTick(() => {
    updateBar();
  });
});

onUnmounted(() => {
  if (containerEl) {
    containerEl.removeEventListener('scroll', updateBar);
  }
  window.removeEventListener('resize', updateBar);
});
</script>

<template>
  <nav class="outline-timeline" aria-label="页面大纲时间条">
    <div class="timeline-header font-mono">
      <span>OUTLINE</span>
    </div>

    <div ref="trackRef" class="timeline-track">
      <!-- 1. 左侧常驻细轨线 -->
      <div class="track-rail"></div>

      <!-- 2. 随滚动严格连续位移的指示色条 (无缓动延迟，0残余底缝) -->
      <div class="track-active-bar" :style="activeBarStyle"></div>

      <!-- 3. 大纲项列表 -->
      <button
        v-for="(item, idx) in outlines"
        :key="item.id"
        :ref="el => setItemRef(el, idx)"
        class="timeline-item"
        :class="{ active: currentActiveId === item.id }"
        :title="item.title"
        @click="handleClick(item.id)"
      >
        <span class="timeline-label">{{ item.title }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* 无背景的竖向时间条导航，悬浮在内容区右侧上层 */
.outline-timeline {
  position: absolute;
  right: 32px;
  top: 36px;
  z-index: 25;
  width: 176px;
  background: transparent;
  pointer-events: auto;
  user-select: none;
}

.timeline-header {
  font-size: var(--font-size-smallest);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: 12px;
  padding-left: 14px;
  opacity: 0.7;
}

.timeline-track {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 14px;
}

/* 左侧常驻细轨线 */
.track-rail {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background-color: var(--border-subtle);
  border-radius: 1px;
}

/* 随着滚动即时连续位移的指示色条 (无滞后 transition，精确贴底) */
.track-active-bar {
  position: absolute;
  left: -0.25px;
  width: 2px;
  border-radius: 1px;
  background-color: var(--accent-primary);
  pointer-events: none;
  will-change: transform;
}

.timeline-item {
  position: relative;
  display: block;
  background: transparent;
  border: none;
  padding: 2px 0;
  cursor: pointer;
  text-align: left;
  transition: color 120ms ease;
}

.timeline-label {
  display: block;
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 120ms ease;
}

.timeline-item:hover .timeline-label {
  color: var(--text-secondary);
}

.timeline-item.active .timeline-label {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}
</style>
