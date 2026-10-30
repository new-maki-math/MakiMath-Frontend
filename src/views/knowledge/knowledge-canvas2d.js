// 知识地图画布绘制
const clamp = (value) => Math.max(0, Math.min(1, value));
const opacity = (scale, start, end) => clamp((scale - start) / (end - start));
let lineCache = new WeakMap();
let boundsCache = new WeakMap();
const labelCache = new Map();
const labelCacheLimit = 64 * 1024 * 1024;
let labelCacheBytes = 0;

export function clearCanvasTextCache() {
  lineCache = new WeakMap();
  boundsCache = new WeakMap();
  for (const entry of labelCache.values()) entry.image?.close?.();
  labelCache.clear();
  labelCacheBytes = 0;
}

function rememberLabel(item, entry) {
  const previous = labelCache.get(item);
  if (previous) {
    if (previous.font === entry.font && previous.color === entry.color && previous.resolution >= entry.resolution) {
      entry.image?.close?.();
      return;
    }
    previous.image?.close?.();
    labelCacheBytes -= previous.bytes;
    labelCache.delete(item);
  }
  while (labelCache.size && labelCacheBytes + entry.bytes > labelCacheLimit) {
    const oldest = labelCache.keys().next().value;
    const removed = labelCache.get(oldest);
    labelCacheBytes -= removed.bytes;
    removed.image?.close?.();
    labelCache.delete(oldest);
  }
  if (entry.bytes > labelCacheLimit) { entry.image?.close?.(); return; }
  labelCache.set(item, entry);
  labelCacheBytes += entry.bytes;
}


function tileLines(context, tile, font) {
  const previous = lineCache.get(tile);
  if (previous?.font === font) return previous.lines;
  const width = Math.max(0, parseFloat(tile.style.width) - 8);
  const height = Math.max(0, parseFloat(tile.style.height) - 8);
  const lines = [];
  let line = '';
  context.save();
  context.font = `10px ${font}`;
  for (const character of tile.node.title) {
    const next = line + character;
    if (line && context.measureText(next).width > width) {
      lines.push(line);
      if ((lines.length + 1) * 14.5 > height + 4.5) { line = ''; break; }
      line = character;
    } else line = next;
  }
  if (line) lines.push(line);
  context.restore();
  lineCache.set(tile, { font, lines });
  return lines;
}

function tileImage(context, tile, font, color, scale, dpr) {
  const resolution = Math.min(16, Math.pow(2, Math.ceil(Math.log2(Math.max(2, scale * dpr)))));
  const cached = labelCache.get(tile);
  if (cached?.font === font && cached.color === color && cached.resolution >= resolution) {
    labelCache.delete(tile);
    labelCache.set(tile, cached);
    return cached;
  }
  if (cached) { labelCache.delete(tile); labelCacheBytes -= cached.bytes; cached.image?.close?.(); }
  const lines = tileLines(context, tile, font);
  if (!lines.length) return null;
  context.save();
  context.font = `10px ${font}`;
  const width = Math.max(1, Math.min(parseFloat(tile.style.width) - 8, Math.max(...lines.map((line) => context.measureText(line).width)) + 1));
  context.restore();
  const height = Math.min(Math.max(1, parseFloat(tile.style.height) - 8), 10 + (lines.length - 1) * 14.5 + 2);
  const pixelWidth = Math.max(1, Math.ceil(width * resolution));
  const pixelHeight = Math.max(1, Math.ceil(height * resolution));
  const bytes = pixelWidth * pixelHeight * 4;
  if (pixelWidth > 4096 || pixelHeight > 4096 || bytes > labelCacheLimit) return null;
  const image = typeof document === 'undefined' ? new OffscreenCanvas(pixelWidth, pixelHeight) : document.createElement('canvas');
  image.width = pixelWidth;
  image.height = pixelHeight;
  const painter = image.getContext('2d');
  if (!painter) return null;
  painter.scale(resolution, resolution);
  painter.font = `10px ${font}`;
  painter.fillStyle = color;
  painter.textBaseline = 'top';
  lines.forEach((line, index) => painter.fillText(line, 0, index * 14.5));
  const entry = { font, color, resolution, image, width, height, bytes };
  rememberLabel(tile, entry);
  return entry;
}

