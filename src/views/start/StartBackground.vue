<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

const canvasRef = ref(null);
const isReady = ref(false);
let animationFrameId = null;
let resizeTimer = null;
let isTabActive = true;
const startTime = Date.now();

const ENTER_DURATION = 1400;

const mousePos = {
  x: -9999,
  y: -9999,
  visible: false,
  intensity: 0
};

// 检查当前是否为浅色模式
const checkIsLight = () => {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.documentElement.getAttribute('data-theme') === 'light';
};

// 绘制平滑连续的拓扑函数曲线与微积分投影
const renderFrame = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);

  const isLight = checkIsLight();
  const strokeColor = isLight ? '30, 41, 59' : '226, 232, 240';
  const elapsed = Date.now() - startTime;
  const t = elapsed * 0.0008;

  // 三次平滑出场缓动系数
  const rawProgress = Math.min(1, elapsed / ENTER_DURATION);
  const enterFactor = 1 - Math.pow(1 - rawProgress, 3);

  // 鼠标悬停激活强度平滑过渡
  const targetIntensity = mousePos.visible ? 1 : 0;
  mousePos.intensity += (targetIntensity - mousePos.intensity) * 0.12;

  // 多层数学波形配置
  const waveConfigs = [
    {
      amp: 46,
      freq: 0.002,
      speed: 1.05,
      yRatio: 0.52,
      lineAlpha: 0.2,
      hasFill: true,
      fillAlpha: 0.04
    },
    {
      amp: 34,
      freq: 0.0028,
      speed: 0.82,
      yRatio: 0.58,
      lineAlpha: 0.15,
      hasFill: true,
      fillAlpha: 0.022
    },
    {
      amp: 24,
      freq: 0.0036,
      speed: 1.3,
      yRatio: 0.65,
      lineAlpha: 0.11,
      hasFill: false,
      fillAlpha: 0
    },
    {
      amp: 16,
      freq: 0.0046,
      speed: 1.65,
      yRatio: 0.72,
      lineAlpha: 0.07,
      hasFill: false,
      fillAlpha: 0
    }
  ];

  ctx.save();
  ctx.globalAlpha = enterFactor;

  // 绘制各层曲线与下方向下的微积分渐变投影
  for (let idx = 0; idx < waveConfigs.length; idx++) {
    const cfg = waveConfigs[idx];
    const baseY = h * cfg.yRatio;
    const points = [];

    // 波幅根据入场进度逐渐展开
    const currentAmp = cfg.amp * enterFactor;

    for (let x = 0; x <= w; x += 4) {
      const p1 = x * cfg.freq + t * cfg.speed;
      const p2 = x * cfg.freq * 0.5 - t * cfg.speed * 0.45;
      const wave = Math.sin(p1) * currentAmp + Math.cos(p2) * (currentAmp * 0.42);

      // 用高斯曲线平滑鼠标附近的波形
      let distortion = 0;
      if (mousePos.intensity > 0.001) {
        const dx = x - mousePos.x;
        const dy = baseY - mousePos.y;
        const dist = Math.hypot(dx, dy);
        const radius = 220;
        if (dist < radius) {
          const smoothFactor = (1 + Math.cos((dist / radius) * Math.PI)) * 0.5;
          distortion = -smoothFactor * 14 * mousePos.intensity * enterFactor;
        }
      }

      points.push({
        x,
        y: baseY + wave + distortion
      });
    }

    // 填充曲线下方微积分积分区域
    if (cfg.hasFill && points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, baseY - currentAmp, 0, h);
      grad.addColorStop(0, `rgba(${strokeColor}, ${cfg.fillAlpha})`);
      grad.addColorStop(1, `rgba(${strokeColor}, 0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 绘制曲线轮廓
    if (points.length > 0) {
      ctx.beginPath();
      ctx.lineWidth = idx === 0 ? 1.4 : 1.0;
      ctx.strokeStyle = `rgba(${strokeColor}, ${cfg.lineAlpha})`;
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }

    // 主波峰极值点微标记
    if (idx === 0) {
      for (let i = 8; i < points.length - 8; i += 28) {
        const pt = points[i];
        ctx.fillStyle = `rgba(${strokeColor}, 0.28 * enterFactor)`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 鼠标工程十字游标与坐标轴
  if (
    mousePos.intensity > 0.01 &&
    mousePos.x > 0 &&
    mousePos.x < w &&
    mousePos.y > 0 &&
    mousePos.y < h
  ) {
    const curAlpha = mousePos.intensity * enterFactor;

    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = `rgba(${strokeColor}, ${0.14 * curAlpha})`;

    ctx.beginPath();
    ctx.moveTo(0, mousePos.y);
    ctx.lineTo(w, mousePos.y);
    ctx.moveTo(mousePos.x, 0);
    ctx.lineTo(mousePos.x, h);
    ctx.stroke();
    ctx.restore();

    // 游标中心环形靶心
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${strokeColor}, ${0.45 * curAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = `rgba(${strokeColor}, ${0.65 * curAlpha})`;
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 极客坐标指示牌
    const coordStr = `X: ${Math.round(mousePos.x)}  Y: ${Math.round(mousePos.y)}`;
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = `rgba(${strokeColor}, ${0.42 * curAlpha})`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(coordStr, mousePos.x + 10, mousePos.y - 8);
  }

  ctx.restore();

  if (isTabActive) {
    animationFrameId = requestAnimationFrame(renderFrame);
  }
};

// 让画布尺寸跟随窗口
const syncCanvasSize = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
};

const handleWindowResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    syncCanvasSize();
  }, 120);
};

const handleMouseMove = (e) => {
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
  mousePos.visible = true;
};

const handleMouseLeave = () => {
  mousePos.visible = false;
};

const handleTouchMove = (e) => {
  if (e.touches && e.touches[0]) {
    mousePos.x = e.touches[0].clientX;
    mousePos.y = e.touches[0].clientY;
    mousePos.visible = true;
  }
};

const handleTouchEnd = () => {
  mousePos.visible = false;
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    isTabActive = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  } else {
    isTabActive = true;
    renderFrame();
  }
};

onMounted(() => {
  syncCanvasSize();
  renderFrame();
  requestAnimationFrame(() => {
    isReady.value = true;
  });

  window.addEventListener('resize', handleWindowResize, {
    passive: true
  });
  window.addEventListener('mousemove', handleMouseMove, {
    passive: true
  });
  window.addEventListener('mouseleave', handleMouseLeave, {
    passive: true
  });
  window.addEventListener('touchmove', handleTouchMove, {
    passive: true
  });
  window.addEventListener('touchend', handleTouchEnd, {
    passive: true
  });
  window.addEventListener('touchcancel', handleTouchEnd, {
    passive: true
  });
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  clearTimeout(resizeTimer);
  window.removeEventListener('resize', handleWindowResize);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseleave', handleMouseLeave);
  window.removeEventListener('touchmove', handleTouchMove);
  window.removeEventListener('touchend', handleTouchEnd);
  window.removeEventListener('touchcancel', handleTouchEnd);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
  <div
    class="start-bg-root"
    :class="{
      'is-ready': isReady
    }"
  >
    <!-- 数学笛卡尔正交网格与刻度点阵 -->
    <div class="cartesian-grid"></div>

    <!-- 动态微积分拓扑曲线画布 -->
    <canvas
      ref="canvasRef"
      class="math-canvas"
    ></canvas>

    <!-- 中心检索区安全留白径向蒙版 -->
    <div class="readability-vignette"></div>
  </div>
</template>

<style scoped>
/* 固定背景画布位置 */
.start-bg-root {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  transform: scale(0.985);
  transition:
    opacity 900ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 1100ms cubic-bezier(0.16, 1, 0.3, 1);
}

.start-bg-root.is-ready {
  opacity: 1;
  transform: scale(1);
}

/* 笛卡尔坐标正交极细网格与交叉点阵 */
.cartesian-grid {
  position: absolute;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background-image:
    radial-gradient(circle, rgba(255, 255, 255, 0.12) 1px, transparent 1px),
    linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size:
    40px 40px,
    40px 40px,
    40px 40px;
  background-position: center center;
  opacity: 0.75;
}

:root[data-theme='light'] .cartesian-grid {
  background-image:
    radial-gradient(circle, rgba(0, 0, 0, 0.12) 1px, transparent 1px),
    linear-gradient(to right, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
}

/* 拓扑曲线画布 */
.math-canvas {
  position: absolute;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: block;
}

/* 提高中心搜索栏的对比度 */
.readability-vignette {
  position: absolute;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(ellipse 620px 340px at 50% 36%, var(--bg-app) 20%, transparent 100%);
  opacity: 0.92;
}

@media (max-width: 640px) {
  .readability-vignette {
    background: radial-gradient(ellipse 94vw 360px at 50% 38%, var(--bg-app) 35%, transparent 100%);
  }
}
</style>
