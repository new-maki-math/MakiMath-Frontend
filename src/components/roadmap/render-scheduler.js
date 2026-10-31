export function createRenderScheduler(render) {
  let frame = null;

  function requestRender() {
    if (frame !== null) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = null;
      if (render()) {
        requestRender();
      }
    });
  }

  function cancelRender() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
    }
    frame = null;
  }

  return {
    requestRender,
    cancelRender
  };
}
