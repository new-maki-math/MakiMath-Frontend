import { getAuthToken } from '../utils/auth-storage.js';
import { beginApiRequest, endApiRequest } from '../utils/progress.js';
import {
  decryptPayload,
  getClientPublicKey,
  isEncryptedPayload
} from '../vendor/secure-core.min.js';
import { handleUnauthorized, request } from './client.js';

const API_BASE = import.meta.env?.VITE_API_BASE ?? '';
const resourceUrl = (id) => `/api/resources/${encodeURIComponent(id)}`;

async function transfer(
  path,
  { method = 'GET', body, headers = {}, signal, retryAuth = true } = {}
) {
  const token = getAuthToken();
  if (!token && method !== 'GET' && method !== 'HEAD') {
    const error = new Error('请先登录');
    error.status = 401;
    throw error;
  }
  const publicKey = await getClientPublicKey();
  if (!publicKey) {
    throw new Error('无法建立安全通信');
  }
  const requestHeaders = {
    ...headers,
    'x-cp': publicKey
  };
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }
  if (method !== 'GET' && method !== 'HEAD') {
    requestHeaders['x-mm'] = '1';
  }
  beginApiRequest();
  let succeeded = false;
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: requestHeaders,
      body,
      signal,
      credentials: 'omit',
      cache: 'no-store'
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && retryAuth && (method === 'GET' || method === 'HEAD')) {
        if (await handleUnauthorized(token)) {
          succeeded = true;
          return transfer(path, {
            method,
            body,
            headers,
            signal,
            retryAuth: false
          });
        }
      } else if (response.status === 401 && retryAuth) {
        await handleUnauthorized(token);
      }
      const error = new Error(data.error || data.message || `HTTP Error ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    if (body instanceof FormData) {
      const data = await response.json();
      const result = isEncryptedPayload(data) ? await decryptPayload(data) : data;
      succeeded = true;
      return result;
    }
    succeeded = true;
    return response;
  } finally {
    endApiRequest(succeeded);
  }
}

async function uploadWithProgress(form, { signal, onProgress } = {}) {
  const token = getAuthToken();
  if (!token) {
    const error = new Error('请先登录');
    error.status = 401;
    throw error;
  }
  const publicKey = await getClientPublicKey();
  if (!publicKey) {
    throw new Error('无法建立安全通信');
  }
  if (signal?.aborted) {
    throw new DOMException('上传已取消', 'AbortError');
  }
  beginApiRequest();
  let succeeded = false;
  try {
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const cleanup = () => signal?.removeEventListener('abort', abort);
      xhr.open('POST', `${API_BASE}/api/resources/files`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('x-cp', publicKey);
      xhr.setRequestHeader('x-mm', '1');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress?.(event.loaded / event.total);
        }
      };
      xhr.onload = async () => {
        cleanup();
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status < 200 || xhr.status >= 300) {
            if (xhr.status === 401) {
              await handleUnauthorized(token);
            }
            const error = new Error(data.error || data.message || `HTTP Error ${xhr.status}`);
            error.status = xhr.status;
            error.data = data;
            reject(error);
            return;
          }
          resolve(isEncryptedPayload(data) ? await decryptPayload(data) : data);
        } catch (failure) {
          reject(failure);
        }
      };
      xhr.onerror = () => {
        cleanup();
        reject(new Error('网络中断，上传结果未确认，请刷新列表后检查'));
      };
      xhr.onabort = () => {
        cleanup();
        reject(new DOMException('上传已取消，结果可能已保存，请刷新列表后检查', 'AbortError'));
      };
      signal?.addEventListener('abort', abort, {
        once: true
      });
      xhr.send(form);
    });
    succeeded = true;
    return result;
  } finally {
    endApiRequest(succeeded);
  }
}

export const resourceApi = {
  list: (params, options = {}) =>
    request(`/api/resources?${new URLSearchParams(params)}`, {
      ...options,
      cache: 'no-store'
    }),
  detail: (id, options = {}) =>
    request(resourceUrl(id), {
      ...options,
      cache: 'no-store'
    }),
  quota: (options = {}) =>
    request('/api/resources/download-quota', {
      ...options,
      cache: 'no-store'
    }),
  downloadTicket: (id, options = {}) =>
    request(`${resourceUrl(id)}/download-ticket`, {
      ...options,
      method: 'POST'
    }),
  downloadUrl: (id, ticket) =>
    `${API_BASE}${resourceUrl(id)}/download?${new URLSearchParams({
      ticket
    })}`,
  createFolder: (body) =>
    request('/api/resources/folders', {
      method: 'POST',
      body
    }),
  edit: (id, body) =>
    request(resourceUrl(id), {
      method: 'PATCH',
      body
    }),
  move: (id, body) =>
    request(`${resourceUrl(id)}/move`, {
      method: 'POST',
      body
    }),
  copy: (id, body) =>
    request(`${resourceUrl(id)}/copy`, {
      method: 'POST',
      body
    }),
  remove: (id) =>
    request(resourceUrl(id), {
      method: 'DELETE'
    }),
  uploadWithProgress,
  replace: (id, form, options = {}) =>
    transfer(`${resourceUrl(id)}/content`, {
      ...options,
      method: 'PUT',
      body: form
    }),
  content: (id, params, options = {}) =>
    transfer(`${resourceUrl(id)}/content?${new URLSearchParams(params)}`, options)
};
