import { bezierProgress } from './knowledge-motion.js';

let transitionFontPromise;

// 加载与知识地图相同的字体
function loadTransitionFont() {
  if (!transitionFontPromise) {
    const font = new FontFace('KnowledgeMapTransition', `url("${import.meta.env.BASE_URL}typst/fonts/NotoSansSC.otf")`);
    transitionFontPromise = font.load().then((loaded) => {
      document.fonts.add(loaded);
      return loaded;
    }).catch((error) => {
      transitionFontPromise = null;
      throw error;
    });
  }
  return transitionFontPromise;
}

// 绘制知识点阅读过渡
export async function createKnowledgeTransition(canvas, title, geometry, origin, surface, textColor, glyphAdvance, beforeFrame) {
  if (!navigator.gpu) throw new Error('WebGPU 不可用');
  await loadTransitionFont();
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('WebGPU 不可用');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) { device.destroy(); throw new Error('WebGPU 画布不可用'); }
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });
  const shader = device.createShaderModule({ code: `
    struct State { viewport: vec4f, start: vec4f, finish: vec4f, origin: vec4f, surface: vec4f, textColor: vec4f, progress: vec4f, textVisibility: vec4f }
    @group(0) @binding(0) var<uniform> s: State;
    @group(0) @binding(1) var title: texture_2d<f32>;
    @group(0) @binding(2) var titleSampler: sampler;
    struct Out { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
    @vertex fn vs(@builtin(vertex_index) i: u32) -> Out {
      let p = array<vec2f, 6>(vec2f(-1.,-1.),vec2f(1.,-1.),vec2f(-1.,1.),vec2f(-1.,1.),vec2f(1.,-1.),vec2f(1.,1.));
      var o: Out; o.pos = vec4f(p[i],0.,1.); o.uv = vec2f((p[i].x+1.)*.5,(1.-p[i].y)*.5); return o;
    }
    @fragment fn fs(i: Out) -> @location(0) vec4f {
      let p = i.uv * s.viewport.xy;
      let t = s.progress.x;
      let wave = s.progress.y;
      let dim = s.progress.z;
      let box = mix(s.start, s.finish, t);
      let local = p - box.xy;
      let halfSize = box.zw * .5;
      let radius = min(mix(s.progress.w, 6., t), min(halfSize.x, halfSize.y));
      let delta = abs(local - halfSize) - (halfSize - vec2f(radius));
      let distance = length(max(delta, vec2f(0.))) + min(max(delta.x, delta.y), 0.) - radius;
      let edgeWidth = max(fwidth(distance), .001);
      let mask = 1. - smoothstep(-edgeWidth, edgeWidth, distance);
      let inside = mask > 0.;
      var color = vec4f(0.,0.,0.,.48 * dim);
      if (inside) {
        let center = box.zw * .5;
        let maxRadius = max(length(center), 1.);
        let direction = local - center;
        let distanceFromCenter = length(direction) / maxRadius;
        let angle = atan2(direction.y, direction.x + .0001);
        let ripple = sin(angle * 5. + distanceFromCenter * 8.) * .08;
        let field = clamp(distanceFromCenter * (1. + ripple), 0., 1.);
        let edge = wave * 1.3 - .15;
        let coverage = 1. - smoothstep(edge - .06, edge + .06, field);
        let glow = (1. - smoothstep(.0, .08, abs(field - edge))) * sin(wave * 3.14159265) * .10;
        let fill = mix(s.origin.rgb, s.surface.rgb, coverage) + vec3f(glow);
        color = mix(color, vec4f(fill, 1.), mask);
      }
      let titleStart = s.start.xy + vec2f(s.progress.w * 2.);
      let titleEnd = s.finish.xy + vec2f(20.,18.);
      let textPos = mix(titleStart, titleEnd, t);
      let titleUv = (p - textPos) / s.viewport.zw;
      if (inside && all(titleUv >= vec2f(0.)) && all(titleUv <= vec2f(1.))) {
        let ink = textureSampleLevel(title, titleSampler, titleUv, 0.).a * mask * mix(s.textVisibility.x, 1., t);
        color = vec4f(mix(color.rgb, s.textColor.rgb, ink), max(color.a, ink));
      }
      return vec4f(color.rgb * color.a, color.a);
    }` });
  const pipeline = await device.createRenderPipelineAsync({ layout: 'auto', vertex: { module: shader, entryPoint: 'vs' }, fragment: { module: shader, entryPoint: 'fs', targets: [{ format, blend: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } }] }, primitive: { topology: 'triangle-list' } });
  const textCanvas = document.createElement('canvas');
  const textWidth = 512;
  const textHeight = 128;
  textCanvas.width = textWidth * 2;
  textCanvas.height = textHeight * 2;
  const ctx = textCanvas.getContext('2d');
  const fontFamily = '"KnowledgeMapTransition", sans-serif';
  const texture = device.createTexture({ size: [textCanvas.width, textCanvas.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  let lastLayout = '';
  function updateTitle(progress, source, target, sourceFontSize) {
    const fontSize = Math.max(1, Math.round((sourceFontSize + (14 - sourceFontSize) * progress) * 4) / 4);
    const fontWeight = Math.round((400 + 200 * progress) / 25) * 25;
    const boxWidth = source[2] + (target[2] - source[2]) * progress;
    const sourcePadding = sourceFontSize * .8;
    const padding = sourcePadding + (56 - sourcePadding) * progress;
    const available = Math.max(1, Math.min(textWidth, boxWidth - padding));
    const layout = `${fontSize}:${fontWeight}:${available}`;
    if (layout === lastLayout) return;
    lastLayout = layout;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, textWidth, textHeight);
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    let x = 0;
    let y = fontSize * 1.16;
    const lineHeight = fontSize * 1.448;
    for (const character of Array.from(title)) {
      const mapAdvance = glyphAdvance?.(character);
      const canvasAdvance = ctx.measureText(character).width;
      const advance = mapAdvance === undefined ? canvasAdvance : mapAdvance * fontSize * (1 - progress) + canvasAdvance * progress;
      if (x > 0 && x + advance > available) {
        x = 0;
        y += lineHeight;
        if (y + lineHeight > textHeight) break;
      }
      ctx.fillText(character, x, y);
      x += advance;
    }
    device.queue.copyExternalImageToTexture({ source: textCanvas }, { texture }, [textCanvas.width, textCanvas.height]);
  }
  const uniform = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const binding = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: texture.createView() }, { binding: 2, resource: device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) }] });
  let frame = 0;
  let disposed = false;
  let resolvePending;
  function draw(progress, wave, dim) {
    beforeFrame?.();
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2, device.limits.maxTextureDimension2D / bounds.width, device.limits.maxTextureDimension2D / bounds.height);
    const width = Math.max(1, Math.floor(bounds.width * ratio)); const height = Math.max(1, Math.floor(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const { source, target, sourceFontSize, sourceOpacity } = geometry();
    updateTitle(progress, source, target, sourceFontSize);
    const values = new Float32Array([bounds.width, bounds.height, textWidth, textHeight, ...source, ...target, ...origin, ...surface, ...textColor, progress, wave, dim, sourceFontSize * .2, sourceOpacity, 0, 0, 0]);
    device.queue.writeBuffer(uniform, 0, values);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: [0, 0, 0, 0], loadOp: 'clear', storeOp: 'store' }] });
    pass.setPipeline(pipeline); pass.setBindGroup(0, binding); pass.draw(6); pass.end(); device.queue.submit([encoder.finish()]);
  }
  function play(reverse = false) {
    if (resolvePending) { cancelAnimationFrame(frame); resolvePending(false); }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 100 : 700;
    const started = performance.now();
    return new Promise((resolve, reject) => {
      resolvePending = resolve;
      const tick = (now) => {
        if (disposed) { resolvePending = null; resolve(false); return; }
        const raw = Math.min(1, (now - started) / duration);
        const movementProgress = bezierProgress(Math.min(1, raw / .78), .12, .85, .24, 1);
        const waveTime = reverse ? 1 - raw : raw;
        const waveProgress = bezierProgress(Math.max(0, Math.min(1, (waveTime - .40) / .60)), .33, 0, .2, 1);
        const dimProgress = bezierProgress(raw, .4, 0, .2, 1);
        const movement = reverse ? 1 - movementProgress : movementProgress;
        const wave = waveProgress;
        const dim = reverse ? 1 - dimProgress : dimProgress;
        try { draw(movement, wave, dim); }
        catch (error) { resolvePending = null; reject(error); return; }
        if (raw < 1) frame = requestAnimationFrame(tick);
        else { resolvePending = null; resolve(true); }
      };
      try { draw(reverse ? 1 : 0, reverse ? 1 : 0, reverse ? 1 : 0); }
      catch (error) { resolvePending = null; reject(error); return; }
      frame = requestAnimationFrame(tick);
    });
  }
  function dispose() { disposed = true; cancelAnimationFrame(frame); resolvePending?.(false); uniform.destroy(); texture.destroy(); context.unconfigure(); device.destroy(); }
  return { play, dispose };
}
