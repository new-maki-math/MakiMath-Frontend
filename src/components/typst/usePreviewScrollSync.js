import { onBeforeUnmount, ref } from 'vue';

export function usePreviewScrollSync(editorRef, previewRef) {
  const scrollSyncEnabled = ref(false);
  let previewScrollTarget = null;
  let editorScrollTarget = null;
  let updatingEditor = false;
  let scrollFrame = 0;

  function previewAnchors() {
    const preview = previewRef.value;
    if (!preview) return [];
    const containerTop = preview.getBoundingClientRect().top;
    return Array.from(preview.querySelectorAll('.typst-source-anchor')).map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect();
      return { start: Number(element.dataset.sourceStart), end: Number(element.dataset.sourceEnd), top: rect.top - containerTop + preview.scrollTop, height: rect.height };
    }).filter((anchor) => Number.isFinite(anchor.start) && Number.isFinite(anchor.end) && anchor.height > 0);
  }

  function syncPreview({ offset, scrollTop }) {
    if (!scrollSyncEnabled.value || updatingEditor) return;
    if (editorScrollTarget !== null && Math.abs(scrollTop - editorScrollTarget) < 2) {
      editorScrollTarget = null;
      return;
    }
    editorScrollTarget = null;
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const preview = previewRef.value;
      if (!preview) return;
      const anchors = previewAnchors();
      const anchor = anchors.find((item) => offset >= item.start && offset < item.end) || anchors.find((item) => item.start >= offset) || anchors.at(-1);
      if (!anchor) return;
      const fraction = Math.max(0, Math.min(1, (offset - anchor.start) / Math.max(1, anchor.end - anchor.start)));
      const target = Math.max(0, Math.min(preview.scrollHeight - preview.clientHeight, anchor.top + anchor.height * fraction));
      if (Math.abs(preview.scrollTop - target) < 1) return;
      previewScrollTarget = target;
      preview.scrollTop = target;
    });
  }

  function syncEditor() {
    if (!scrollSyncEnabled.value) return;
    const preview = previewRef.value;
    if (!preview) return;
    if (previewScrollTarget !== null && Math.abs(preview.scrollTop - previewScrollTarget) < 2) {
      previewScrollTarget = null;
      return;
    }
    previewScrollTarget = null;
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const anchors = previewAnchors();
      const position = preview.scrollTop;
      const anchor = anchors.find((item) => position >= item.top && position < item.top + item.height) || anchors.find((item) => item.top >= position) || anchors.at(-1);
      if (!anchor) return;
      const fraction = Math.max(0, Math.min(1, (position - anchor.top) / anchor.height));
      updatingEditor = true;
      try {
        editorScrollTarget = editorRef.value?.scrollToOffset(anchor.start + (anchor.end - anchor.start) * fraction) ?? null;
      } finally {
        updatingEditor = false;
      }
    });
  }

  function toggleScrollSync() {
    scrollSyncEnabled.value = !scrollSyncEnabled.value;
    cancelAnimationFrame(scrollFrame);
    previewScrollTarget = null;
    editorScrollTarget = null;
    if (scrollSyncEnabled.value) {
      const position = editorRef.value?.getScrollPosition();
      if (position) syncPreview(position);
    }
  }

  onBeforeUnmount(() => cancelAnimationFrame(scrollFrame));

  return { scrollSyncEnabled, syncPreview, syncEditor, toggleScrollSync };
}
