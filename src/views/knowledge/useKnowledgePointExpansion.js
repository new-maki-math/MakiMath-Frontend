import { nextTick, onBeforeUnmount, ref } from 'vue';

const OPEN_DURATION = 850;
const CLOSE_DURATION = 400;
const OPEN_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const CLOSE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

export function useKnowledgePointExpansion(shell, fill, content, backdrop, sourceRect) {
  const phase = ref('closed');
  let animations = [];
  let motion = null;
  let sequence = 0;
  const cancel = () => { animations.forEach((animation) => animation.cancel()); animations = []; };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const geometry = (rect, parent) => ({ left: `${rect.left - parent.left}px`, top: `${rect.top - parent.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  const visibleSource = (source, target) => source && source.width > 1 && source.height > 1 && source.right > target.left && source.left < target.right && source.bottom > target.top && source.top < target.bottom;
  async function open() {
    const current = ++sequence;
    cancel();
    phase.value = 'opening';
    await nextTick();
    if (current !== sequence || !shell.value || !fill.value || !content.value) return;
    const target = shell.value.getBoundingClientRect();
    const source = sourceRect();
    const simple = reduced() || !visibleSource(source, shell.value.parentElement.getBoundingClientRect());
    const duration = simple ? 120 : OPEN_DURATION;
    const parent = shell.value.parentElement.getBoundingClientRect();
    const initial = simple ? null : geometry(source, parent);
    const final = geometry(target, parent);
    animations = [shell.value.animate(simple ? [{ opacity: 0 }, { opacity: 1 }] : [
      { ...initial, offset: 0, easing: OPEN_EASING },
      { ...final, offset: 0.72 },
      { ...final, offset: 1 }
    ], { duration }),
      fill.value.animate(simple ? [{ opacity: 1 }, { opacity: 1 }] : [
        { clipPath: 'circle(0% at 50% 50%)', offset: 0 },
        { clipPath: 'circle(0% at 50% 50%)', offset: 0.55, easing: OPEN_EASING },
        { clipPath: 'circle(150% at 50% 50%)', offset: 1 }
      ], { duration }),
      content.value.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: simple ? 0 : 0.82 }, { opacity: 1, offset: 1 }], { duration, easing: 'linear' }),
      backdrop.value.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: OPEN_EASING })];
    motion = simple ? null : { direction: 'open', final };
    try { await Promise.all(animations.map((animation) => animation.finished)); } catch { return; }
    if (current === sequence) { animations = []; motion = null; phase.value = 'open'; }
  }
  async function close() {
    const current = ++sequence;
    const currentRect = shell.value?.getBoundingClientRect();
    const currentClip = fill.value ? getComputedStyle(fill.value).clipPath : 'circle(150% at 50% 50%)';
    const currentOpacity = content.value ? getComputedStyle(content.value).opacity : '1';
    const shellOpacity = shell.value ? getComputedStyle(shell.value).opacity : '1';
    const backdropOpacity = backdrop.value ? getComputedStyle(backdrop.value).opacity : '1';
    cancel();
    if (!shell.value || !fill.value || !content.value) { phase.value = 'closed'; return true; }
    phase.value = 'closing';
    const target = shell.value.getBoundingClientRect();
    const source = sourceRect();
    const simple = reduced() || !visibleSource(source, shell.value.parentElement.getBoundingClientRect());
    const duration = simple ? 100 : CLOSE_DURATION;
    const parent = shell.value.parentElement.getBoundingClientRect();
    const currentGeometry = geometry(currentRect || target, parent);
    animations = [shell.value.animate(simple ? [{ opacity: Number(shellOpacity) }, { opacity: 0 }] : [
      { ...currentGeometry, offset: 0 },
      { ...currentGeometry, offset: 0.35, easing: CLOSE_EASING },
      { ...geometry(source, parent), offset: 1 }
    ], { duration, fill: 'forwards' }),
      fill.value.animate(simple ? [{ clipPath: currentClip }, { clipPath: currentClip }] : [
        { clipPath: currentClip, offset: 0, easing: CLOSE_EASING },
        { clipPath: 'circle(0% at 50% 50%)', offset: 0.35 },
        { clipPath: 'circle(0% at 50% 50%)', offset: 1 }
      ], { duration, fill: 'forwards' }),
      content.value.animate([{ opacity: Number(currentOpacity), offset: 0 }, { opacity: 0, offset: simple ? 1 : 0.3 }, { opacity: 0, offset: 1 }], { duration, fill: 'forwards' }),
      backdrop.value.animate([{ opacity: Number(backdropOpacity) }, { opacity: 0 }], { duration, easing: CLOSE_EASING, fill: 'forwards' })];
    motion = simple ? null : { direction: 'close', currentGeometry };
    try { await Promise.all(animations.map((animation) => animation.finished)); } catch { return; }
    if (current === sequence) { motion = null; phase.value = 'closed'; return true; }
  }
  function syncSource() {
    if (!motion || !shell.value || !animations[0]?.effect) return;
    const source = sourceRect();
    if (!source) return;
    const parent = shell.value.parentElement.getBoundingClientRect();
    const position = geometry(source, parent);
    if (motion.direction === 'open') {
      animations[0].effect.setKeyframes([
        { ...position, offset: 0, easing: OPEN_EASING },
        { ...motion.final, offset: 0.72 },
        { ...motion.final, offset: 1 }
      ]);
    } else {
      animations[0].effect.setKeyframes([
        { ...motion.currentGeometry, offset: 0 },
        { ...motion.currentGeometry, offset: 0.35, easing: CLOSE_EASING },
        { ...position, offset: 1 }
      ]);
    }
  }
  function settle() {
    if (phase.value === 'opening') { sequence++; cancel(); phase.value = 'open'; }
  }
  onBeforeUnmount(() => { sequence++; cancel(); });
  return { phase, open, close, settle, syncSource };
}
