// WebGL2 知识图谱渲染器

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
  if (!hex) return [0.0941, 0.0941, 0.0941, alpha];
  let s = String(hex).trim().replace('#', '');
  if (s.length === 3) {
    s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  }
  const num = parseInt(s, 16);
  if (isNaN(num)) return [0.0941, 0.0941, 0.0941, alpha];
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
    alpha
  ];
}

// 连线着色器
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

// 节点 SDF 抗锯齿圆形着色器
const NODE_VS = `
attribute vec2 a_corner;
attribute vec2 a_center;
attribute float a_total_radius;
attribute vec4 a_fill_color;
attribute vec4 a_stroke_color;
attribute float a_fill_ratio;
attribute float a_alpha;

uniform mat3 u_matrix;

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

  // 像素级抗锯齿宽度
  float delta = 1.0 / max(v_total_radius * u_scale, 1.0);

  // 外边缘羽化裁剪
  float outer_alpha = smoothstep(1.0, 1.0 - delta, dist);
  if (outer_alpha <= 0.001) {
    discard;
  }

  // 内填充与描边分界
  float inner_boundary = v_fill_ratio;
  float fill_factor = smoothstep(inner_boundary + delta, inner_boundary, dist);

  vec4 col = mix(v_fill_color, v_stroke_color, fill_factor);
  col.a *= outer_alpha * v_alpha;

  gl_FragColor = col;
}
`;

// 文字纹理着色器
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

