import { pointer, zoomIdentity } from 'd3';

const CHAPTER_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f43f5e',
  '#14b8a6',
  '#a855f7'
];

export function buildLectureGraph(tree) {
  if (!tree || !tree.id) {
    return {
      nodes: [],
      links: []
    };
  }

  const nodes = [];
  const links = [];

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
    const chNodeId = `ch-${ch.id}`;
    nodes.push({
      id: chNodeId,
      rawId: ch.id,
      lectureId: tree.id,
      title: ch.title,
      tag: '',
      level: 2,
      type: 'chapter',
      parentId: courseNodeId,
      chapterIndex: chIdx,
      color: chColor,
      radius: 14,
      sectionsCount: ch.sections?.length || 0
    });

    links.push({
      id: `${courseNodeId}->${chNodeId}`,
      sourceId: courseNodeId,
      targetId: chNodeId,
      level: 2,
      type: 'hierarchy'
    });

    const sections = Array.isArray(ch.sections) ? ch.sections : [];
    sections.forEach((sec) => {
      const secNodeId = `sec-${sec.id}`;
      nodes.push({
        id: secNodeId,
        rawId: sec.id,
        chapterId: ch.id,
        lectureId: tree.id,
        title: sec.title,
        tag: '',
        level: 3,
        type: 'section',
        parentId: chNodeId,
        chapterIndex: chIdx,
        color: chColor,
        radius: 8
      });

      links.push({
        id: `${chNodeId}->${secNodeId}`,
        sourceId: chNodeId,
        targetId: secNodeId,
        level: 3,
        type: 'hierarchy'
      });
    });
  });

  return {
    nodes,
    links
  };
}

export function createRenderScheduler(render) {
  let frame = null;

  function requestRender() {
    if (frame !== null) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = null;
      if (render()) {
        requestRender();
      }
    });
  }

  function cancelRender() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
    }
    frame = null;
  }

  return {
    requestRender,
    cancelRender
  };
}

export function createSmoothZoom({ canvas, getTransform, setTransform, target, render }) {
  let frame = null;

  function stop() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
    }
    frame = null;
  }

  function tick() {
    const current = getTransform();
    const dk = target.k - current.k;
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const finished = Math.abs(dk) < 0.0005 && Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1;
    const transform = finished
      ? zoomIdentity.translate(target.x, target.y).scale(target.k)
      : zoomIdentity
          .translate(current.x + dx * 0.22, current.y + dy * 0.22)
          .scale(current.k + dk * 0.22);
    setTransform(transform);
    const element = canvas();
    if (element) {
      element.__zoom = transform;
    }
    render();
    frame = finished ? null : requestAnimationFrame(tick);
  }

  function onWheel(event) {
    event.preventDefault();
    const element = canvas();
    if (!element) {
      return;
    }
    const [x, y] = pointer(event, element);
    let delta = event.deltaY;
    if (event.deltaMode === 1) {
      delta *= 30;
    } else if (event.deltaMode === 2) {
      delta *= 100;
    }
    const gx = (x - target.x) / target.k;
    const gy = (y - target.y) / target.k;
    target.k = Math.max(0.15, Math.min(6, target.k * Math.exp(-delta * 0.0018)));
    target.x = x - gx * target.k;
    target.y = y - gy * target.k;
    if (frame === null) {
      frame = requestAnimationFrame(tick);
    }
  }

  return {
    stop,
    onWheel
  };
}

// 讲义路线图的 Canvas 2D 绘制层，布局和交互由 RoadmapGraph 管理。
const FADE_SPEED = 0.22;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif';

function fade(item, key, target) {
  if (item[key] == null) {
    item[key] = target;
  }
  item[key] += (target - item[key]) * FADE_SPEED;
  if (Math.abs(item[key] - target) <= 0.005) {
    item[key] = target;
    return false;
  }
  return true;
}

export class RoadmapCanvas2DRenderer {
  constructor(canvas) {
    this.context = canvas.getContext('2d');
    if (!this.context) {
      throw new Error('Canvas 2D not supported');
    }
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
  }

