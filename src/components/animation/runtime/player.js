// 动画内容注册绘制函数和时间段；播放与交互由平台统一管理。
(() => {
  const stage = document.getElementById('animation-stage');
  const viewport = document.getElementById('animation-viewport');
  const config = window.__MAKI_ANIMATION_CONFIG__;
  const assets = window.__MAKI_ANIMATION_ASSETS__;
  let pages = [];
  let render = null;
  let page = 0;
  let step = 0;
  let frame = null;

  function report(error = '') {
    const selected = pages[page];
    parent.postMessage(
      {
        type: 'maki-animation-state',
        page: page + 1,
        pages: pages.length,
        step: step + 1,
        steps: selected?.steps.length || 0,
        title: selected?.title || '',
        width: config.width,
        height: config.height,
        error
      },
      '*'
    );
  }
  function fit() {
    const scale = viewport.clientWidth / config.width;
    viewport.style.height = `${config.height * scale}px`;
    stage.style.transform = `scale(${scale})`;
  }
  let lastWidth = 0;
  let resizeFrame = null;
  new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width || 0;
    if (!width || width === lastWidth) {
      return;
    }
    lastWidth = width;
    if (resizeFrame !== null) {
      cancelAnimationFrame(resizeFrame);
    }
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      fit();
    });
  }).observe(viewport);
  function stop() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
    }
    frame = null;
  }
  function draw(time) {
    try {
      render(time, stage, window.MakiAnimation);
      return true;
    } catch (error) {
      stop();
      report(error?.message || '动画绘制失败');
      return false;
    }
  }
  function go(nextPage, nextStep, animate = false) {
    if (!pages.length || !render) {
      return;
    }
    stop();
    const previousPage = page;
    const previousStep = step;
    page = Math.max(0, Math.min(pages.length - 1, nextPage));
    step = Math.max(0, Math.min(pages[page].steps.length - 1, nextStep));
    const selected = pages[page].steps[step];
    const from =
      animate && previousPage === page && previousStep + 1 === step
        ? pages[page].steps[previousStep].end
        : selected.start;
    if (!animate || selected.end <= from) {
      if (!draw(selected.end)) {
        return;
      }
    } else {
      const duration = Math.max(150, Math.min(1200, (selected.end - from) * 600));
      const began = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - began) / duration);
        if (!draw(from + (selected.end - from) * progress)) {
          return;
        }
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          frame = null;
        }
      };
      frame = requestAnimationFrame(tick);
    }
    report();
  }
  window.MakiAnimation = {
    stage,
    asset(path) {
      if (!Object.hasOwn(assets, path)) {
        throw new Error(`动画资源不存在：${path}`);
      }
      return assets[path];
    },
    register(definition) {
      if (
        typeof definition?.render !== 'function' ||
        !Array.isArray(definition.pages) ||
        !definition.pages.length
      ) {
        throw new Error('动画必须注册绘制函数和页面');
      }
      for (const item of definition.pages) {
        if (
          !Array.isArray(item.steps) ||
          !item.steps.length ||
          item.steps.some(
            (value) =>
              !Number.isFinite(value.start) ||
              !Number.isFinite(value.end) ||
              value.start > value.end
          )
        ) {
          throw new Error('动画步骤时间格式不正确');
        }
      }
      pages = definition.pages;
      render = definition.render;
      page = 0;
      step = 0;
      const ready = document.fonts ? document.fonts.ready : Promise.resolve();
      ready
        .then(() => {
          fit();
          go(0, 0);
        })
        .catch((error) => report(error?.message || '动画加载失败'));
    }
  };
  addEventListener('error', (event) => {
    if (
      /^ResizeObserver loop (?:completed with undelivered notifications|limit exceeded)/.test(
        event.message || ''
      )
    ) {
      return;
    }
    report(event.message || '动画脚本加载失败');
  });
  addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.type !== 'maki-animation-command' || !pages.length) {
      return;
    }
    const action = event.data.action;
    if (action === 'next') {
      if (step + 1 < pages[page].steps.length) {
        go(page, step + 1, true);
      } else if (page + 1 < pages.length) {
        go(page + 1, 0, true);
      }
    } else if (action === 'prev') {
      if (step > 0) {
        go(page, step - 1);
      } else if (page > 0) {
        go(page - 1, pages[page - 1].steps.length - 1);
      }
    } else if (action === 'reset') {
      go(0, 0);
    }
  });
  addEventListener('load', () => {
    if (!render) {
      report('动画未注册播放器');
    }
  });
})();
