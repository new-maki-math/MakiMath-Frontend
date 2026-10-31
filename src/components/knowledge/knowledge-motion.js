// 计算贝塞尔曲线的时间进度
export function bezierProgress(progress, x1, y1, x2, y2) {
  if (progress <= 0) {
    return 0;
  }
  if (progress >= 1) {
    return 1;
  }
  const value = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 18; i++) {
    const middle = (low + high) / 2;
    if (value(middle, x1, x2) < progress) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return value((low + high) / 2, y1, y2);
}
