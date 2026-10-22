// 全局进度条调度器
let barInstance = null;
let activeRequests = 0;
let isNavigating = false;
let finishTimeout = null;

// 注册进度条组件实例
export function registerProgressBar(instance) {
  barInstance = instance;
}

// 启动进度递增
export function startProgress() {
  if (finishTimeout) {
    clearTimeout(finishTimeout);
    finishTimeout = null;
  }
  barInstance?.start();
}

// 完成进度条冲刺
export function finishProgress(force = false) {
  if (force) {
    if (finishTimeout) clearTimeout(finishTimeout);
    finishTimeout = null;
    activeRequests = 0;
    isNavigating = false;
    barInstance?.finish();
    return;
  }

  // 待全部请求完成且导航结束时完成
  if (activeRequests === 0 && !isNavigating) {
    if (finishTimeout) clearTimeout(finishTimeout);
    // 防抖缓冲避免频闪
    finishTimeout = setTimeout(() => {
      if (activeRequests === 0 && !isNavigating) {
        barInstance?.finish();
      }
    }, 80);
  }
}

// 标记加载失败
export function failProgress() {
  if (finishTimeout) clearTimeout(finishTimeout);
  finishTimeout = null;
  barInstance?.fail();
}

// 接口请求开始
export function beginApiRequest() {
  activeRequests++;
  if (activeRequests === 1) {
    startProgress();
  }
}

// 接口请求结束
export function endApiRequest(success = true) {
  activeRequests = Math.max(0, activeRequests - 1);
  if (!success && activeRequests === 0) {
    failProgress();
  } else {
    finishProgress();
  }
}

// 路由跳转开始
export function beginNavigation() {
  isNavigating = true;
  startProgress();
}

// 路由跳转结束
export function endNavigation() {
  isNavigating = false;
  finishProgress();
}
