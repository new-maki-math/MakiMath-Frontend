const SVG_NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;

function mesh(point, firstCount, secondCount, firstSteps, secondSteps) {
  const paths = [];
  for (let family = 0; family < 2; family++) {
    const count = family === 0 ? firstCount : secondCount;
    const steps = family === 0 ? firstSteps : secondSteps;
    const lines = [];
    for (let index = 0; index <= count; index++) {
      for (let step = 0; step <= steps; step++) {
        const u = family === 0 ? step / steps : index / count;
        const v = family === 0 ? index / count : step / steps;
        const [x, y] = point(u, v);
        lines.push(`${step === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
      }
    }
    paths.push(lines.join(''));
  }
  return paths;
}

const illustrations = [
  {
    label: 'MÖBIUS STRIP  /  莫比乌斯带',
    note: 'ONE SIDE · ONE EDGE',
    paths: () =>
      mesh(
        (u, v) => {
          const angle = u * TAU;
          const width = (v - 0.5) * 1.16;
          const radius = 1 + width * Math.cos(angle / 2);
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          const z = width * Math.sin(angle / 2);
          return [260 + x * 145 + y * 30, 150 + y * 38 - z * 85 + x * 12];
        },
        12,
        48,
        180,
        12
      )
  },
  {
    label: 'HYPERBOLIC PARABOLOID  /  双曲抛物面',
    note: 'z = x² − y²',
    paths: () =>
      mesh(
        (u, v) => {
          const x = (u - 0.5) * 4.8;
          const y = (v - 0.5) * 4.8;
          return [260 + (x - y) * 45, 150 + (x + y) * 14 - (x * x - y * y) * 10];
        },
        24,
        24,
        80,
        80
      )
  },
  {
    label: 'TORUS  /  环面',
    note: 'A SURFACE OF REVOLUTION',
    paths: () =>
      mesh(
        (u, v) => {
          const angle = u * TAU;
          const cross = v * TAU;
          const radius = 1 + 0.38 * Math.cos(cross);
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          const z = 0.38 * Math.sin(cross);
          return [260 + x * 145 + y * 35, 150 + y * 52 - z * 100 + x * 10];
        },
        18,
        42,
        120,
        60
      )
  },
  {
    label: 'WAVE SURFACE  /  波浪曲面',
    note: 'z = sin(x) cos(y)',
    paths: () =>
      mesh(
        (u, v) => {
          const x = (u - 0.5) * 5;
          const y = (v - 0.5) * 5;
          const z = Math.sin(x) * Math.cos(y);
          return [260 + (x - y) * 40, 150 + (x + y) * 13 - z * 55];
        },
        24,
        24,
        80,
        80
      )
  },
  {
    label: 'GAUSSIAN SURFACE  /  高斯曲面',
    note: 'z = exp(−(x² + y²) / 2)',
    paths: () =>
      mesh(
        (u, v) => {
          const x = (u - 0.5) * 5;
          const y = (v - 0.5) * 5;
          const z = Math.exp(-(x * x + y * y) / 2);
          return [260 + (x - y) * 40, 170 + (x + y) * 13 - z * 90];
        },
        24,
        24,
        80,
        80
      )
  }
];

export function createCoverIllustration(target) {
  const design = illustrations[Math.floor(Math.random() * illustrations.length)];
  const svg = target.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'print-cover-graph');
  svg.setAttribute('viewBox', '0 0 520 300');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', design.label);
  design.paths().forEach((data, index) => {
    const path = target.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', data);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', index === 0 ? '1' : '0.7');
    path.setAttribute('opacity', index === 0 ? '0.8' : '0.48');
    svg.appendChild(path);
  });
  return {
    svg,
    label: design.label,
    note: design.note
  };
}
