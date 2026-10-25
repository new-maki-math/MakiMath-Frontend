import { ease, rand, tex, esc } from './core.js';

export function createLectureEngine({ cvEl, topEl, domEl, capEl, preEl, cues = [], parts = [], config = {} }) {
  const W = 1920;
  const H = 1080;
  const INK = '#2a2833';
  const C = { b: '#2F7FE0', g: '#1E9E5E', o: '#EE8516', y: '#F2B705', r: '#D9483B', p: '#8A6FE8' };
  const CT = { b: '#1c62bd', g: '#11804a', o: '#c9650a', r: '#c23a2e', p: '#6a4fd0', mute: '#6b6676' };
  const FONT = '"LXGW WenKai","Noto Serif CJK SC",serif';
  const CX = 790;
  const SAFE = { x0: 40, x1: 1540, capY: 958 };
  const E = ease;
  const lin = E.lin;
  const out = E.out;
  const io = E.io;
  const pr = (t, a, d) => out(lin(t, a, a + d));

  const ctx0 = cvEl.getContext('2d');
  const tctx = topEl.getContext('2d');
  let ctx = ctx0;
  let TNOW = 0;

  // 纸张底纹（预渲染）
  const paper = document.createElement('canvas');
  paper.width = W;
  paper.height = H;
  {
    const p = paper.getContext('2d');
    p.fillStyle = '#f4eee0';
    p.fillRect(0, 0, W, H);
    p.strokeStyle = 'rgba(80,110,150,0.075)';
    p.lineWidth = 1;
    for (let x = 0; x <= W; x += 48) {
      p.beginPath();
      p.moveTo(x + 0.5, 0);
      p.lineTo(x + 0.5, H);
      p.stroke();
    }
    for (let y = 0; y <= H; y += 48) {
      p.beginPath();
      p.moveTo(0, y + 0.5);
      p.lineTo(W, y + 0.5);
      p.stroke();
    }
    for (let i = 0; i < 9000; i++) {
      const x = rand(i * 3.1) * W;
      const y = rand(i * 7.7 + 1) * H;
      const a = rand(i * 1.3 + 2) * 0.07;
      p.fillStyle = rand(i + 0.5) < 0.5 ? `rgba(90,70,40,${a})` : `rgba(255,255,255,${a * 1.6})`;
      p.fillRect(x, y, 1 + rand(i * 9.1) * 1.6, 1 + rand(i * 4.4) * 1.6);
    }
    for (let i = 0; i < 70; i++) {
      const x = rand(i * 13.3 + 9) * W;
      const y = rand(i * 17.9 + 3) * H;
      p.strokeStyle = `rgba(120,100,70,${0.04 + rand(i * 5.5) * 0.05})`;
      p.lineWidth = 0.8;
      p.beginPath();
      p.moveTo(x, y);
      p.lineTo(x + 20 + rand(i * 2.2) * 60, y + (rand(i * 3.3) - 0.5) * 14);
      p.stroke();
    }
    const g = p.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(90,70,40,0.13)');
    p.fillStyle = g;
    p.fillRect(0, 0, W, H);
  }

  function hsh(s) {
    let h = 7;
    for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 1000003;
    return h;
  }
  const J = (k) => rand(k) - 0.5;
  function noise(seed, j, per) {
    const a = Math.floor(j / per);
    const f = j / per - a;
    const s = f * f * (3 - 2 * f);
    return J(seed + a * 1.37) * (1 - s) + J(seed + (a + 1) * 1.37) * s;
  }
  function resample(pts, step) {
    const o = [];
    let d = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const L = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.max(1, Math.ceil(L / step));
      for (let j = 0; j < n; j++) {
        const u = j / n;
        o.push({ x: x1 + (x2 - x1) * u, y: y1 + (y2 - y1) * u, d: d + L * u });
      }
      d += L;
    }
    const l = pts[pts.length - 1];
    o.push({ x: l[0], y: l[1], d });
    return o;
  }

  function stroke(pts, p, key, o = {}) {
    if (p <= 0 || !pts || pts.length < 2) return;
    const lw = o.lw || 3.4;
    const col = o.color || INK;
    const amp = o.exact || o.dash ? 0 : (o.amp ?? 1.5);
    const k = hsh(key);
    const S = resample(pts, o.step || 10);
    const L = S[S.length - 1].d;
    const lim = L * Math.min(1, p);
    const GA = ctx.globalAlpha;
    if (GA <= 0) return;
    const passes = o.single || o.exact ? 1 : 2;
    for (let pass = 0; pass < passes; pass++) {
      const seed = k * 0.913 + pass * 71.3;
      ctx.beginPath();
      for (let j = 0; j < S.length; j++) {
        let s = S[j];
        let x = s.x;
        let y = s.y;
        let stop = false;
        if (s.d > lim && j > 0) {
          const a = S[j - 1];
          const u = (lim - a.d) / (s.d - a.d || 1);
          x = a.x + (s.x - a.x) * u;
          y = a.y + (s.y - a.y) * u;
          stop = true;
        }
        const jx = noise(seed, j, 5) * amp * 3 + J(seed + j * 3.1) * amp * 0.5;
        const jy = noise(seed + 400, j, 5) * amp * 3 + J(seed + j * 5.7 + 0.5) * amp * 0.5;
        if (j === 0) ctx.moveTo(x + jx, y + jy);
        else ctx.lineTo(x + jx, y + jy);
        if (stop) break;
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = pass ? lw * 0.42 : lw;
      ctx.globalAlpha = GA * (o.alpha ?? 1) * (pass ? 0.5 : o.exact ? 1 : 0.92);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = GA;
    }
  }

  function rectPts(x, y, w, h, k) {
    const r = (i) => J(hsh(k) + i) * 4;
    return [
      [x - 4 + r(1), y + r(2)],
      [x + w + r(3), y + r(4)],
      [x + w + r(5), y + h + r(6)],
      [x + r(7), y + h + r(8)],
      [x + 2 + r(9), y - 6]
    ];
  }
  function ellPts(cx, cy, rx, ry, k, turn = 1.13) {
    const o = [];
    const N = 56;
    const st = -2.2 + J(hsh(k)) * 0.6;
    for (let i = 0; i <= N; i++) {
      const a = st + (i / N) * Math.PI * 2 * turn;
      const f = 1 + 0.05 * Math.sin((i / N) * 7 + hsh(k)) + (i / N) * 0.06;
      o.push([cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f]);
    }
    return o;
  }
  function circPts(cx, cy, r, N = 28) {
    const o = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return o;
  }
  function lineH(x1, x2, y) {
    return [[x1, y], [x2, y]];
  }
  function lineV(x, y1, y2) {
    return [[x, y1], [x, y2]];
  }
  function wavy(x1, x2, y, amp = 4, per = 60) {
    const o = [];
    for (let x = x1; x <= x2; x += 10) {
      o.push([x, y + Math.sin(((x - x1) / per) * Math.PI * 2) * amp]);
    }
    return o;
  }
  function arrow(x1, y1, x2, y2, p, key, o = {}) {
    stroke([[x1, y1], [x2, y2]], p, key, o);
    if (p < 0.98) return;
    const a = Math.atan2(y2 - y1, x2 - x1);
    const s = o.head || 16;
    stroke(
      [
        [x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45)],
        [x2, y2],
        [x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)]
      ],
      1,
      key + 'h',
      Object.assign({}, o, { single: true, dash: null })
    );
  }
  function check(x, y, s, p, k, col) {
    stroke(
      [[x - s * 0.5, y], [x - s * 0.12, y + s * 0.42], [x + s * 0.6, y - s * 0.55]],
      p,
      k,
      { color: col || INK, lw: Math.max(3.4, s * 0.11) }
    );
  }
  function cross(x, y, s, p, k, col) {
    stroke(
      [[x - s * 0.45, y - s * 0.45], [x + s * 0.45, y + s * 0.45]],
      Math.min(1, p * 2),
      k + 'a',
      { color: col || INK, lw: s * 0.11 }
    );
    stroke(
      [[x + s * 0.45, y - s * 0.45], [x - s * 0.45, y + s * 0.45]],
      Math.max(0, p * 2 - 1),
      k + 'b',
      { color: col || INK, lw: s * 0.11 }
    );
  }
  function hatch(x, y, w, h, p, col, key, o = {}) {
    if (p <= 0) return;
    const k = hsh(key);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 3, y - 3, w + 6, h + 6);
    ctx.clip();
    const sp = o.sp || 15;
    const n = Math.ceil((w + h) / sp) + 1;
    const m = Math.ceil(n * Math.min(1, p));
    ctx.strokeStyle = col;
    ctx.globalAlpha = (o.alpha || 0.3) * (o.a ?? 1);
    ctx.lineWidth = o.lw || 14;
    ctx.lineCap = 'round';
    for (let i = 0; i < m; i++) {
      const s = i * sp + J(k + i) * 5;
      ctx.beginPath();
      ctx.moveTo(x + s + J(k + i * 2) * 6, y - 6);
      ctx.lineTo(x + s - h * 0.8 + J(k + i * 3) * 8, y + h + 6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function marker(x1, x2, y, p, col, key, o = {}) {
    if (p <= 0) return;
    stroke(
      [[x1, y + J(hsh(key)) * 3], [x2, y + J(hsh(key) + 1) * 3]],
      p,
      key,
      { color: col, lw: o.lw || 24, alpha: o.alpha || 0.32, single: true, amp: 0.6 }
    );
  }
  function ctext(s, x, y, size, col, p = 1, a = 1, bold) {
    if (p <= 0 || a <= 0) return;
    ctx.save();
    ctx.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(s).width;
    ctx.beginPath();
    ctx.rect(x - w / 2 - 6, y - size, (w + 12) * Math.min(1, p), size * 2);
    ctx.clip();
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  function dot(x, y, r, col, a = 1) {
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function hollow(x, y, r, col, p, key) {
    stroke(circPts(x, y, r, 40), p, key, { color: col, lw: 3, exact: true });
  }

  function axes(o) {
    const { x0, y0, w, h } = o;
    const [xa, xb] = o.xr;
    const [ya, yb] = o.yr;
    const X = (x) => x0 + ((x - xa) / (xb - xa)) * w;
    const Y = (y) => y0 + h - ((y - ya) / (yb - ya)) * h;
    const ox = Math.round(xa <= 0 && xb >= 0 ? X(0) : x0) + 0.5;
    const oy = Math.round(ya <= 0 && yb >= 0 ? Y(0) : y0 + h) + 0.5;
    const EX = { exact: true };
    const A = {
      X,
      Y,
      ox,
      oy,
      draw(p, key, oo = {}) {
        arrow(x0 - 10, oy, x0 + w + 24, oy, Math.min(1, p * 1.6), key + 'x', { lw: 3, head: 14, exact: true });
        arrow(ox, y0 + h + 10, ox, y0 - 24, Math.max(0, p * 1.6 - 0.6), key + 'y', { lw: 3, head: 14, exact: true });
        if (oo.xl) ctext(oo.xl, x0 + w + 40, oy + 4, 38, INK, p, 1);
        if (oo.yl) ctext(oo.yl, ox + 6, y0 - 46, 38, INK, p, 1);
        if (oo.o !== false && ox > x0 + 5) ctext('O', ox - 24, oy + 26, 32, INK, p, 1);
      },
      curve(f, a, b, p, key, oo = {}) {
        const N = oo.n || 600;
        const segs = [];
        let seg = [];
        const brk = (oo.breaks || []).slice().sort((u, v) => u - v);
        const lo = ya - (yb - ya) * 0.02;
        const hi = yb + (yb - ya) * 0.02;
        let prevX = null;
        for (let i = 0; i <= N; i++) {
          const x = a + ((b - a) * i) / N;
          const y = f(x);
          if (prevX !== null && brk.some((c) => prevX < c && x >= c)) {
            if (seg.length > 1) segs.push(seg);
            seg = [];
          }
          prevX = x;
          if (!isFinite(y) || y < lo || y > hi) {
            if (seg.length > 1) segs.push(seg);
            seg = [];
            continue;
          }
          seg.push([X(x), Y(y)]);
        }
        if (seg.length > 1) segs.push(seg);
        let tot = 0;
        const lens = segs.map((s) => {
          let l = 0;
          for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
          tot += l;
          return l;
        });
        let acc = 0;
        segs.forEach((s, i) => {
          const pp = (p * tot - acc) / lens[i];
          acc += lens[i];
          if (pp > 0) {
            stroke(s, Math.min(1, pp), key + 's' + i, Object.assign({ lw: 3.6, step: 3 }, oo, EX));
          }
        });
      },
      line(x1, y1, x2, y2, p, key, oo = {}) {
        stroke([[X(x1), Y(y1)], [X(x2), Y(y2)]], p, key, Object.assign({ lw: 3 }, oo, EX));
      },
      hline(y, x1, x2, p, key, oo = {}) {
        A.line(x1 ?? xa, y, x2 ?? xb, y, p, key, oo);
      },
      vline(x, y1, y2, p, key, oo = {}) {
        A.line(x, y1 ?? ya, x, y2 ?? yb, p, key, oo);
      },
      pt(x, y, col, a = 1, r = 7) {
        dot(X(x), Y(y), r, col || INK, a);
      },
      hole(x, y, col, p = 1, key = 'h') {
        hollow(X(x), Y(y), 8, col || INK, p, key + x + '_' + y);
      },
      tick(x, label, p = 1, size = 32) {
        stroke([[X(x), oy - 7], [X(x), oy + 7]], p, 'tk' + x, { lw: 2.4, exact: true });
        if (label) ctext(label, X(x), oy + 30, size, INK, p, 1);
      },
      ytick(y, label, p = 1, size = 32) {
        stroke([[ox - 7, Y(y)], [ox + 7, Y(y)]], p, 'ty' + y, { lw: 2.4, exact: true });
        if (label) ctext(label, ox - 30, Y(y), size, INK, p, 1);
      }
    };
    return A;
  }

  function mix(s) {
    return String(s || '')
      .split('$')
      .map((seg, i) => (i % 2 ? `<span class="mx">${tex(seg)}</span>` : esc(seg)))
      .join('');
  }

  const ITEMS = {};
  function item(id, html, o) {
    if (ITEMS[id]) {
      // 避免热重载或重新初始化时抛错
      ITEMS[id].el.innerHTML = html;
      Object.assign(ITEMS[id], o);
      return;
    }
    const el = document.createElement('div');
    el.className = 'it';
    el.innerHTML = html;
    el.style.fontSize = (o.size || 56) + 'px';
    if (o.color) el.style.color = o.color;
    if (o.bold) el.style.fontWeight = '700';
    el.style.top = o.y + 'px';
    domEl.appendChild(el);
    ITEMS[id] = Object.assign({ id, el, x: CX, align: 'center' }, o);
  }

  function rectOf(id) {
    const it = ITEMS[id];
    if (!it) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: it._left || 0, y: it.y || 0, w: it._w || 0, h: it.el.offsetHeight || 0 };
  }

  let V = {};
  const show = (id, p, a = 1) => {
    if (!ITEMS[id]) return;
    if (p > 0 && a > 0) V[id] = { p: Math.min(1, p), a };
  };

  function ellAround(id, p, col, k, pad = 26) {
    if (p <= 0) return;
    const r = rectOf(id);
    stroke(
      ellPts(r.x + r.w / 2, r.y + r.h / 2, (r.w / 2) * 1.04 + pad, (r.h / 2) * 1.2 + pad * 0.5, k),
      p,
      k,
      { color: col, lw: 4 }
    );
  }
  function boxAround(id, p, col, k, pad = 18) {
    if (p <= 0) return;
    const r = rectOf(id);
    stroke(rectPts(r.x - pad, r.y - pad * 0.6, r.w + pad * 2, r.h + pad * 1.2, k), p, k, {
      color: col || INK,
      lw: 3.8
    });
  }
  function underline(id, p, col, k, dy = 8) {
    if (p <= 0) return;
    const r = rectOf(id);
    stroke(wavy(r.x - 6, r.x + r.w + 6, r.y + r.h + dy, 3, 90), p, k, { color: col || INK, lw: 3.6 });
  }
  function hiliteItem(id, p, col, k) {
    if (p <= 0) return;
    const r = rectOf(id);
    marker(r.x - 8, r.x + r.w + 8, r.y + r.h * 0.68, p, col || C.y, k, {
      lw: Math.max(18, r.h * 0.42),
      alpha: 0.34
    });
  }
  function cnum(n, x, y, p, col, k) {
    stroke(ellPts(x, y, 30, 28, k, 1.08), p, k, { color: col || INK, lw: 3.4 });
    ctext(String(n), x, y + 2, 42, col || INK, Math.min(1, p * 1.5), 1, 1);
  }
  function tagBg(id, p, col, k) {
    if (p <= 0) return;
    const r = rectOf(id);
    hatch(r.x - 12, r.y - 4, r.w + 24, r.h + 8, p, col || C.b, k + 'h', { alpha: 0.3, sp: 12, lw: 12 });
    stroke(rectPts(r.x - 14, r.y - 6, r.w + 28, r.h + 12, k), p, k, { color: col || C.b, lw: 3 });
  }

  // 场景调度
  const SCENES = [];
  function scene(s) {
    SCENES.push(s);
  }
  const TR = 0.8;

  function drawTitle(s, t) {
    if (!s.title) return;
    const id = 'T_' + s.id;
    if (!ITEMS[id]) return;
    const p = pr(t, s.t0 + 0.45, 0.8);
    show(id, p);
    const r = rectOf(id);
    marker(r.x - 8, r.x + r.w + 12, r.y + r.h - 22, pr(t, s.t0 + 0.9, 0.6), s.tcol || C.y, 'tm' + s.id, {
      lw: 26,
      alpha: 0.36
    });
    stroke(wavy(r.x - 4, r.x + r.w + 14, r.y + r.h + 4, 2.5, 70), pr(t, s.t0 + 1.0, 0.6), 'tu' + s.id, { lw: 3.2 });
  }

  function drawScene(s, t) {
    TNOW = t;
    V = {};
    drawTitle(s, t);
    if (typeof s.draw === 'function') {
      s.draw(t);
    }
    return V;
  }

  function sceneAt(t) {
    let k = 0;
    for (let i = 0; i < SCENES.length; i++) {
      if (t >= SCENES[i].t0) k = i;
    }
    return k;
  }

  function layout() {
    const groups = {};
    for (const id in ITEMS) {
      const it = ITEMS[id];
      const w = it.el.offsetWidth;
      it._w = w;
      if (it.group) {
        (groups[it.group] = groups[it.group] || []).push(it);
        continue;
      }
      it._left = it.align === 'left' ? it.x : it.align === 'right' ? it.x - w : it.x - w / 2;
    }
    for (const g in groups) {
      const L = groups[g];
      let tot = 0;
      L.forEach((it, k) => (tot += it._w + (k ? (it.gap ?? 40) : 0)));
      let x = (L[0].gx ?? CX) - tot / 2;
      L.forEach((it, k) => {
        if (k) x += it.gap ?? 40;
        it._left = x;
        x += it._w;
      });
    }
  }

  function applyDom(vis, region, set) {
    for (const id in vis) {
      const it = ITEMS[id];
      const v = vis[id];
      const L = it._left;
      const w = it._w;
      let li = -60;
      let ri = v.p >= 1 ? -60 : (1 - v.p) * w;
      if (region) {
        li = Math.max(li, region[0] - L);
        ri = Math.max(ri, L + w - region[1]);
      }
      if (li >= w || ri >= w) continue;
      set[id] = { li, ri, a: v.a };
    }
  }

  function drawEraser(x, dt) {
    const c = tctx;
    const y = 540 + 360 * Math.sin(dt * 26);
    for (let i = 0; i < 26; i++) {
      const cx = x - 20 - rand(i * 3.3) * 260;
      const cy = 150 + rand(i * 5.1) * 800 + dt * 120 * rand(i);
      if (cx < 0) continue;
      c.fillStyle = `rgba(200,140,140,${0.35 * (1 - rand(i * 2.2) * 0.5)})`;
      c.beginPath();
      c.ellipse(cx, cy, 3 + rand(i) * 4, 2 + rand(i * 7) * 3, rand(i * 9) * 3, 0, 7);
      c.fill();
    }
    c.save();
    c.translate(x, y);
    c.rotate(-0.35);
    c.fillStyle = '#f2c6c0';
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    c.beginPath();
    c.roundRect(-70, -42, 140, 84, 12);
    c.fill();
    c.stroke();
    c.fillStyle = '#5d86c9';
    c.beginPath();
    c.roundRect(-70, -42, 62, 84, [12, 0, 0, 12]);
    c.fill();
    c.stroke();
    c.restore();
  }

  function drawFlap(fx, u) {
    const c = tctx;
    const fw = Math.min((W - fx) * 0.55, fx + 40);
    const sh = c.createLinearGradient(fx, 0, fx + 90, 0);
    sh.addColorStop(0, 'rgba(60,45,20,0.28)');
    sh.addColorStop(1, 'rgba(60,45,20,0)');
    c.fillStyle = sh;
    c.fillRect(fx, 0, 90, H);
    if (fw <= 2) return;
    const lift = 40 * Math.sin(u * Math.PI);
    c.save();
    c.beginPath();
    c.moveTo(fx, 0);
    c.lineTo(fx - fw, -lift);
    c.lineTo(fx - fw, H + lift);
    c.lineTo(fx, H);
    c.closePath();
    c.fillStyle = '#ece4d2';
    c.fill();
    const g = c.createLinearGradient(fx - fw, 0, fx, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.25)');
    g.addColorStop(0.85, 'rgba(80,60,30,0.05)');
    g.addColorStop(1, 'rgba(80,60,30,0.22)');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(42,40,51,0.55)';
    c.lineWidth = 2;
    c.stroke();
    const sh2 = c.createLinearGradient(fx - fw - 50, 0, fx - fw, 0);
    sh2.addColorStop(0, 'rgba(60,45,20,0)');
    sh2.addColorStop(1, 'rgba(60,45,20,0.18)');
    c.fillStyle = sh2;
    c.fillRect(fx - fw - 50, 0, 50, H);
    c.restore();
  }

  let laidOut = false;
  function renderAt(t) {
    t = Math.max(0, t);
    if (!laidOut) {
      layout();
      laidOut = true;
    }
    ctx = ctx0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(paper, 0, 0);
    tctx.clearRect(0, 0, W, H);
    if (!SCENES.length) return;

    const k = sceneAt(t);
    const n = SCENES[k];
    const set = {};
    const inTr = k > 0 && t < n.t0 + TR;

    if (inTr) {
      const pn = SCENES[k - 1];
      const flip = !!n.flip;
      const u = lin(t, n.t0, n.t0 + (flip ? 0.75 : 0.6));
      let bx = flip ? W * (1 - io(u)) : -120 + io(u) * (W + 240);
      ctx.save();
      ctx.beginPath();
      if (flip) ctx.rect(0, 0, bx, H);
      else ctx.rect(bx, 0, W - bx, H);
      ctx.clip();
      const ov = drawScene(pn, pn.t1 - 0.01);
      ctx.restore();
      applyDom(ov, flip ? [-1e4, bx] : [bx, 1e4], set);

      ctx.save();
      ctx.beginPath();
      if (flip) ctx.rect(bx, 0, W - bx, H);
      else ctx.rect(0, 0, Math.max(0, bx), H);
      ctx.clip();
      ctx.drawImage(paper, 0, 0);
      const nv = drawScene(n, t);
      ctx.restore();
      applyDom(nv, flip ? [bx, 1e4] : [-1e4, bx], set);
      if (flip) drawFlap(bx, u);
      else drawEraser(bx, t - n.t0);
    } else {
      const nv = drawScene(n, t);
      applyDom(nv, null, set);
    }

    for (const id in ITEMS) {
      const it = ITEMS[id];
      const s = set[id];
      const st = it.el.style;
      if (!s) {
        if (st.visibility !== 'hidden') st.visibility = 'hidden';
        continue;
      }
      st.visibility = 'visible';
      st.left = it._left + 'px';
      st.opacity = s.a;
      st.clipPath = `inset(-60px ${s.ri}px -60px ${s.li}px)`;
    }
  }

  function fixPunct(root, sel) {
    root.querySelectorAll(sel).forEach((e) => {
      const n = e.nextSibling;
      const pv = e.previousSibling;
      const P = /[，。：；、？！）（“”]/;
      if (n && n.nodeType === 3 && P.test(n.textContent[0] || '')) e.style.marginRight = '0';
      if (!n) e.style.marginRight = '0';
      if (pv && pv.nodeType === 3 && P.test(pv.textContent.slice(-1))) e.style.marginLeft = '0';
      if (!pv) e.style.marginLeft = '0';
    });
  }

  function preloadFonts() {
    let s = '0123456789?';
    cues.forEach((c) => (s += c[2]));
    Object.values(ITEMS).forEach((it) => (s += it.el.textContent));
    if (preEl) {
      preEl.innerHTML = `<span>${esc(s)}</span><b>${esc(s)}</b>`;
    }
    if (document.fonts) {
      document.fonts.load('400 40px "LXGW WenKai"', s);
      document.fonts.load('700 40px "LXGW WenKai"', s);
    }
    domEl.querySelectorAll('.it').forEach((el) => fixPunct(el, '.mx'));
    SCENES.sort((a, b) => a.t0 - b.t0);
    SCENES.forEach((s) => {
      if (s.title && !ITEMS['T_' + s.id]) {
        item('T_' + s.id, mix(s.title), { size: 72, bold: 1, x: 70, y: 34, align: 'left' });
      }
    });
  }

  // 大纲路线图
  (parts || []).forEach((s, i) => {
    item('RM_' + i, mix(s), { size: 64, x: 300, y: 230 + i * 150, align: 'left' });
  });

  function roadmap(t, t0, cur) {
    (parts || []).forEach((s, i) => {
      const p = pr(t, t0 + 0.3 + i * 0.25, 0.6);
      show('RM_' + i, p, i === cur ? 1 : 0.38);
      cnum(i + 1, 230, 230 + i * 150 + 42, p, i === cur ? CT.p : CT.mute, 'rmc' + i);
      if (i === cur) {
        const r = rectOf('RM_' + i);
        marker(r.x - 8, r.x + r.w + 10, r.y + r.h - 24, pr(t, t0 + 1.3, 0.6), C.p, 'rmm' + i, { lw: 30, alpha: 0.3 });
      }
    });
  }

  const SK = {
    W,
    H,
    INK,
    C,
    CT,
    FONT,
    CX,
    SAFE,
    E,
    lin,
    out,
    io,
    pr,
    rand,
    J,
    hsh,
    get ctx() {
      return ctx;
    },
    get TNOW() {
      return TNOW;
    },
    stroke,
    rectPts,
    ellPts,
    circPts,
    lineH,
    lineV,
    wavy,
    arrow,
    check,
    cross,
    hatch,
    marker,
    ctext,
    dot,
    hollow,
    axes,
    esc,
    mix,
    item,
    rectOf,
    show,
    ellAround,
    boxAround,
    underline,
    hiliteItem,
    cnum,
    tagBg,
    scene,
    roadmap,
    tex,
    ITEMS
  };

  function executeScenes(scenesCode) {
    // 注入当前实例作为 SK 全局变量供动态场景脚本解构与调用
    window.SK = SK;
    window.L4 = SK;
    window.tex = tex;
    window.renderAt = renderAt;

    if (scenesCode && scenesCode.trim()) {
      try {
        const fn = new Function(scenesCode);
        fn();
      } catch (err) {
        console.error('[LectureEngine] 场景脚本执行错误:', err);
        throw err;
      }
    }
  }

  function destroy() {
    domEl.innerHTML = '';
    if (preEl) preEl.innerHTML = '';
    SCENES.length = 0;
    for (const k in ITEMS) delete ITEMS[k];
    if (window.SK === SK) delete window.SK;
    if (window.L4 === SK) delete window.L4;
  }

  return {
    SK,
    SCENES,
    ITEMS,
    renderAt,
    executeScenes,
    preloadFonts,
    destroy
  };
}
