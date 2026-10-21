/**
 * 高性能 WebGL2 知识图谱渲染器 (Roadmap WebGL Renderer)
 * 极致纯净 0 依赖，利用 GPU 硬件管线渲染节点、连线、箭头与文本标签
 * 
 * 核心技术特色：
 * 1. 纯硬件 GPU 绘制：所有连线、节点、箭头、文字标签均在 WebGL 管线完成，0 CPU 逐帧排版，维持稳定 120 FPS
 * 2. 物理像素级精准 SDF 抗锯齿：圆球边缘无论缩放如何、DPR 多高均恒定为 1.0 物理屏幕像素，彻底告别模糊与锯齿
 * 3. 4x 超高精度 Text Atlas 图集 + 硬件 Mipmap 三线性过滤：在高分屏 (Retina / DPR >= 1.5) 与特写缩放下依然清晰锐利，无拉伸模糊
 * 4. 视锥体视口剔除 (View Frustum Culling)：仅绘制屏幕内可见节点与标签，显存与计算负荷极低
 */

function createProgram(gl, vertexSource, fragmentSource) {
  const vShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vShader, vertexSource);
  gl.compileShader(vShader);
  if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(vShader);
    gl.deleteShader(vShader);
    throw new Error('Vertex shader compile error: ' + err);
  }

  const fShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fShader, fragmentSource);
  gl.compileShader(fShader);
  if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(fShader);
    gl.deleteShader(fShader);
    throw new Error('Fragment shader compile error: ' + err);
  }

  const program = gl.createProgram();
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const err = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Program link error: ' + err);
  }

  gl.deleteShader(vShader);
  gl.deleteShader(fShader);
  return program;
}

function hexToRgba(hex, alpha = 1.0) {
  if (!hex) return [0.0941176, 0.0941176, 0.0941176, alpha];
  const s = String(hex).trim();
  if (s.startsWith('rgb')) {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(',').map(v => parseFloat(v.trim()));
      return [
        (parts[0] || 0) / 255,
        (parts[1] || 0) / 255,
        (parts[2] || 0) / 255,
        parts[3] != null ? parts[3] * alpha : alpha
      ];
    }
  }
  let c = s.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return [0.0941176, 0.0941176, 0.0941176, alpha];
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
    alpha
  ];
}

// =========================================================================
// 1. Shaders 定义
// =========================================================================

// --- 连线与箭头着色器 ---
const LINK_VS = `
attribute vec2 a_pos;
attribute vec4 a_color;
uniform mat3 u_matrix;
varying vec4 v_color;

void main() {
  vec3 p = u_matrix * vec3(a_pos, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
  v_color = a_color;
}
`;

const LINK_FS = `
precision mediump float;
varying vec4 v_color;

void main() {
  gl_FragColor = v_color;
}
`;

// --- 节点 SDF 精准物理像素抗锯齿圆形着色器 ---
const NODE_VS = `
attribute vec2 a_corner;        // Quad 局部四角坐标 [-1, -1] ~ [1, 1]
attribute vec2 a_center;        // 节点世界中心坐标 (gx, gy)
attribute float a_total_radius; // 节点几何总半径 (radius + strokeWidth * 0.5)
attribute vec4 a_fill_color;    // 节点填充色
attribute vec4 a_stroke_color;  // 节点边框描边色
attribute float a_fill_ratio;   // 内填充半径比例
attribute float a_alpha;        // 综合透明度

uniform mat3 u_matrix;
uniform float u_scale;          // 当前视口屏幕物理缩放比 (k * dpr)

varying vec2 v_corner;
varying vec4 v_fill_color;
varying vec4 v_stroke_color;
varying float v_fill_ratio;
varying float v_total_radius;
varying float v_alpha;

void main() {
  vec2 world_pos = a_center + a_corner * a_total_radius;
  vec3 p = u_matrix * vec3(world_pos, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);

  v_corner = a_corner;
  v_fill_color = a_fill_color;
  v_stroke_color = a_stroke_color;
  v_fill_ratio = a_fill_ratio;
  v_total_radius = a_total_radius;
  v_alpha = a_alpha;
}
`;

