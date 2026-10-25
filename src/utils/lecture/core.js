import katex from 'katex';

export const ease = {
  clamp: (x) => Math.max(0, Math.min(1, x)),
  lin: (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a))),
  io: (x) => {
    x = Math.max(0, Math.min(1, x));
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  },
  out: (x) => {
    x = Math.max(0, Math.min(1, x));
    return 1 - Math.pow(1 - x, 3);
  },
  spring: (x, k = 9, z = 0.55) => {
    if (x <= 0) return 0;
    const w = k;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
  }
};

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export function rand(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function tex(s, display = false) {
  try {
    return katex.renderToString(s, { throwOnError: false, displayMode: !!display });
  } catch (e) {
    return esc(s);
  }
}

export function capHTML(text, opts = {}) {
  const SUB = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n'
  };
  const re = /x[₀₁₂₃₄₅₆₇₈₉ₙ]+|\b\d*[a-z](?:\+\d+)?\b/g;
  let out = '';
  let last = 0;
  let m;
  const str = String(text || '');
  while ((m = re.exec(str))) {
    out += esc(str.slice(last, m.index));
    let t = m[0].startsWith('x') && m[0].length > 1 && SUB[m[0][1]] !== undefined
      ? 'x_{' + [...m[0].slice(1)].map(c => SUB[c]).join('') + '}'
      : m[0];
    const html = tex(t);
    out += `<span class="cm" style="margin:0 ${opts.gap || '.12em'}">${html}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(str.slice(last));
}

export function texHTML(s) {
  return String(s || '')
    .split('$')
    .map((seg, i) => (i % 2 ? tex(seg) : esc(seg)))
    .join('');
}

// 兼容场景脚本直接全局调用的辅助函数
if (typeof window !== 'undefined') {
  window.katex = katex;
  window.tex = tex;
  window.capHTML = capHTML;
  window.ease = ease;
  window.rand = rand;
  window.esc = esc;
}
