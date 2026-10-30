// 知识点画布过渡
import { bezierProgress } from './knowledge-motion.js';

const color = (value, alpha = 1) => `rgba(${value.slice(0, 3).map((part) => Math.round(part * 255)).join(',')},${alpha})`;
const mix = (a, b, t) => a + (b - a) * t;

export async function createKnowledgeTransition2D(canvas, title, geometry, origin, surface, textColor, titleEndColor, waveColor, glyphAdvance, beforeFrame) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('画布不可用');
  let frame = 0;
  let disposed = false;
  let resolvePending;
  function draw(progress, wave, dim) {
    beforeFrame?.();
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = `rgba(0,0,0,${0.48 * dim})`;
    context.fillRect(0, 0, width, height);
    context.setTransform(width / bounds.width, 0, 0, height / bounds.height, 0, 0);
    const { source, target, sourceFontSize, sourceOpacity, titleX, titleY, titleFontSize, titleFont } = geometry();
    const box = source.map((part, index) => mix(part, target[index], progress));
    const radius = Math.min(mix(sourceFontSize * 0.2, 6, progress), box[2] / 2, box[3] / 2);
    context.save();
    context.beginPath();
    context.roundRect(box[0], box[1], box[2], box[3], radius);
    context.clip();
    context.fillStyle = color(origin);
    context.fillRect(box[0], box[1], box[2], box[3]);
    const centerX = Math.max(0, Math.min(box[2], source[0] + source[2] / 2 - box[0]));
    const centerY = Math.max(0, Math.min(box[3], source[1] + source[3] / 2 - box[1]));
    const maxRadius = Math.hypot(Math.max(centerX, box[2] - centerX), Math.max(centerY, box[3] - centerY));
    const edge = wave * 1.3 - 0.15;
    if (edge > 0) {
      context.beginPath();
      for (let i = 0; i <= 120; i++) {
        const angle = i * Math.PI * 2 / 120;
        const radiusAt = Math.max(0, edge * maxRadius / (1 + Math.sin(angle * 5 + edge * 8) * 0.08));
        const x = box[0] + centerX + Math.cos(angle) * radiusAt;
        const y = box[1] + centerY + Math.sin(angle) * radiusAt;
        if (!i) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
      context.fillStyle = color(surface);
      context.fill();
      context.strokeStyle = color(waveColor, Math.sin(wave * Math.PI) * 0.65);
      context.lineWidth = maxRadius * 0.08;
      context.stroke();
    }
    const fontSize = Math.max(1, Math.round(mix(sourceFontSize, titleFontSize, progress) * 4) / 4);
    const fontWeight = Math.round(mix(400, 600, progress) / 25) * 25;
    const titleColor = textColor.map((part, index) => mix(part, titleEndColor[index], progress));
    context.globalAlpha = mix(sourceOpacity, 1, progress);
    context.fillStyle = color(titleColor);
    context.font = `${fontWeight} ${fontSize}px ${titleFont}`;
    context.textBaseline = 'top';
    const x = mix(source[0] + sourceFontSize * 0.4, titleX, progress);
    const topInset = context.measureText(title).fontBoundingBoxAscent || 0;
    let y = mix(source[1] + sourceFontSize * 0.4, titleY + topInset, progress);
    const available = Math.max(1, Math.min(512, box[2] - mix(sourceFontSize * 0.8, 56, progress)));
    let lineX = 0;
    for (const character of Array.from(title)) {
      const measured = context.measureText(character).width;
      const mapAdvance = glyphAdvance?.(character);
      const advance = mapAdvance === undefined ? measured : mix(mapAdvance * fontSize, measured, progress);
      if (lineX > 0 && lineX + advance > available) { lineX = 0; y += fontSize * 1.448; }
      if (y > box[1] + box[3]) break;
      context.fillText(character, x + lineX, y);
      lineX += advance;
    }
    context.restore();
  }
  function play(reverse = false, onWave = null) {
    if (resolvePending) { cancelAnimationFrame(frame); resolvePending(false); }
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 700;
    const started = performance.now();
    return new Promise((resolve, reject) => {
      resolvePending = resolve;
      const tick = (now) => {
        if (disposed) { resolvePending = null; resolve(false); return; }
        const raw = Math.min(1, (now - started) / duration);
        const movement = bezierProgress(Math.min(1, raw / 0.78), 0.12, 0.85, 0.24, 1);
        const waveTime = reverse ? 1 - raw : raw;
        const wave = bezierProgress(Math.max(0, Math.min(1, (waveTime - 0.4) / 0.6)), 0.33, 0, 0.2, 1);
        const dim = bezierProgress(raw, 0.4, 0, 0.2, 1);
        try { draw(reverse ? 1 - movement : movement, wave, reverse ? 1 - dim : dim); onWave?.(wave); }
        catch (error) { resolvePending = null; reject(error); return; }
        if (raw < 1) frame = requestAnimationFrame(tick);
        else { resolvePending = null; resolve(true); }
      };
      frame = requestAnimationFrame(tick);
    });
  }
  function dispose() { disposed = true; cancelAnimationFrame(frame); resolvePending?.(false); }
  return { play, dispose };
}
