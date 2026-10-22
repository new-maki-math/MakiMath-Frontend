// 统一请求客户端
import { beginApiRequest, endApiRequest } from '../utils/progress.js';
import {
  encryptPayload,
  decryptPayload,
  isEncryptedPayload,
  getClientPublicKey,
} from '../vendor/secure-core.min.js';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const API_BASE = env.VITE_API_BASE !== undefined
  ? env.VITE_API_BASE
  : (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? '' : 'https://maki-math.com');

// 请求拦截处理器
export async function requestInterceptor(config) {
  if (config.body != null) {
    let payload = config.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = config.body;
      }
    }
    // 避免重复加密
    if (!isEncryptedPayload(payload)) {
      const encrypted = await encryptPayload(payload);
      config.body = JSON.stringify(encrypted);
    }
    config.headers = config.headers || {};
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
}

// 响应拦截处理器
export async function responseInterceptor(data) {
  if (isEncryptedPayload(data)) {
    return await decryptPayload(data);
  }
  return data;
}

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

  let config = {
    method,
    headers: {
      ...defaultHeaders,
      ...headers
    },
    body,
    ...rest
  };

  // 注入公钥
  try {
    const cp = await getClientPublicKey();
    if (cp) {
      config.headers['x-cp'] = cp;
    }
  } catch {}

  // 混淆加密
  if (hasBody) {
    config = await requestInterceptor(config);
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
    if (!text) return null;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return text;
    }

    // 解密混淆
    return await responseInterceptor(parsed);
  } catch (err) {
    endApiRequest(false);
    console.warn(`[API] 请求 ${url} 失败:`, err.message);
    throw err;
  }
}
