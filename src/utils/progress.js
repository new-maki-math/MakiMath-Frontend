/**
 * 全局进度条协调器 (Global Progress Coordinator)
 * 统一联动路由生命周期与底层 API 请求状态，确保进度条等待所有异步 API 数据获取完毕后才完成
 */

let barInstance = null;
let activeRequests = 0;
let isNavigating = false;
let finishTimeout = null;

/**
 * 注册 ProgressBar 实例引用
 */
export function registerProgressBar(instance) {
  barInstance = instance;
}

/**
 * 启动进度条递增
 */
export function startProgress() {
  if (finishTimeout) {
    clearTimeout(finishTimeout);
    finishTimeout = null;
  }
  barInstance?.start();
}

/**
 * 完成进度条冲刺与淡出（智能等待所有请求完成）
 * @param {boolean} force 是否立即强制完成
 */
export function finishProgress(force = false) {
  if (force) {
    if (finishTimeout) clearTimeout(finishTimeout);
    finishTimeout = null;
    activeRequests = 0;
    isNavigating = false;
    barInstance?.finish();
    return;
  }

  // 只有当没有正在进行的 API 请求且路由导航已完成时才触发完成
  if (activeRequests === 0 && !isNavigating) {
    if (finishTimeout) clearTimeout(finishTimeout);
    // 80ms 防抖缓冲，避免相邻微任务或链式请求导致进度条闪烁
    finishTimeout = setTimeout(() => {
      if (activeRequests === 0 && !isNavigating) {
        barInstance?.finish();
      }
    }, 80);
  }
}

/**
 * 标记加载失败状态（红色警示后淡出）
 */
export function failProgress() {
  if (finishTimeout) clearTimeout(finishTimeout);
  finishTimeout = null;
  barInstance?.fail();
}

/**
 * 挂钩 API 请求开始
 */
export function beginApiRequest() {
  activeRequests++;
  if (activeRequests === 1) {
    startProgress();
  }
}

/**
 * 挂钩 API 请求结束
 * @param {boolean} success 请求是否成功
 */
export function endApiRequest(success = true) {
  activeRequests = Math.max(0, activeRequests - 1);
  if (!success && activeRequests === 0) {
    failProgress();
  } else {
    finishProgress();
  }
}

/**
 * 挂钩路由跳转开始
 */
export function beginNavigation() {
  isNavigating = true;
  startProgress();
}

/**
 * 挂钩路由跳转结束（若页面发起 API 请求，进度条将继续等待 API 完成）
 */
export function endNavigation() {
  isNavigating = false;
  finishProgress();
}