function groupImage(context, group, font, color, scale, dpr) {
  const resolution = Math.min(16, Math.pow(2, Math.ceil(Math.log2(Math.max(2, scale * dpr)))));
  const cached = labelCache.get(group);
  if (cached?.font === font && cached.color === color && cached.resolution >= resolution) {
    labelCache.delete(group);
    labelCache.set(group, cached);
    return cached;
  }
  if (cached) { labelCache.delete(group); labelCacheBytes -= cached.bytes; cached.image?.close?.(); }
  const domain = group.kind === 'domain';
  const fontSize = domain ? 18 : 14;
  const padding = domain ? 9 : 5;
  const fontStyle = `${domain ? 500 : 400} ${fontSize}px ${font}`;
  context.save();
  context.font = fontStyle;
  const width = Math.max(1, Math.min(parseFloat(group.style.width) - padding * 2, context.measureText(group.title).width + 1));
  context.restore();
  const height = fontSize + 3;
  const pixelWidth = Math.max(1, Math.ceil(width * resolution));
  const pixelHeight = Math.max(1, Math.ceil(height * resolution));
  const bytes = pixelWidth * pixelHeight * 4;
  if (pixelWidth > 4096 || pixelHeight > 4096 || bytes > labelCacheLimit) return null;
  const image = typeof document === 'undefined' ? new OffscreenCanvas(pixelWidth, pixelHeight) : document.createElement('canvas');
  image.width = pixelWidth;
  image.height = pixelHeight;
  const painter = image.getContext('2d');
  if (!painter) return null;
  painter.scale(resolution, resolution);
  painter.font = fontStyle;
  painter.fillStyle = color;
  painter.textBaseline = 'top';
  painter.fillText(group.title, 0, 0);
  const entry = { font, color, resolution, image, width, height, bytes };
  rememberLabel(group, entry);
  return entry;
}


export function readCanvasPalette(element) {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  element.appendChild(probe);
  const color = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
  const palette = {
    library: color('var(--bg-surface)'),
    domain: color('var(--bg-elevated)'),
    topic: color('color-mix(in srgb, var(--bg-elevated) 80%, var(--text-muted))'),
    domainBorder: color('color-mix(in srgb, var(--text-secondary) 38%, transparent)'),
    topicBorder: color('color-mix(in srgb, var(--text-secondary) 22%, transparent)'),
    unmastered: color('color-mix(in srgb, var(--text-muted) 38%, var(--bg-hover))'),
    mastered: color('color-mix(in srgb, var(--accent-primary) 50%, var(--tree-selected-bg))'),
    selected: color('color-mix(in srgb, color-mix(in srgb, var(--text-muted) 38%, var(--bg-hover)) 88%, white)'),
    selectedMastered: color('color-mix(in srgb, color-mix(in srgb, var(--accent-primary) 50%, var(--tree-selected-bg)) 88%, white)'),
    before: color('color-mix(in srgb, var(--tag-orange) 45%, var(--bg-hover))'),
    after: color('color-mix(in srgb, var(--tag-green) 45%, var(--bg-hover))'),
    text: color('var(--text-primary)'),
    masteredText: color('var(--tree-selected-fg)'),
    font: getComputedStyle(element).fontFamily
  };
  probe.remove();
  return palette;
}

function bounds(style, transform) {
  let rect = boundsCache.get(style);
  if (!rect) {
    rect = { x: parseFloat(style.left), y: parseFloat(style.top), width: parseFloat(style.width), height: parseFloat(style.height) };
    boundsCache.set(style, rect);
  }
  return {
    x: rect.x * transform.k + transform.x,
    y: rect.y * transform.k + transform.y,
    width: rect.width * transform.k,
    height: rect.height * transform.k
  };
}

function visible(box, width, height) {
  return box.width > 0 && box.height > 0 && box.x < width && box.y < height && box.x + box.width > 0 && box.y + box.height > 0;
}

function shape(context, box, fill, radius) {
  context.beginPath();
  context.roundRect(box.x, box.y, box.width, box.height, Math.min(radius, box.width / 2, box.height / 2));
  context.fillStyle = fill;
  context.fill();
}

