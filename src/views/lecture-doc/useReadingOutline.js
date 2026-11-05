import { markRaw, onBeforeUnmount, ref, watch } from 'vue';

export function useReadingOutline(viewport, contentRoot, identity) {
  const items = ref([]);
  const activeKey = ref('');
  let cleanup = () => {};
  let instance = 0;

  function select(item) {
    const container = viewport.value;
    if (!container || !item.element.isConnected || !contentRoot.value?.contains(item.element)) {
      return;
    }
    const offset = item.element.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({
      top: Math.max(0, container.scrollTop + offset - 24),
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }

  watch(
    [viewport, contentRoot, identity],
    ([container, root], _, onCleanup) => {
      cleanup();
      items.value = [];
      activeKey.value = '';
      const currentInstance = ++instance;
      if (!container || !root) {
        return;
      }
      let frame = 0;
      let rebuild = false;
      let disposed = false;

      function update() {
        frame = 0;
        if (disposed) {
          return;
        }
        if (rebuild) {
          rebuild = false;
          const documentRoot = root.querySelector(':scope > .typst-document');
          const counters = new Map();
          const headings = documentRoot
            ? [...documentRoot.querySelectorAll('.typst-heading')].filter(
                (element) => element.closest('.typst-document') === documentRoot
              )
            : [];
          items.value = headings.map((element, index) => {
            const start =
              element.closest('.typst-source-anchor')?.dataset.sourceStart ?? `position-${index}`;
            const occurrence = counters.get(start) || 0;
            counters.set(start, occurrence + 1);
            const level =
              Number(element.getAttribute('aria-level')) || Number(element.tagName.slice(1)) || 1;
            return {
              key: `${currentInstance}:${start}:${occurrence}`,
              level,
              element: markRaw(element)
            };
          });
        }
        if (!items.value.length) {
          activeKey.value = '';
          return;
        }
        const top = container.getBoundingClientRect().top + 32;
        let active = items.value[0];
        for (const item of items.value) {
          if (item.element.getBoundingClientRect().top <= top) {
            active = item;
          } else {
            break;
          }
        }
        if (
          container.scrollHeight > container.clientHeight &&
          container.scrollTop + container.clientHeight >= container.scrollHeight - 2
        ) {
          active = items.value[items.value.length - 1];
        }
        activeKey.value = active.key;
      }

      function schedule(shouldRebuild = false) {
        rebuild ||= shouldRebuild;
        if (!frame) {
          frame = requestAnimationFrame(update);
        }
      }
      const mutation = new MutationObserver(() => schedule(true));
      mutation.observe(root, {
        childList: true,
        characterData: true,
        subtree: true
      });
      const resize =
        typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null;
      resize?.observe(root);
      resize?.observe(container);
      const onScroll = () => schedule();
      const onResize = () => schedule();
      const onFonts = () => schedule(true);
      container.addEventListener('scroll', onScroll, {
        passive: true
      });
      window.addEventListener('resize', onResize);
      document.fonts?.addEventListener('loadingdone', onFonts);
      document.fonts?.ready.then(() => {
        if (!disposed) {
          schedule(true);
        }
      });
      schedule(true);
      cleanup = () => {
        disposed = true;
        mutation.disconnect();
        resize?.disconnect();
        container.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        document.fonts?.removeEventListener('loadingdone', onFonts);
        if (frame) {
          cancelAnimationFrame(frame);
        }
      };
      onCleanup(cleanup);
    },
    {
      immediate: true,
      flush: 'post'
    }
  );

  onBeforeUnmount(() => cleanup());
  return {
    items,
    activeKey,
    select
  };
}
