/**
 * MakiMath API 统一客户端
 * 接入生产服务器 baseurl: https://maki-math.com/
 * 挂钩全局进度条生命周期，请求期间保持顶部进度条平滑递增直至数据全部到达
 */
import { beginApiRequest, endApiRequest } from '../utils/progress.js';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const API_BASE = env.VITE_API_BASE !== undefined
  ? env.VITE_API_BASE
  : (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? '' : 'https://maki-math.com');

export async function request(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    ...rest
  } = options;

  // 只有真的带 body 才算「JSON 体」。DELETE 这类没有 body 的请求若声明了
  // Content-Type: application/json，Fastify 会以 FST_ERR_CTP_EMPTY_JSON_BODY 直接拒掉。
  const hasBody = body !== undefined && body !== null;

  const defaultHeaders = {};
  // 仅在非 GET/HEAD 请求时添加防护头，避免对 GET 请求触发浏览器非简单请求预检 (OPTIONS)
  if (method !== 'GET' && method !== 'HEAD') {
    defaultHeaders['x-mm'] = '1';
  }
  if (hasBody) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    method,
    headers: {
      ...defaultHeaders,
      ...headers
    },
    ...rest
  };

  if (hasBody) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const fullUrl = API_BASE ? `${API_BASE}${url}` : url;

  beginApiRequest();
  try {
    const res = await fetch(fullUrl, config);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error = new Error(errData.error || errData.message || `HTTP Error ${res.status}`);
      error.status = res.status;
      error.data = errData;
      throw error;
    }
    if (res.status === 204) {
      endApiRequest(true);
      return null;
    }
    const text = await res.text();
    endApiRequest(true);
    return text ? JSON.parse(text) : null;
  } catch (err) {
    endApiRequest(false);
    console.warn(`[API] 请求 ${url} 失败:`, err.message);
    throw err;
  }
}