function title(context, box, text, fontSize, color, alpha, padding, lines = null) {
  if (!alpha || box.width < 12 || box.height < fontSize + padding * 2) return;
  context.save();
  context.beginPath();
  context.rect(box.x + padding, box.y, Math.max(0, box.width - padding * 2), box.height);
  context.clip();
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.textBaseline = 'top';
  if (!lines) context.fillText(text, box.x + padding, box.y + padding);
  else lines.forEach((line, index) => context.fillText(line, box.x + padding, box.y + padding + index * fontSize * 1.45));
  context.restore();
}

export function drawKnowledgeCanvas(canvas, layout, mastered, transform, palette, width, height, dpr, time = 0) {
  const context = canvas.getContext('2d');
  if (!context || !width || !height) return;
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const scale = transform.k;
  for (const group of layout.groups) {
    const box = bounds(group.style, transform);
    if (!visible(box, width, height)) continue;
    const domain = group.kind === 'domain';
    shape(context, box, group.isLibrary ? palette.library : domain ? palette.domain : palette.topic, 2 * scale);
    if (scale > 0.2) {
      context.save();
      context.globalAlpha = opacity(scale, 0.2, 0.4);
      context.strokeStyle = domain ? palette.domainBorder : palette.topicBorder;
      context.lineWidth = 1;
      context.stroke();
      context.restore();
    }
    const fontSize = (domain ? 18 : 14) * scale;
    const alpha = opacity(scale, domain ? 0.32 : 0.58, domain ? 0.52 : 0.8);
    const padding = (domain ? 9 : 5) * scale;
    if (alpha && box.width >= 12 && box.height >= fontSize + padding * 2) {
      const label = groupImage(context, group, palette.font, palette.text, scale, dpr);
      if (label) {
        context.globalAlpha = alpha;
        context.drawImage(label.image, box.x + padding, box.y + padding, label.width * scale, label.height * scale);
        context.globalAlpha = 1;
      } else {
        context.font = `${domain ? 500 : 400} ${fontSize}px ${palette.font}`;
        title(context, box, group.title, fontSize, palette.text, alpha, padding);
      }
    }
  }
  const visibleTiles = [];
  const paths = new Map();
  for (const tile of layout.tiles) {
    const box = bounds(tile.style, transform);
    if (!visible(box, width, height)) continue;
    const known = mastered.has(tile.node.slug);
    const state = tile.node.state || '';
    const tint = state === 'is-prerequisite' ? 'before' : state === 'is-successor' ? 'after' : state === 'is-selected' ? (known ? 'selectedMastered' : 'selected') : known ? 'mastered' : 'unmastered';
    const key = `${tint}:${state === 'is-dimmed' ? 'dim' : 'normal'}`;
    if (!paths.has(key)) paths.set(key, { path: new Path2D(), tint, dim: state === 'is-dimmed' });
    paths.get(key).path.roundRect(box.x, box.y, box.width, box.height, Math.min(2 * scale, box.width / 2, box.height / 2));
    visibleTiles.push({ tile, box, known, state });
  }
  for (const { path, tint, dim } of paths.values()) {
    context.globalAlpha = dim ? 0.4 : time && (tint === 'before' || tint === 'after') ? 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(time * Math.PI / 1000)) : 1;
    context.fillStyle = palette[tint];
    context.fill(path);
  }
  context.globalAlpha = 1;
  const tileAlpha = opacity(scale, 0.95, 1.2);
  const tileFontSize = 10 * scale;
  context.font = `${tileFontSize}px ${palette.font}`;
  for (const { tile, box, known, state } of visibleTiles) {
    if (tileAlpha && box.width >= 12 && box.height >= 18 * scale) {
      const color = known ? palette.masteredText : palette.text;
      const label = tileImage(context, tile, palette.font, color, scale, dpr);
      if (label) {
        context.globalAlpha = tileAlpha * (state === 'is-dimmed' ? 0.4 : 1);
        context.drawImage(label.image, box.x + 4 * scale, box.y + 4 * scale, label.width * scale, label.height * scale);
        context.globalAlpha = 1;
      } else {
        const lines = tileLines(context, tile, palette.font);
        title(context, box, tile.node.title, tileFontSize, color, tileAlpha * (state === 'is-dimmed' ? 0.4 : 1), 4 * scale, lines);
      }
    }
  }
}
