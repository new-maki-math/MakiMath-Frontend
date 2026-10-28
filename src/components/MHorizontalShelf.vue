<script setup>
import { onUnmounted } from 'vue';

const shelfAnimations = new Map();

function stopShelfAnimation(shelf) {
  const animation = shelfAnimations.get(shelf);
  if (!animation) return;
  cancelAnimationFrame(animation.frame);
  shelfAnimations.delete(shelf);
}

function scrollShelf(event) {
  const shelf = event.currentTarget;
  if (event.ctrlKey || event.metaKey) return;
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
    stopShelfAnimation(shelf);
    return;
  }
  const maxScroll = shelf.scrollWidth - shelf.clientWidth;
  if (maxScroll <= 0) return;
  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? shelf.clientWidth : 1);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || (event.deltaMode === 0 && Math.abs(event.deltaY) < 50)) {
    stopShelfAnimation(shelf);
    shelf.scrollLeft += delta;
    return;
  }
  let animation = shelfAnimations.get(shelf);
  if (!animation) {
    animation = { target: shelf.scrollLeft, frame: 0, lastTime: 0 };
    shelfAnimations.set(shelf, animation);
  }
  animation.target = Math.max(0, Math.min(maxScroll, animation.target + delta));
  if (animation.frame) return;
  const tick = (time) => {
    if (!shelf.isConnected) { stopShelfAnimation(shelf); return; }
    const elapsed = animation.lastTime ? Math.min(time - animation.lastTime, 50) : 16;
    animation.lastTime = time;
    animation.target = Math.max(0, Math.min(shelf.scrollWidth - shelf.clientWidth, animation.target));
    const distance = animation.target - shelf.scrollLeft;
    if (Math.abs(distance) < 0.5) {
      shelf.scrollLeft = animation.target;
      shelfAnimations.delete(shelf);
      return;
    }
    shelf.scrollLeft += distance * (1 - Math.exp(-elapsed / 85));
    animation.frame = requestAnimationFrame(tick);
  };
  animation.frame = requestAnimationFrame(tick);
}


onUnmounted(() => { for (const shelf of shelfAnimations.keys()) stopShelfAnimation(shelf); });
</script>

<template>
  <div class="horizontal-shelf" @wheel="scrollShelf" @pointerdown="stopShelfAnimation($event.currentTarget)"><slot /></div>
</template>

<style scoped>
.horizontal-shelf { display: flex; flex: 1; align-items: flex-start; min-width: 0; min-height: 0; gap: 24px; overflow-x: auto; overflow-y: hidden; padding: 2px 2px 10px; overscroll-behavior-x: contain; }
.horizontal-shelf :deep(.lecture-cover) { flex: 0 0 auto; width: auto; height: 100%; max-height: 255px; }
@media (max-width: 480px) { .horizontal-shelf { gap: 14px; } }
</style>
