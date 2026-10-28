import { bezierProgress } from './knowledge-motion.js';
import { readGlyphCache, writeGlyphCache } from './knowledge-glyph-cache.js';

export async function createKnowledgeRenderer(canvas, onLost, onLoading, onMissingGlyphs) {
  const rendererStart = performance.now();
  console.info('[知识地图] 开始初始化 WebGPU');
  if (!navigator.gpu) throw new Error('当前浏览器不支持 WebGPU');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('无法获取 WebGPU 适配器');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) { device.destroy(); throw new Error('无法创建 WebGPU 画布'); }
  const atlasWidth = 2048;
  const atlasHeight = 1024;
  const distanceRange = 8;
  const lineHeight = 1.448;
  const ascender = -1.16;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });
  let disposed = false;
  device.lost.then((info) => { if (!disposed) onLost?.(info); });

  const common = `
    struct Uniforms {
      transform: vec4f,
      viewport: vec4f,
      textColor: vec4f,
      labelAlpha: vec4f,
    }
    @group(0) @binding(0) var<uniform> u: Uniforms;
    fn clipPosition(p: vec2f) -> vec4f {
      let screen = p * u.transform.z + u.transform.xy;
      let clip = screen / u.viewport.xy * 2.0 - vec2f(1.0);
      return vec4f(clip.x, -clip.y, 0.0, 1.0);
    }
  `;
  const shapeShader = device.createShaderModule({ code: common + `
    struct Input { @location(0) position: vec2f, @location(1) bounds: vec4f, @location(2) color: vec4f, @location(3) border: f32, @location(4) transition: f32 }
    struct Output { @builtin(position) position: vec4f, @location(0) world: vec2f, @location(1) bounds: vec4f, @location(2) color: vec4f, @location(3) border: f32, @location(4) transition: f32 }
    @vertex fn vs(input: Input) -> Output {
      var out: Output;
      out.position = clipPosition(input.position);
      out.world = input.position;
      out.bounds = input.bounds;
      out.color = input.color;
      out.border = input.border;
      out.transition = input.transition;
      return out;
    }
    @fragment fn fs(input: Output) -> @location(0) vec4f {
      let halfSize = input.bounds.zw * 0.5;
      let radius = select(min(2.0, min(halfSize.x, halfSize.y)), 0.0, input.border < 0.0);
      let delta = abs(input.world - (input.bounds.xy + halfSize)) - (halfSize - vec2f(radius));
      let dist = length(max(delta, vec2f(0.0))) + min(max(delta.x, delta.y), 0.0) - radius;
      let aa = min(u.transform.w, max(radius, 0.5));
      var coverage = select(1.0 - smoothstep(-aa, 0.0, dist), 1.0, input.border < 0.0);
      if (input.border > 0.0) {
        let innerPixels = -dist * u.transform.z;
        let transition = 0.5 / u.viewport.z;
        coverage *= (1.0 - smoothstep(input.border - transition, input.border + transition, innerPixels)) * smoothstep(0.2, 0.4, u.transform.z);
      }
      if (input.border < 0.0) { coverage *= 1.0 - smoothstep(0.4, 0.8, u.transform.z); }
      var transitionAlpha = 1.0;
      if (input.transition > 0.5) { transitionAlpha = u.labelAlpha.w; }
      else if (input.transition < -0.5) { transitionAlpha = 1.0 - u.labelAlpha.w; }
      let alpha = input.color.a * coverage * transitionAlpha;
      return vec4f(input.color.rgb * alpha, alpha);
    }
  ` });
  const textShader = device.createShaderModule({ code: common + `
    @group(0) @binding(1) var atlas: texture_2d<f32>;
    @group(0) @binding(2) var atlasSampler: sampler;
    struct Input { @location(0) position: vec2f, @location(1) uv: vec2f, @location(2) alpha: f32, @location(3) level: f32, @location(4) anchor: vec2f, @location(5) scroll: vec3f, @location(6) previousAlpha: f32, @location(7) color: vec3f }
    struct Output { @builtin(position) position: vec4f, @location(0) uv: vec2f, @location(1) alpha: f32, @location(2) worldX: f32, @location(3) bounds: vec2f, @location(4) color: vec3f }
    @vertex fn vs(input: Input) -> Output {
      var out: Output;
      let duration = input.scroll.z / 18.0;
      let cycle = max(2.0 * duration + 2.0, 2.0);
      let phase = u.viewport.w - floor(u.viewport.w / cycle) * cycle;
      let offset = min(input.scroll.z, max(0.0, min(phase - 1.0, cycle - phase) * 18.0));
      let world = input.position - vec2f(offset, 0.0);
      let screen = world * u.transform.z + u.transform.xy;
      out.worldX = world.x;
      out.bounds = input.scroll.xy;
      let clip = screen / u.viewport.xy * 2.0 - vec2f(1.0);
      out.position = vec4f(clip.x, -clip.y, 0.0, 1.0);
      out.uv = input.uv;
      out.color = input.color;
      var levelAlpha = u.labelAlpha.z;
      if (input.level < 0.5) { levelAlpha = u.labelAlpha.x; }
      else if (input.level < 1.5) { levelAlpha = u.labelAlpha.y; }
      out.alpha = mix(input.previousAlpha, input.alpha, u.labelAlpha.w) * levelAlpha;
      return out;
    }
    @fragment fn fs(input: Output) -> @location(0) vec4f {
      let sample = textureSample(atlas, atlasSampler, input.uv).rgb;
      let distance = max(min(sample.r, sample.g), min(max(sample.r, sample.g), sample.b)) - 0.5;
      let unitRange = vec2f(${distanceRange.toFixed(1)}) / vec2f(${atlasWidth.toFixed(1)}, ${atlasHeight.toFixed(1)});
      let screenSize = vec2f(1.0) / max(fwidth(input.uv), vec2f(0.000001));
      let screenRange = max(0.5 * dot(unitRange, screenSize), 1.0);
      let inside = select(0.0, 1.0, input.worldX >= input.bounds.x && input.worldX <= input.bounds.y);
      let alpha = clamp(distance * screenRange + 0.5, 0.0, 1.0) * u.textColor.a * input.alpha * inside;
      return vec4f(input.color * alpha, alpha);
    }
  ` });
  const blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
  const [shapePipeline, textPipeline] = await Promise.all([
    device.createRenderPipelineAsync({ layout: 'auto', vertex: { module: shapeShader, entryPoint: 'vs', buffers: [{ arrayStride: 48, attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x4' },
      { shaderLocation: 2, offset: 24, format: 'float32x4' }, { shaderLocation: 3, offset: 40, format: 'float32' }, { shaderLocation: 4, offset: 44, format: 'float32' }
    ] }] }, fragment: { module: shapeShader, entryPoint: 'fs', targets: [{ format, blend }] }, primitive: { topology: 'triangle-list' } }),
    device.createRenderPipelineAsync({ layout: 'auto', vertex: { module: textShader, entryPoint: 'vs', buffers: [{ arrayStride: 60, attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x2' },
      { shaderLocation: 2, offset: 16, format: 'float32' }, { shaderLocation: 3, offset: 20, format: 'float32' },
      { shaderLocation: 4, offset: 24, format: 'float32x2' }, { shaderLocation: 5, offset: 32, format: 'float32x3' }, { shaderLocation: 6, offset: 44, format: 'float32' }, { shaderLocation: 7, offset: 48, format: 'float32x3' }
    ] }] }, fragment: { module: textShader, entryPoint: 'fs', targets: [{ format, blend }] }, primitive: { topology: 'triangle-list' } })
  ]).catch((error) => { device.destroy(); throw error; });
  console.info(`[知识地图] WebGPU 初始化完成，耗时 ${Math.round(performance.now() - rendererStart)} ms`);

  const uniform = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const glyphs = new Map();
  const sampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
  const shapeBindings = device.createBindGroup({ layout: shapePipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniform } }] });
  const makePage = (pageTexture) => ({
    texture: pageTexture,
    bindings: device.createBindGroup({ layout: textPipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: pageTexture.createView() }, { binding: 2, resource: sampler }
    ] }),
    count: 0,
    buffer: null,
    used: 0
  });
  const pages = [];
  const absentGlyphs = new Set();
  let workersPromise = null;
  const workers = [];
  let generationQueue = Promise.resolve();
  let sceneSequence = 0;

  function createWorker() {
    const worker = new Worker(new URL('./knowledge-glyph-worker.js', import.meta.url), { type: 'module' });
    const pending = new Map();
    let nextId = 0;
    let failure = null;
    const fail = (error) => {
      failure = error;
      for (const request of pending.values()) request.reject(error);
      pending.clear();
    };
    worker.onmessage = ({ data }) => {
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.result);
    };
    worker.onerror = (event) => fail(new Error(event.message || '字形工作线程异常'));
    worker.onmessageerror = () => fail(new Error('字形工作线程消息无法读取'));
    const entry = {
      request(type, payload) {
        if (failure) return Promise.reject(failure);
        return new Promise((resolve, reject) => {
          const id = ++nextId;
          pending.set(id, { resolve, reject });
          try { worker.postMessage({ id, type, ...payload }); }
          catch (error) { pending.delete(id); reject(error); }
        });
      },
      dispose() {
        fail(new Error('字形工作线程已停止'));
        worker.terminate();
      }
    };
    workers.push(entry);
    return entry;
  }

  async function loadWorkers(taskCount) {
    if (!workersPromise) {
      workersPromise = (async () => {
        const started = performance.now();
        console.info('[知识地图] 开始下载字体文件');
        const response = await fetch(`${import.meta.env.BASE_URL}typst/fonts/NotoSansSC.otf`);
        if (!response.ok) throw new Error(`无法读取字体文件，HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        console.info(`[知识地图] 字体下载完成，大小 ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB，耗时 ${Math.round(performance.now() - started)} ms`);
        return bytes;
      })().catch((error) => { workersPromise = null; throw error; });
    }
    const bytes = await workersPromise;
    if (disposed) return [];
    const workerCount = Math.min(taskCount, Math.max(1, Math.floor(navigator.hardwareConcurrency || 1)));
    const added = Array.from({ length: Math.max(0, workerCount - workers.length) }, () => createWorker());
    if (added.length) {
      const started = performance.now();
      await Promise.all(added.map((worker) => worker.request('initialize', { bytes })));
      console.info(`[知识地图] 新增 ${added.length} 个字形线程，耗时 ${Math.round(performance.now() - started)} ms`);
    }
    return workers.slice(0, workerCount);
  }

  async function generateMissing(codepoints) {
    const missing = codepoints.filter((codepoint) => !glyphs.has(codepoint) && !absentGlyphs.has(codepoint));
    if (!missing.length || disposed) return;
    const started = performance.now();
    const size = 64;
    const slot = size + 2;
    const columns = Math.floor(atlasWidth / slot);
    const capacity = columns * Math.floor(atlasHeight / slot);
    const generated = [];
    console.info(`[知识地图] 开始准备 ${missing.length} 个新字形，已缓存 ${glyphs.size} 个`);
    onLoading?.(true);
    const addGlyph = (codepoint, result) => {
      if (!result) { absentGlyphs.add(codepoint); return; }
      let page = pages[pages.length - 1];
      if (!page || page.used >= capacity) {
        page = makePage(device.createTexture({ size: [atlasWidth, atlasHeight], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST }));
        pages.push(page);
      }
      const x = (page.used % columns) * slot + 1;
      const y = Math.floor(page.used / columns) * slot + 1;
      page.used++;
      device.queue.writeTexture({ texture: page.texture, origin: [x, y] }, result.rgba, { bytesPerRow: size * 4, rowsPerImage: size }, [size, size]);
      glyphs.set(codepoint, {
        advance: result.advance,
        page: pages.length - 1,
        planeBounds: result.boundsL !== result.boundsR || result.boundsB !== result.boundsT
          ? { left: -result.translateX, right: 2 - result.translateX, top: result.translateY - 2, bottom: result.translateY }
          : null,
        atlasBounds: { left: x, right: x + size, top: y, bottom: y + size }
      });
    };
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      let cached = new Map();
      try { cached = await readGlyphCache(missing); }
      catch (error) { console.warn('[知识地图] 无法读取字形缓存，将重新生成', error); }
      if (disposed) return;
      for (const [codepoint, result] of cached) addGlyph(codepoint, result);
      const pending = missing.filter((codepoint) => !cached.has(codepoint));
      console.info(`[知识地图] 字形缓存命中 ${cached.size} 个，需生成 ${pending.length} 个`);
      if (pending.length) {
        const pool = await loadWorkers(pending.length);
        if (!pool.length || disposed) return;
        let next = 0;
        let done = 0;
        await Promise.all(pool.map(async (worker) => {
          while (!disposed && next < pending.length) {
            const codepoint = pending[next++];
            const result = await worker.request('generate', { codepoint, size, range: distanceRange });
            if (disposed) return;
            addGlyph(codepoint, result);
            generated.push([codepoint, result]);
            done++;
            if (done % 32 === 0 || done === pending.length) console.info(`[知识地图] 已生成 ${done} / ${pending.length} 个字形，耗时 ${Math.round(performance.now() - started)} ms`);
          }
        }));
      }
      if (!disposed) onMissingGlyphs?.([...absentGlyphs]);
    } catch (error) {
      for (const worker of workers.splice(0)) worker.dispose();
      workersPromise = null;
      console.error('[知识地图] 字形生成失败', error);
      throw error;
    } finally {
      if (generated.length) {
        try { await writeGlyphCache(generated); }
        catch (error) { console.warn('[知识地图] 无法保存字形缓存', error); }
      }
      console.info(`[知识地图] 字形准备${disposed ? '已中止' : '结束'}，耗时 ${Math.round(performance.now() - started)} ms，已缓存 ${glyphs.size} 个，缺失 ${absentGlyphs.size} 个，图集 ${pages.length} 页`);
      if (!disposed) onLoading?.(false);
    }
  }
  let shapeBuffer = null;
  let shapeCount = 0;
  let scrollLevels = new Set();
  let previousStates = new Map();
  let transitionFromStates = new Map();
  let transitionStarted = 0;
  const transitionDuration = 200;

  function makeBuffer(values) {
    const data = new Float32Array(values);
    const buffer = device.createBuffer({ size: Math.max(4, data.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    if (data.byteLength) device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }
  async function setTiles(tiles, relation, fontFamily, groups, mastered, palette) {
    if (disposed) return false;
    const sequence = ++sceneSequence;
    const nextStates = new Map(tiles.map((tile) => [tile.node.id, relation(tile.node)]));
    const changed = tiles.some((tile) => previousStates.has(tile.node.id) && previousStates.get(tile.node.id) !== nextStates.get(tile.node.id));
    const ongoing = transitionStarted && performance.now() - transitionStarted < transitionDuration;
    const fromStates = changed || !ongoing ? previousStates : transitionFromStates;
    const labels = [
      ...tiles.map((tile) => ({ ...tile, text: tile.node.title, fontSize: 10, level: 2, color: mastered(tile.node) ? palette.masteredText : palette.text, alpha: nextStates.get(tile.node.id) === 'is-dimmed' ? 0.4 : 1, previousAlpha: (fromStates.get(tile.node.id) ?? nextStates.get(tile.node.id)) === 'is-dimmed' ? 0.4 : 1 })),
      ...groups.map((group) => ({ style: group.style, text: group.title, fontSize: group.fontSize, level: group.kind === 'domain' ? 0 : 1, color: palette.text, alpha: 1, previousAlpha: 1 }))
    ];
    const codepoints = [...new Set(labels.flatMap((label) => Array.from(label.text, (character) => character.codePointAt(0))))];
    if (codepoints.length && !codepoints.includes(63)) codepoints.push(63);
    const job = generationQueue.then(() => generateMissing(codepoints));
    generationQueue = job.catch(() => {});
    await job;
    if (disposed || sequence !== sceneSequence) return false;
    const shapes = [];
    let hasTransition = false;
    const shape = (style, color, inset = 0, border = 0, transition = 0) => {
      const x = parseFloat(style.left) + inset;
      const y = parseFloat(style.top) + inset;
      const width = Math.max(0, parseFloat(style.width) - inset * 2);
      const height = Math.max(0, parseFloat(style.height) - inset * 2);
      if (!width || !height) return;
      const push = (px, py) => shapes.push(px, py, x, y, width, height, ...color, border, transition);
      push(x, y); push(x + width, y); push(x, y + height);
      push(x, y + height); push(x + width, y); push(x + width, y + height);
    };
    for (const group of groups) shape(group.style, group.isLibrary ? palette.library : group.kind === 'domain' ? palette.domain : palette.topic);
    const regions = new Map();
    for (const tile of tiles) {
      const state = nextStates.get(tile.node.id);
      if (state !== '') continue;
      const known = mastered(tile.node);
      const previous = fromStates.get(tile.node.id);
      const transition = previous !== undefined && previous !== state ? 1 : 0;
      const key = JSON.stringify([tile.node.domain_id, tile.node.topic_id, known, transition]);
      if (!regions.has(key)) regions.set(key, { color: known ? palette.mastered : palette.unmastered, rectangles: [], transition });
      const x = parseFloat(tile.style.left);
      const y = parseFloat(tile.style.top);
      regions.get(key).rectangles.push({ left: x - 1, top: y - 1, right: x + parseFloat(tile.style.width) + 1, bottom: y + parseFloat(tile.style.height) + 1 });
    }
    for (const region of regions.values()) {
      const edges = [...new Set(region.rectangles.flatMap((rect) => [rect.left, rect.right]))].sort((a, b) => a - b);
      let active = new Map();
      for (let i = 0; i < edges.length - 1; i++) {
        const left = edges[i];
        const right = edges[i + 1];
        const intervals = region.rectangles.filter((rect) => rect.left < right && rect.right > left)
          .map((rect) => [rect.top, rect.bottom]).sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const interval of intervals) {
          const last = merged[merged.length - 1];
          if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
          else merged.push([...interval]);
        }
        const next = new Map();
        for (const [top, bottom] of merged) {
          const key = `${top}:${bottom}`;
          const previous = active.get(key);
          next.set(key, previous ? { ...previous, right } : { left, right, top, bottom });
        }
        for (const [key, rect] of active) {
          if (!next.has(key)) shape({ left: rect.left, top: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top }, region.color, 0, -1, region.transition);
        }
        active = next;
      }
      for (const rect of active.values()) shape({ left: rect.left, top: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top }, region.color, 0, -1, region.transition);
    }
    const drawTile = (tile, state, transition) => {
      const marker = state === 'is-prerequisite' ? palette.before : state === 'is-successor' ? palette.after : null;
      const base = mastered(tile.node) ? palette.mastered : palette.unmastered;
      const isRelation = state === 'is-prerequisite' || state === 'is-successor';
      const fill = state === 'is-selected' ? base.map((value, index) => index < 3 ? value * 0.88 + 0.12 : value) : base;
      shape(tile.style, state === 'is-dimmed' ? [fill[0], fill[1], fill[2], fill[3] * 0.4] : fill, 0, 0, transition);
      const width = parseFloat(tile.style.width);
      const height = parseFloat(tile.style.height);
      if (isRelation && width >= 20 && height >= 20) {
        shape({ left: `${parseFloat(tile.style.left) + width - 11}px`, top: `${parseFloat(tile.style.top) + height - 11}px`, width: '7px', height: '7px' }, marker, 0, 0, transition);
      }
    };
    for (const tile of tiles) {
      const state = nextStates.get(tile.node.id);
      const previous = fromStates.get(tile.node.id);
      if (previous !== undefined && previous !== state) {
        hasTransition = true;
        drawTile(tile, previous, -1);
        drawTile(tile, state, 1);
      } else drawTile(tile, state, 0);
    }
    for (const group of [...groups].sort((a, b) => Number(a.kind === 'domain') - Number(b.kind === 'domain'))) {
      shape(group.style, group.kind === 'domain' ? palette.domainBorder : palette.topicBorder, 0, group.kind === 'domain' ? 1.5 : 0.8);
    }
    shapeCount = shapes.length / 12;
    const nextShapes = makeBuffer(shapes);
    shapeBuffer?.destroy();
    shapeBuffer = nextShapes;

    const vertices = pages.map(() => []);
    const nextScrollLevels = new Set();
    let textColor;
    const push = (page, x, y, u, v, alpha, level, anchorX, anchorY, clipLeft, clipRight, scroll, previousAlpha) => vertices[page].push(x, y, u, v, alpha, level, anchorX, anchorY, clipLeft, clipRight, scroll, previousAlpha, ...textColor);
    for (const label of labels) {
      textColor = label.color.slice(0, 3);
      const x = parseFloat(label.style.left);
      const y = parseFloat(label.style.top);
      const width = parseFloat(label.style.width);
      const height = parseFloat(label.style.height);
      const margin = label.level === 0 ? 12 : label.level === 1 ? 8 : 4;
      const right = x + width - margin;
      const bottom = y + height - margin;
      let cursorX = x + margin;
      let cursorY = y + (label.level === 0 ? 9 : label.level === 1 ? 5 : 4);
      const anchorX = cursorX;
      const anchorY = cursorY;
      const textWidth = Array.from(label.text).reduce((sum, character) => sum + ((glyphs.get(character.codePointAt(0)) || glyphs.get(63))?.advance || 0) * label.fontSize, 0);
      const scroll = label.level < 2 ? Math.max(0, textWidth - Math.max(0, right - cursorX)) : 0;
      if (scroll > 0 && width > margin * 2 && height >= label.fontSize + margin * 2) nextScrollLevels.add(label.level);
      for (const character of label.text) {
        const glyph = glyphs.get(character.codePointAt(0)) || glyphs.get(63);
        if (!glyph) continue;
        const advance = glyph.advance * label.fontSize;
        if (cursorX > x + margin && cursorX + advance > right) {
          if (label.level === 2) { cursorX = x + margin; cursorY += lineHeight * label.fontSize; }
        }
        if (cursorY + label.fontSize > bottom) break;
        if (!glyph.planeBounds || !glyph.atlasBounds) { cursorX += advance; continue; }
        const baseline = cursorY - ascender * label.fontSize;
        const left = cursorX + glyph.planeBounds.left * label.fontSize;
        const top = baseline + glyph.planeBounds.top * label.fontSize;
        const glyphWidth = (glyph.planeBounds.right - glyph.planeBounds.left) * label.fontSize;
        const glyphHeight = (glyph.planeBounds.bottom - glyph.planeBounds.top) * label.fontSize;
        const clippedLeft = label.level < 2 ? left : Math.max(left, x + margin);
        const clippedTop = Math.max(top, y + (label.level === 0 ? 9 : label.level === 1 ? 5 : 4));
        const clippedRight = label.level < 2 ? left + glyphWidth : Math.min(left + glyphWidth, right);
        const clippedBottom = Math.min(top + glyphHeight, bottom);
        if (glyphWidth > 0 && glyphHeight > 0 && clippedRight > clippedLeft && clippedBottom > clippedTop) {
          const atlasGlyphWidth = glyph.atlasBounds.right - glyph.atlasBounds.left;
          const atlasGlyphHeight = glyph.atlasBounds.bottom - glyph.atlasBounds.top;
          const u0 = (glyph.atlasBounds.left + (clippedLeft - left) / glyphWidth * atlasGlyphWidth) / atlasWidth;
          const v0 = (glyph.atlasBounds.top + (clippedTop - top) / glyphHeight * atlasGlyphHeight) / atlasHeight;
          const u1 = (glyph.atlasBounds.left + (clippedRight - left) / glyphWidth * atlasGlyphWidth) / atlasWidth;
          const v1 = (glyph.atlasBounds.top + (clippedBottom - top) / glyphHeight * atlasGlyphHeight) / atlasHeight;
          push(glyph.page, clippedLeft, clippedTop, u0, v0, label.alpha, label.level, anchorX, anchorY, x + margin, right, scroll, label.previousAlpha); push(glyph.page, clippedRight, clippedTop, u1, v0, label.alpha, label.level, anchorX, anchorY, x + margin, right, scroll, label.previousAlpha); push(glyph.page, clippedLeft, clippedBottom, u0, v1, label.alpha, label.level, anchorX, anchorY, x + margin, right, scroll, label.previousAlpha);
          push(glyph.page, clippedLeft, clippedBottom, u0, v1, label.alpha, label.level, anchorX, anchorY, x + margin, right, scroll, label.previousAlpha); push(glyph.page, clippedRight, clippedTop, u1, v0, label.alpha, label.level, anchorX, anchorY, x + margin, right, scroll, label.previousAlpha); push(glyph.page, clippedRight, clippedBottom, u1, v1, label.alpha, label.level, anchorX, anchorY, x + margin, right, scroll, label.previousAlpha);
        }
        cursorX += advance;
      }
    }
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      page.count = vertices[i].length / 15;
      page.buffer?.destroy();
      page.buffer = makeBuffer(vertices[i]);
    }
    scrollLevels = nextScrollLevels;
    if (changed) { transitionFromStates = previousStates; transitionStarted = performance.now(); }
    else if (!hasTransition) transitionStarted = 0;
    previousStates = nextStates;
    return true;
  }
  function draw(transform, width, height, color, labelAlpha, animate) {
    if (disposed || !width || !height || !shapeBuffer) return;
    const maxDimension = device.limits.maxTextureDimension2D;
    const maxPixels = 8_000_000;
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5, maxDimension / width, maxDimension / height, Math.sqrt(maxPixels / (width * height)));
    const pixelWidth = Math.max(1, Math.min(maxDimension, Math.floor(width * ratio)));
    const pixelHeight = Math.max(1, Math.min(maxDimension, Math.floor(height * ratio)));
    const pixelRatio = Math.min(pixelWidth / width, pixelHeight / height);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
    const now = performance.now();
    const progress = animate && transitionStarted ? Math.min(1, (now - transitionStarted) / transitionDuration) : 1;
    const transition = bezierProgress(progress, .16, 1, .3, 1);
    const values = new Float32Array([transform.x, transform.y, transform.k, 0.75 / (transform.k * pixelRatio), width, height, pixelRatio, animate ? now / 1000 : 0, ...color, ...labelAlpha, transition]);
    device.queue.writeBuffer(uniform, 0, values);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: [0, 0, 0, 0], loadOp: 'clear', storeOp: 'store' }] });
    pass.setPipeline(shapePipeline);
    pass.setBindGroup(0, shapeBindings);
    pass.setVertexBuffer(0, shapeBuffer);
    pass.draw(shapeCount);
    if (labelAlpha.some((alpha) => alpha > 0)) {
      pass.setPipeline(textPipeline);
      for (const page of pages) {
        if (!page.count || !page.buffer) continue;
        pass.setBindGroup(0, page.bindings);
        pass.setVertexBuffer(0, page.buffer);
        pass.draw(page.count);
      }
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
    return animate && (progress < 1 || [...scrollLevels].some((level) => labelAlpha[level] > 0));
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    shapeBuffer?.destroy();
    for (const page of pages) { page.buffer?.destroy(); page.texture.destroy(); }
    for (const worker of workers.splice(0)) worker.dispose();
    uniform.destroy();
    context.unconfigure();
    device.destroy();
  }
  const glyphAdvance = (character) => (glyphs.get(character.codePointAt(0)) || glyphs.get(63))?.advance;
  return { setTiles, draw, dispose, glyphAdvance };
}