  resize(width, height, dpr = 1) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
  }

  render({ nodes, links, hl, query, transform }) {
    const ctx = this.context;
    const { width, height, dpr } = this;
    const { k, x, y } = transform;
    const styles = getComputedStyle(document.documentElement);
    const background = styles.getPropertyValue('--bg-app').trim() || '#181818';
    const text = styles.getPropertyValue('--text-primary').trim() || '#ffffff';
    const mutedText = styles.getPropertyValue('--text-secondary').trim() || '#94a3b8';
    let needsMoreFrames = false;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.translate(x, y);
    ctx.scale(k, k);

    const pad = 120;
    const left = -x / k - pad;
    const right = (width - x) / k + pad;
    const top = -y / k - pad;
    const bottom = (height - y) / k + pad;
    const visible = (node) => node.x >= left && node.x <= right && node.y >= top && node.y <= bottom;

    for (const link of links) {
      const source = link.source;
      const target = link.target;
      if (source?.x == null || source?.y == null || target?.x == null || target?.y == null) {
        continue;
      }
      const major = link.level === 2 || source.level === 1 || target.level === 2;
      const incoming = hl && target.id === hl.targetId;
      const outgoing = hl && source.id === hl.targetId;
      const active = incoming || outgoing;
      const alpha = hl ? (active ? 1 : 0.05) : major ? 0.35 : 0.18;
      needsMoreFrames = fade(link, 'currentAlpha', alpha) || needsMoreFrames;
      ctx.globalAlpha = link.currentAlpha;
      ctx.strokeStyle = incoming ? '#10b981' : outgoing ? '#3b82f6' : text;
      ctx.lineWidth = active ? (major ? 2.8 : 2) : major ? 2 : 1.1;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }

    for (const node of nodes) {
      if (node.x == null || node.y == null) {
        continue;
      }
      const match = query && [node.title, node.tag, node.id].some((value) =>
        String(value || '').toLowerCase().includes(query)
      );
      const isTarget = hl && node.id === hl.targetId;
      const connected = isTarget || (hl && (hl.inSet.has(node.id) || hl.outSet.has(node.id)));
      const alpha = hl || query ? ((query ? match : connected) ? 1 : 0.12) : 1;
      needsMoreFrames = fade(node, 'currentAlpha', alpha) || needsMoreFrames;
      const showLabel = isTarget || match || (k >= 0.5 && (k >= 1.6 || (k >= 1 && node.level <= 2) || (k < 1 && node.level === 1)));
      needsMoreFrames = fade(node, 'currentLabelAlpha', showLabel ? 1 : 0) || needsMoreFrames;
      if (!visible(node)) {
        continue;
      }

      const radius = node.radius || 12;
      ctx.globalAlpha = node.currentAlpha;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color || '#888888';
      ctx.fill();
      ctx.lineWidth = isTarget ? 3.5 : node.level === 1 ? 2.5 : 1.6;
      ctx.strokeStyle = isTarget ? '#ffffff' : node.color || '#888888';
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const node of nodes) {
      if (node.x == null || node.y == null || !visible(node) || node.currentLabelAlpha <= 0.01) {
        continue;
      }
      const label = node.tag ? `${node.tag} ${node.title}` : node.title;
      if (!label) {
        continue;
      }
      ctx.globalAlpha = node.currentLabelAlpha * node.currentAlpha;
      ctx.fillStyle = node.level === 1 ? text : mutedText;
      ctx.font = `${node.level === 1 ? '600 12' : node.level === 3 ? '400 7.5' : '500 8.5'}px ${FONT_FAMILY}`;
      ctx.fillText(label, node.x, node.y + (node.radius || 12) + (node.level === 1 ? 6 : node.level === 2 ? 4 : 3));
    }
    ctx.globalAlpha = 1;
    return needsMoreFrames;
  }

  destroy() {
    this.context = null;
  }
}