// WebGL 核心渲染器
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

    // 开启混合
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 编译着色器程序
    this.linkProgram = createProgram(gl, LINK_VS, LINK_FS);
    this.nodeProgram = createProgram(gl, NODE_VS, NODE_FS);
    this.textProgram = createProgram(gl, TEXT_VS, TEXT_FS);

    // 创建顶点与索引缓冲区
    this.linkVBO = gl.createBuffer();
    this.linkIBO = gl.createBuffer();

    this.nodeVBO = gl.createBuffer();
    this.nodeIBO = gl.createBuffer();

    this.textVBO = gl.createBuffer();
    this.textIBO = gl.createBuffer();

    // 文字图集纹理与映射表
    this.textTexture = gl.createTexture();
    this.textAtlasMap = new Map();

    this.width = 800;
    this.height = 600;
    this.dpr = 1;
  }

  // 调整视口尺寸
  resize(width, height, dpr = 1) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.gl.viewport(0, 0, Math.round(width * dpr), Math.round(height * dpr));
  }

  // 获取背景色
  getBackgroundColor() {
    if (typeof window !== 'undefined') {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim();
      if (bg) return hexToRgba(bg, 1.0);
    }
    return [0.0941, 0.0941, 0.0941, 1.0];
  }

  // 构建文字图集纹理
  buildTextAtlas(nodes) {
    const gl = this.gl;
    if (!nodes || nodes.length === 0) return;

    const atlasCanvas = document.createElement('canvas');
    const atlasW = 2048;
    const atlasH = 2048;
    atlasCanvas.width = atlasW;
    atlasCanvas.height = atlasH;
    const ctx = atlasCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, atlasW, atlasH);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    this.textAtlasMap.clear();

    let curX = 16;
    let curY = 16;
    let rowHeight = 0;
    const padding = 16;
    const scaleFactor = 4.0;

    for (let i = 0; i < nodes.length; ++i) {
      const n = nodes[i];
      const text = n.tag ? `${n.tag} ${n.title}` : n.title;
      if (!text) continue;

      let fontSpec = `500 ${Math.round(8.5 * scaleFactor)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
      let fillCol = '#cbd5e1';

      if (n.level === 1) {
        fontSpec = `600 ${Math.round(12 * scaleFactor)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
        fillCol = '#ffffff';
      } else if (n.level === 3) {
        fontSpec = `400 ${Math.round(7.5 * scaleFactor)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
        fillCol = '#94a3b8';
      }

      ctx.font = fontSpec;
      const metrics = ctx.measureText(text);
      const textW = Math.ceil(metrics.width) + 16;
      const textH = Math.ceil(20 * scaleFactor) + 16;

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

      // 绘制纯净文本（无黑色描边）
      ctx.fillStyle = fillCol;
      ctx.fillText(text, curX + 8, curY + 8);

      // 记录 UV 坐标与尺寸
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

    // 上传纹理并生成 Mipmap
    gl.bindTexture(gl.TEXTURE_2D, this.textTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // 核心渲染方法
  render(state) {
    const gl = this.gl;
    const { nodes, links, hl, query, transform } = state;
    const { width, height, dpr } = this;
    const k = transform.k;
    const tx = transform.x;
    const ty = transform.y;

    let needsMoreFrames = false;
    const FADE_SPEED = 0.22;

    // 清屏
    const bg = this.getBackgroundColor();
    gl.clearColor(bg[0], bg[1], bg[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 变换矩阵
    const matrix = new Float32Array([
      (2 * k) / width, 0, 0,
      0, (-2 * k) / height, 0,
      (2 * tx) / width - 1, 1 - (2 * ty) / height, 1
    ]);

    // 视锥体视口剔除边界
    const pad = 120;
    const viewLeft = -tx / k - pad;
    const viewRight = (width - tx) / k + pad;
    const viewTop = -ty / k - pad;
    const viewBottom = (height - ty) / k + pad;

    // 1. 绘制连线
    const linkVerts = [];
    const linkIndices = [];

    for (let i = 0; i < links.length; ++i) {
      const l = links[i];
      const s = l.source;
      const t = l.target;
      if (!s || !t || s.x == null || t.x == null) continue;

      const sId = s.id;
      const tId = t.id;

      const isLevel1to2 = l.level === 2 || s.level === 1 || t.level === 2;
      let isLinkActive = false;
      let strokeColorHex = '#ffffff'; // 默认状态下中性无彩色
      let lineWidth = isLevel1to2 ? 2.0 : 1.1;
      let baseAlpha = isLevel1to2 ? 0.35 : 0.18;

      if (hl) {
        if (tId === hl.targetId) {
          isLinkActive = true;
          strokeColorHex = '#10b981';
          lineWidth = isLevel1to2 ? 2.8 : 2.0;
        } else if (sId === hl.targetId) {
          isLinkActive = true;
          strokeColorHex = '#3b82f6';
          lineWidth = isLevel1to2 ? 2.8 : 2.0;
        }
      }

      const targetLinkAlpha = hl ? (isLinkActive ? 1.0 : 0.05) : baseAlpha;
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
    }

    // 提交连线绘制
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
    }

    // 2. 绘制节点圆形
    const nodeVerts = [];
    const nodeIndices = [];

    // 顶点布局：corner, center, radius, color, fillRatio, alpha
    for (let i = 0; i < nodes.length; ++i) {
      const n = nodes[i];
      if (n.x == null || n.y == null) continue;

      let isMatch = true;
      if (query) {
        isMatch = (n.title && n.title.toLowerCase().includes(query)) ||
                  (n.tag && n.tag.toLowerCase().includes(query)) ||
                  (n.id && String(n.id).toLowerCase().includes(query));
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

      const fillCol = hexToRgba(n.color, 1.0);
      const strokeCol = isTarget ? hexToRgba('#ffffff', 0.9) : hexToRgba(n.color, 1.0);

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

      // 设置缩放比例
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

    // 3. 绘制文本标签
    const textVerts = [];
    const textIndices = [];

    // 顶点布局：pos, uv, alpha
    for (let i = 0; i < nodes.length; ++i) {
      const n = nodes[i];
      if (n.x == null || n.y == null) continue;

      const atlasInfo = this.textAtlasMap.get(n.id);
      if (!atlasInfo) continue;

      const isTarget = (hl && n.id === hl.targetId) || (query && n.title && n.title.toLowerCase().includes(query));

      // 显隐判定：缩放层级与节点重要度匹配
      let shouldShow = false;
      if (isTarget) {
        shouldShow = true;
      } else if (k < 0.5) {
        shouldShow = false;
      } else if (k < 1.0) {
        shouldShow = n.level === 1;
      } else if (k < 1.6) {
        shouldShow = n.level <= 2;
      } else {
        shouldShow = true;
      }

      // 平滑淡入淡出
      const targetLabelAlpha = shouldShow ? 1.0 : 0.0;
      if (n.currentLabelAlpha == null) n.currentLabelAlpha = targetLabelAlpha;
      n.currentLabelAlpha += (targetLabelAlpha - n.currentLabelAlpha) * FADE_SPEED;
      if (Math.abs(n.currentLabelAlpha - targetLabelAlpha) > 0.005) {
        needsMoreFrames = true;
      } else {
        n.currentLabelAlpha = targetLabelAlpha;
      }

      if (n.currentLabelAlpha <= 0.01) continue;

      // 视锥体视口裁剪
      if (n.x < viewLeft || n.x > viewRight || n.y < viewTop || n.y > viewBottom) continue;

      const finalAlpha = n.currentLabelAlpha * (n.currentAlpha ?? 1.0);
      if (finalAlpha <= 0.01) continue;

      // 计算文本世界坐标
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

    // 提交文本绘制
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
    if (this.nodeVBO) gl.deleteBuffer(this.nodeVBO);
    if (this.nodeIBO) gl.deleteBuffer(this.nodeIBO);
    if (this.textVBO) gl.deleteBuffer(this.textVBO);
    if (this.textIBO) gl.deleteBuffer(this.textIBO);
    if (this.linkProgram) gl.deleteProgram(this.linkProgram);
    if (this.nodeProgram) gl.deleteProgram(this.nodeProgram);
    if (this.textProgram) gl.deleteProgram(this.textProgram);
  }
}