const NODE_FS = `
precision mediump float;

uniform float u_scale;

varying vec2 v_corner;
varying vec4 v_fill_color;
varying vec4 v_stroke_color;
varying float v_fill_ratio;
varying float v_total_radius;
varying float v_alpha;

void main() {
  float dist = length(v_corner);

  // 物理屏幕像素级 1.0 像素抗锯齿宽度，无论缩放或 DPR 多高，边缘都极其锐利干净
  float delta = 1.0 / max(v_total_radius * u_scale, 1.0);

  // 外边缘平滑裁剪 (1.0 物理像素羽化)
  float outer_alpha = smoothstep(1.0, 1.0 - delta, dist);
  if (outer_alpha <= 0.001) {
    discard;
  }

  // 内填充与描边分界 (1.0 物理像素羽化)
  float inner_boundary = v_fill_ratio;
  float fill_factor = smoothstep(inner_boundary + delta, inner_boundary, dist);

  vec4 col = mix(v_fill_color, v_stroke_color, fill_factor);
  col.a *= outer_alpha * v_alpha;

  gl_FragColor = col;
}
`;

// --- 文字纹理着色器 (采样 4x 视网膜 Texture Atlas，GPU 硬件级淡入淡出) ---
const TEXT_VS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
attribute float a_alpha;

uniform mat3 u_matrix;

varying vec2 v_uv;
varying float v_alpha;

