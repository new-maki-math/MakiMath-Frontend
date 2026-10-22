// 统一请求客户端
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

  // 仅在带 body 时声明 json 请求头
  const hasBody = body !== undefined && body !== null;

  const defaultHeaders = {};
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

