// 统一请求客户端
import { getAuthToken } from '../utils/auth-storage.js';
import { beginApiRequest, endApiRequest } from '../utils/progress.js';
import {
  decryptPayload,
  encryptPayload,
  getClientPublicKey,
  isEncryptedPayload
} from '../vendor/secure-core.min.js';

const API_BASE = import.meta.env?.VITE_API_BASE ?? '';
let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

// 请求拦截处理器
async function requestInterceptor(config) {
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
async function responseInterceptor(data) {
  if (isEncryptedPayload(data)) {
    return await decryptPayload(data);
  }
  return data;
}

export async function request(url, options = {}) {
  const { method = 'GET', headers = {}, body, retryAuth = true, ...rest } = options;

  // 仅在带 body 时声明 json 请求头
  const hasBody = body !== undefined && body !== null;

  const defaultHeaders = {};
  if (method !== 'GET' && method !== 'HEAD') {
    defaultHeaders['x-mm'] = '1';
  }
  if (hasBody) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  // 注入认证 Token
  const token = getAuthToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  let config = {
    method,
    headers: {
      ...defaultHeaders,
      ...headers
    },
    credentials: 'omit',
    body,
    ...rest
  };

  // 注入公钥
  const cp = await getClientPublicKey();
  if (!cp) {
    throw new Error('无法建立安全通信');
  }
  config.headers['x-cp'] = cp;

  // 混淆加密
  if (hasBody) {
    config = await requestInterceptor(config);
  }

  const fullUrl = API_BASE ? `${API_BASE}${url}` : url;

  beginApiRequest();
  let succeeded = false;
  try {
    const res = await fetch(fullUrl, config);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error = new Error(errData.error || errData.message || `HTTP Error ${res.status}`);
      error.status = res.status;
      error.data = errData;
      const authEndpoint = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/logout',
        '/api/auth/password'
      ].some((path) => url.split('?')[0] === path);
      if (res.status === 401 && token && retryAuth && !authEndpoint && unauthorizedHandler) {
        if (await unauthorizedHandler(token)) {
          const result = await request(url, {
            ...options,
            retryAuth: false
          });
          succeeded = true;
          return result;
        }
      }
      throw error;
    }
    if (res.status === 204) {
      succeeded = true;
      return null;
    }
    const text = await res.text();
    if (!text) {
      succeeded = true;
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      succeeded = true;
      return text;
    }

    // 解密混淆
    const result = await responseInterceptor(parsed);
    succeeded = true;
    return result;
  } catch (err) {
    console.warn(`[API] 请求 ${url} 失败:`, err.message);
    throw err;
  } finally {
    endApiRequest(succeeded);
  }
}
