import { pointer, zoomIdentity } from 'd3';

export function createSmoothZoom({ canvas, getTransform, setTransform, target, render }) {
  let frame = null;

  function stop() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
    }
    frame = null;
  }

  function tick() {
    const current = getTransform();
    const dk = target.k - current.k;
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const finished = Math.abs(dk) < 0.0005 && Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1;
    const transform = finished
      ? zoomIdentity.translate(target.x, target.y).scale(target.k)
      : zoomIdentity
          .translate(current.x + dx * 0.22, current.y + dy * 0.22)
          .scale(current.k + dk * 0.22);
    setTransform(transform);
    const element = canvas();
    if (element) {
      element.__zoom = transform;
    }
    render();
    frame = finished ? null : requestAnimationFrame(tick);
  }

  function onWheel(event) {
    event.preventDefault();
    const element = canvas();
    if (!element) {
      return;
    }
    const [x, y] = pointer(event, element);
    let delta = event.deltaY;
    if (event.deltaMode === 1) {
      delta *= 30;
    } else if (event.deltaMode === 2) {
      delta *= 100;
    }
    const gx = (x - target.x) / target.k;
    const gy = (y - target.y) / target.k;
    target.k = Math.max(0.15, Math.min(6, target.k * Math.exp(-delta * 0.0018)));
    target.x = x - gx * target.k;
    target.y = y - gy * target.k;
    if (frame === null) {
      frame = requestAnimationFrame(tick);
    }
  }

  return {
    stop,
    onWheel
  };
}