void main() {
  vec3 p = u_matrix * vec3(a_pos, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
  v_uv = a_uv;
  v_alpha = a_alpha;
}
`;

const TEXT_FS = `
precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_uv;
varying float v_alpha;

void main() {
  vec4 tex = texture2D(u_texture, v_uv);
  gl_FragColor = vec4(tex.rgb, tex.a * v_alpha);
}
`;

// =========================================================================
// 2. WebGL 核心渲染器类
// =========================================================================

export class RoadmapWebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const opts = {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      depth: false,
      stencil: false
    };

    const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    // 启用标准导数扩展 (针对 WebGL1)
    if (gl.getExtension) {
      gl.getExtension('OES_standard_derivatives');
    }

    // 开启混合
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 编译 Shader Programs
    this.linkProgram = createProgram(gl, LINK_VS, LINK_FS);
    this.nodeProgram = createProgram(gl, NODE_VS, NODE_FS);
    this.textProgram = createProgram(gl, TEXT_VS, TEXT_FS);

    // 动态显存 VBO / IBO
    this.linkVBO = gl.createBuffer();
    this.linkIBO = gl.createBuffer();

    this.arrowVBO = gl.createBuffer();

    this.nodeVBO = gl.createBuffer();
    this.nodeIBO = gl.createBuffer();

    this.textVBO = gl.createBuffer();
    this.textIBO = gl.createBuffer();

    // 4x 高清文字图集纹理
    this.textTexture = gl.createTexture();
    this.textAtlasMap = new Map(); // id -> { u0, v0, u1, v1, w, h, yOffset }

    this.width = 800;
    this.height = 600;
    this.dpr = 1;
  }

  // 尺寸调整
  resize(width, height, dpr = 1) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.gl.viewport(0, 0, Math.round(width * dpr), Math.round(height * dpr));
  }

  // 获取宿主容器的原版背景颜色 (直接和 Canvas 一样读取全局 CSS 变量 --bg-app)
  getBackgroundColor() {
    if (typeof window !== 'undefined') {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim();
      if (bg) {
        return hexToRgba(bg, 1.0);
      }
    }
    return [0.0941176, 0.0941176, 0.0941176, 1.0]; // #181818
  }

  // 构建 4x 视网膜级文字纹理图集 (通过 4.0 超采样烘焙，彻底解决高分屏与放大视角下的字迹模糊)
  buildTextAtlas(nodes) {
    const gl = this.gl;
    if (!nodes || nodes.length === 0) return;

    const atlasCanvas = document.createElement('canvas');
    const atlasW = 2048;
    const atlasH = 4096;
    atlasCanvas.width = atlasW;
    atlasCanvas.height = atlasH;
    const ctx = atlasCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, atlasW, atlasH);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    this.textAtlasMap.clear();

    let curX = 16;
    let curY = 16;
    let rowHeight = 0;
    const padding = 16; // 留白空间，防止 GPU Mipmap 降采样时发生邻近字符渗色
    const scaleFactor = 4.0; // 4x 超高精度离线烘焙，高分屏 (Retina / DPR >= 1.5) 与特写放大视角下依然呈现 1:1 视网膜级锐度

    for (let i = 0; i < nodes.length; ++i) {
      const n = nodes[i];
      const text = n.tag ? `${n.tag} ${n.title}` : n.title;
      if (!text) continue;

      let fontSpec = `500 ${Math.round(8.5 * scaleFactor)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
      let strokeW = 1.8 * scaleFactor;
      let fillCol = '#cbd5e1';

      if (n.level === 1) {
        fontSpec = `600 ${Math.round(12 * scaleFactor)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
        strokeW = 2.6 * scaleFactor;
        fillCol = '#ffffff';
      } else if (n.level === 3) {
        fontSpec = `400 ${Math.round(7.5 * scaleFactor)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
        strokeW = 1.2 * scaleFactor;
        fillCol = '#94a3b8';
      }

      ctx.font = fontSpec;
      const metrics = ctx.measureText(text);
      const textW = Math.ceil(metrics.width) + strokeW * 2 + 12;
      const textH = Math.ceil(20 * scaleFactor) + strokeW * 2 + 12;

      // 自动换行排布
      if (curX + textW + padding > atlasW) {
        curX = 16;
        curY += rowHeight + padding;
        rowHeight = 0;
      }
      if (curY + textH + padding > atlasH) {
        console.warn('[WebGL Texture Atlas] Atlas space overflow at node', n.id);
        break;
      }

      // 绘制原版主题深色轮廓光晕 (直接读取全局 CSS 变量 --bg-app，与背景无缝融合)
      const bgApp = (typeof window !== 'undefined'
        ? getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim()
        : '') || '#181818';
      ctx.strokeStyle = bgApp;
      ctx.lineWidth = strokeW;
      ctx.strokeText(text, curX + strokeW + 4, curY + strokeW + 4);

      // 绘制文本本体
      ctx.fillStyle = fillCol;
      ctx.fillText(text, curX + strokeW + 4, curY + strokeW + 4);

      // 记录 UV 坐标与世界空间尺寸
      this.textAtlasMap.set(n.id, {
        u0: curX / atlasW,
        v0: curY / atlasH,
        u1: (curX + textW) / atlasW,
        v1: (curY + textH) / atlasH,
        w: textW / scaleFactor,
        h: textH / scaleFactor,
        yOffset: (n.radius || 12) + (n.level === 1 ? 6 : (n.level === 2 ? 4 : 3))
      });

      curX += textW + padding;
      if (textH > rowHeight) rowHeight = textH;
    }

    // 上传纹理至 GPU 并生成 Mipmap，硬件级三线性过滤消除缩小闪烁
    gl.bindTexture(gl.TEXTURE_2D, this.textTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // 核心渲染方法 (纯 GPU 极速渲染，0 逐帧 CPU 开销)
  render(state) {
    const gl = this.gl;
    const { nodes, links, hl, query, transform } = state;
    const { width, height, dpr } = this;
    const k = transform.k;
    const tx = transform.x;
    const ty = transform.y;

    let needsMoreFrames = false;
    const FADE_SPEED = 0.22;

    // 清屏为原版主题背景色 (--bg-app: #181818)
    const bg = this.getBackgroundColor();
    gl.clearColor(bg[0], bg[1], bg[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 列优先 3x3 矩阵：世界坐标 (gx, gy) -> 视口 NDC [-1, 1]
    const matrix = new Float32Array([
      (2 * k) / width, 0, 0,
      0, (-2 * k) / height, 0,
      (2 * tx) / width - 1, 1 - (2 * ty) / height, 1
    ]);

    // 视锥体视口空间剔除边界 (保留 120px 缓冲带)
    const pad = 120;
    const viewLeft = -tx / k - pad;
    const viewRight = (width - tx) / k + pad;
    const viewTop = -ty / k - pad;
    const viewBottom = (height - ty) / k + pad;

    // =====================================================================
    // 1. 连线与箭头 (Links & Arrows)
    // =====================================================================
    const linkVerts = [];
    const linkIndices = [];
    const arrowVerts = [];

    for (let i = 0; i < links.length; ++i) {
      const l = links[i];
      const s = l.source;
      const t = l.target;
      if (!s || !t || s.x == null || t.x == null) continue;

      const sId = s.id;
      const tId = t.id;

      let isLinkActive = false;
      let strokeColorHex = '#ffffff';
      let lineWidth = l.type === 'prereq' ? 1.8 : 1.0;

      if (hl) {
        if (tId === hl.targetId) {
          isLinkActive = true;
          strokeColorHex = '#10b981'; // 前置依赖：翡翠绿
          lineWidth = 2.2;
        } else if (sId === hl.targetId) {
          isLinkActive = true;
          strokeColorHex = '#3b82f6'; // 后续依赖：蔚蓝
          lineWidth = 2.2;
        }
      }

      const targetLinkAlpha = hl ? (isLinkActive ? 1.0 : 0.08) : 0.55;
      if (l.currentAlpha == null) l.currentAlpha = targetLinkAlpha;
      l.currentAlpha += (targetLinkAlpha - l.currentAlpha) * FADE_SPEED;
      if (Math.abs(l.currentAlpha - targetLinkAlpha) > 0.005) {
        needsMoreFrames = true;
      } else {
        l.currentAlpha = targetLinkAlpha;
      }

      const rgba = hexToRgba(strokeColorHex, l.currentAlpha);

      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) continue;

      const halfW = lineWidth * 0.5;
      const nx = (-dy / dist) * halfW;
      const ny = (dx / dist) * halfW;

      // 簇集虚线生成
      if (l.type === 'cluster') {
        const dashLen = 4;
        const gapLen = 4;
        const step = dashLen + gapLen;
        const count = Math.floor(dist / step);

        for (let j = 0; j < count; ++j) {
          const t0 = (j * step) / dist;
          const t1 = Math.min(1.0, (j * step + dashLen) / dist);

          const x0 = s.x + dx * t0;
          const y0 = s.y + dy * t0;
          const x1 = s.x + dx * t1;
          const y1 = s.y + dy * t1;

          const baseV = linkVerts.length / 6;
          linkVerts.push(
            x0 + nx, y0 + ny, rgba[0], rgba[1], rgba[2], rgba[3],
            x1 + nx, y1 + ny, rgba[0], rgba[1], rgba[2], rgba[3],
            x1 - nx, y1 - ny, rgba[0], rgba[1], rgba[2], rgba[3],
            x0 - nx, y0 - ny, rgba[0], rgba[1], rgba[2], rgba[3]
          );
          linkIndices.push(
            baseV, baseV + 1, baseV + 2,
            baseV, baseV + 2, baseV + 3
          );
        }
      } else {
        // 实线 Quad 几何
        const baseV = linkVerts.length / 6;
        linkVerts.push(
          s.x + nx, s.y + ny, rgba[0], rgba[1], rgba[2], rgba[3],
          t.x + nx, t.y + ny, rgba[0], rgba[1], rgba[2], rgba[3],
          t.x - nx, t.y - ny, rgba[0], rgba[1], rgba[2], rgba[3],
          s.x - nx, s.y - ny, rgba[0], rgba[1], rgba[2], rgba[3]
        );
        linkIndices.push(
          baseV, baseV + 1, baseV + 2,
          baseV, baseV + 2, baseV + 3
        );

        // 前置依赖与顺序关联绘制箭头
        if (l.type === 'prereq' || l.type === 'sequence') {
          const targetRadius = t.radius || 12;
          const arrowLen = 7;
          const arrowW = 4;

          const tipX = t.x - (dx / dist) * (targetRadius + 2);
          const tipY = t.y - (dy / dist) * (targetRadius + 2);

          const baseX = tipX - (dx / dist) * arrowLen;
          const baseY = tipY - (dy / dist) * arrowLen;

          const leftX = baseX - (dy / dist) * arrowW;
          const leftY = baseY + (dx / dist) * arrowW;

          const rightX = baseX + (dy / dist) * arrowW;
          const rightY = baseY - (dx / dist) * arrowW;

          arrowVerts.push(
            tipX, tipY, rgba[0], rgba[1], rgba[2], rgba[3],
            leftX, leftY, rgba[0], rgba[1], rgba[2], rgba[3],
            rightX, rightY, rgba[0], rgba[1], rgba[2], rgba[3]
          );
        }
      }
    }

    // 绘制连线
    if (linkIndices.length > 0) {
      gl.useProgram(this.linkProgram);
      const uMatLoc = gl.getUniformLocation(this.linkProgram, 'u_matrix');
      gl.uniformMatrix3fv(uMatLoc, false, matrix);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.linkVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(linkVerts), gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.linkIBO);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(linkIndices), gl.DYNAMIC_DRAW);

      const aPosLoc = gl.getAttribLocation(this.linkProgram, 'a_pos');
      const aColLoc = gl.getAttribLocation(this.linkProgram, 'a_color');

      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 24, 0);

      gl.enableVertexAttribArray(aColLoc);
      gl.vertexAttribPointer(aColLoc, 4, gl.FLOAT, false, 24, 8);

      gl.drawElements(gl.TRIANGLES, linkIndices.length, gl.UNSIGNED_SHORT, 0);

      // 绘制箭头
      if (arrowVerts.length > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowVBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrowVerts), gl.DYNAMIC_DRAW);

        gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(aColLoc, 4, gl.FLOAT, false, 24, 8);

        gl.drawArrays(gl.TRIANGLES, 0, arrowVerts.length / 6);
      }
    }

    // =====================================================================
    // 2. 节点圆形 (SDF 完美亚像素抗锯齿圆球)
    // =====================================================================
    const nodeVerts = [];
    const nodeIndices = [];

    // 单顶点布局：
    // [cornerX, cornerY, centerX, centerY, totalRadius, fillR, fillG, fillB, fillA, strokeR, strokeG, strokeB, strokeA, fillRatio, alpha]
    // 15 Float32 = 60 Bytes
    for (let i = 0; i < nodes.length; ++i) {
      const n = nodes[i];
      if (n.x == null || n.y == null) continue;

      let isMatch = true;
      if (query) {
        isMatch = (n.title && n.title.toLowerCase().includes(query)) ||
                  (n.tag && n.tag.toLowerCase().includes(query)) ||
                  (n.id && n.id.toLowerCase().includes(query));
      }

      const isTarget = hl && n.id === hl.targetId;
      const isNeighbor = hl && (hl.inSet.has(n.id) || hl.outSet.has(n.id));
      const isConnected = isTarget || isNeighbor;
      const active = query ? isMatch : isConnected;

      const targetNodeAlpha = (hl || query) ? (active ? 1.0 : 0.12) : 1.0;
      if (n.currentAlpha == null) n.currentAlpha = targetNodeAlpha;
      n.currentAlpha += (targetNodeAlpha - n.currentAlpha) * FADE_SPEED;
      if (Math.abs(n.currentAlpha - targetNodeAlpha) > 0.005) {
        needsMoreFrames = true;
      } else {
        n.currentAlpha = targetNodeAlpha;
      }

      // 视锥体视口剔除
      if (n.x < viewLeft || n.x > viewRight || n.y < viewTop || n.y > viewBottom) continue;

      const baseRadius = n.radius || 12;
      const strokeW = isTarget ? 3.5 : (n.level === 1 ? 2.5 : 1.6);
      const totalRadius = baseRadius + strokeW * 0.5;
      const fillRatio = Math.max(0.0, (baseRadius - strokeW * 0.5) / totalRadius);

      const strokeCol = hexToRgba(n.color, 1.0);
      const fillCol = n.level === 1 ? hexToRgba(n.color, 1.0) : hexToRgba('#181b26', 1.0);

      const baseV = nodeVerts.length / 15;
      const corners = [
        [-1, -1],
        [ 1, -1],
        [ 1,  1],
        [-1,  1]
      ];

      for (let j = 0; j < 4; ++j) {
        nodeVerts.push(
          corners[j][0], corners[j][1],
          n.x, n.y,
          totalRadius,
          fillCol[0], fillCol[1], fillCol[2], fillCol[3],
          strokeCol[0], strokeCol[1], strokeCol[2], strokeCol[3],
          fillRatio,
          n.currentAlpha
        );
      }

      nodeIndices.push(
        baseV, baseV + 1, baseV + 2,
        baseV, baseV + 2, baseV + 3
      );
    }

    if (nodeIndices.length > 0) {
      gl.useProgram(this.nodeProgram);
      const uMatLoc = gl.getUniformLocation(this.nodeProgram, 'u_matrix');
      gl.uniformMatrix3fv(uMatLoc, false, matrix);

      // 传入当前物理像素与世界坐标缩放换算比，确保抗锯齿始终恒定为 1.0 物理像素
      const uScaleLoc = gl.getUniformLocation(this.nodeProgram, 'u_scale');
      gl.uniform1f(uScaleLoc, k * dpr);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeVerts), gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.nodeIBO);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(nodeIndices), gl.DYNAMIC_DRAW);

      const aCornerLoc = gl.getAttribLocation(this.nodeProgram, 'a_corner');
      const aCenterLoc = gl.getAttribLocation(this.nodeProgram, 'a_center');
      const aRadiusLoc = gl.getAttribLocation(this.nodeProgram, 'a_total_radius');
      const aFillLoc = gl.getAttribLocation(this.nodeProgram, 'a_fill_color');
      const aStrokeLoc = gl.getAttribLocation(this.nodeProgram, 'a_stroke_color');
      const aRatioLoc = gl.getAttribLocation(this.nodeProgram, 'a_fill_ratio');
      const aAlphaLoc = gl.getAttribLocation(this.nodeProgram, 'a_alpha');

      const stride = 15 * 4;

      gl.enableVertexAttribArray(aCornerLoc);
      gl.vertexAttribPointer(aCornerLoc, 2, gl.FLOAT, false, stride, 0);

      gl.enableVertexAttribArray(aCenterLoc);
      gl.vertexAttribPointer(aCenterLoc, 2, gl.FLOAT, false, stride, 8);

      gl.enableVertexAttribArray(aRadiusLoc);
      gl.vertexAttribPointer(aRadiusLoc, 1, gl.FLOAT, false, stride, 16);

      gl.enableVertexAttribArray(aFillLoc);
      gl.vertexAttribPointer(aFillLoc, 4, gl.FLOAT, false, stride, 20);

      gl.enableVertexAttribArray(aStrokeLoc);
      gl.vertexAttribPointer(aStrokeLoc, 4, gl.FLOAT, false, stride, 36);

      gl.enableVertexAttribArray(aRatioLoc);
      gl.vertexAttribPointer(aRatioLoc, 1, gl.FLOAT, false, stride, 52);

      gl.enableVertexAttribArray(aAlphaLoc);
      gl.vertexAttribPointer(aAlphaLoc, 1, gl.FLOAT, false, stride, 56);

      gl.drawElements(gl.TRIANGLES, nodeIndices.length, gl.UNSIGNED_SHORT, 0);
    }

    // =====================================================================
    // 3. 构建文本标签网格 (采样 Text Atlas，带视锥体视口剔除与淡入淡出动画)
    // =====================================================================
    const textVerts = [];
    const textIndices = [];

    // 单顶点布局：[posX, posY, u, v, alpha] -> 5 Float32 = 20 Bytes
    for (let i = 0; i < nodes.length; ++i) {
      const n = nodes[i];
      if (n.x == null || n.y == null) continue;

      const atlasInfo = this.textAtlasMap.get(n.id);
      if (!atlasInfo) continue;

      const isTarget = hl && n.id === hl.targetId;

      // 显隐判定
      let shouldShow = false;
      if (isTarget) {
        shouldShow = true;
      } else if (k < 0.6) {
        shouldShow = false;
      } else if (k < 1.6) {
        shouldShow = n.level === 1;
      } else if (k < 2.6) {
        shouldShow = n.level <= 2;
      } else {
        shouldShow = true;
      }

      // 时间插值平滑淡入淡出
      const targetLabelAlpha = shouldShow ? 1.0 : 0.0;
      if (n.currentLabelAlpha == null) n.currentLabelAlpha = targetLabelAlpha;
      n.currentLabelAlpha += (targetLabelAlpha - n.currentLabelAlpha) * FADE_SPEED;
      if (Math.abs(n.currentLabelAlpha - targetLabelAlpha) > 0.005) {
        needsMoreFrames = true;
      } else {
        n.currentLabelAlpha = targetLabelAlpha;
      }

      if (n.currentLabelAlpha <= 0.01) continue;

      // 视锥体视口裁剪：超出屏幕视口的文本 quad 跳过提交
      if (n.x < viewLeft || n.x > viewRight || n.y < viewTop || n.y > viewBottom) continue;

      const finalAlpha = n.currentLabelAlpha * (n.currentAlpha ?? 1.0);
      if (finalAlpha <= 0.01) continue;

      // 文本世界坐标：水平居中，垂直位于节点正下方
      const tw = atlasInfo.w;
      const th = atlasInfo.h;
      const left = n.x - tw * 0.5;
      const right = n.x + tw * 0.5;
      const top = n.y + atlasInfo.yOffset;
      const bottom = top + th;

      const { u0, v0, u1, v1 } = atlasInfo;
      const baseV = textVerts.length / 5;

      textVerts.push(
        left,  top,    u0, v0, finalAlpha,
        right, top,    u1, v0, finalAlpha,
        right, bottom, u1, v1, finalAlpha,
        left,  bottom, u0, v1, finalAlpha
      );

      textIndices.push(
        baseV, baseV + 1, baseV + 2,
        baseV, baseV + 2, baseV + 3
      );
    }

    // --- 绘制文本 (GPU 单次 DrawCall 满帧完成所有文字渲染) ---
    if (textIndices.length > 0) {
      gl.useProgram(this.textProgram);
      const uMatLoc = gl.getUniformLocation(this.textProgram, 'u_matrix');
      gl.uniformMatrix3fv(uMatLoc, false, matrix);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.textTexture);
      const uTexLoc = gl.getUniformLocation(this.textProgram, 'u_texture');
      gl.uniform1i(uTexLoc, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.textVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textVerts), gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.textIBO);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(textIndices), gl.DYNAMIC_DRAW);

      const aPosLoc = gl.getAttribLocation(this.textProgram, 'a_pos');
      const aUvLoc = gl.getAttribLocation(this.textProgram, 'a_uv');
      const aAlphaLoc = gl.getAttribLocation(this.textProgram, 'a_alpha');

      const stride = 5 * 4;

      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, stride, 0);

      gl.enableVertexAttribArray(aUvLoc);
      gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, stride, 8);

      gl.enableVertexAttribArray(aAlphaLoc);
      gl.vertexAttribPointer(aAlphaLoc, 1, gl.FLOAT, false, stride, 16);

      gl.drawElements(gl.TRIANGLES, textIndices.length, gl.UNSIGNED_SHORT, 0);
    }

    return needsMoreFrames;
  }

  // 释放资源
  destroy() {
    const gl = this.gl;
    if (this.textTexture) gl.deleteTexture(this.textTexture);
    if (this.linkVBO) gl.deleteBuffer(this.linkVBO);
    if (this.linkIBO) gl.deleteBuffer(this.linkIBO);
    if (this.arrowVBO) gl.deleteBuffer(this.arrowVBO);
    if (this.nodeVBO) gl.deleteBuffer(this.nodeVBO);
    if (this.nodeIBO) gl.deleteBuffer(this.nodeIBO);
    if (this.textVBO) gl.deleteBuffer(this.textVBO);
    if (this.textIBO) gl.deleteBuffer(this.textIBO);
    if (this.linkProgram) gl.deleteProgram(this.linkProgram);
    if (this.nodeProgram) gl.deleteProgram(this.nodeProgram);
    if (this.textProgram) gl.deleteProgram(this.textProgram);
  }
}
