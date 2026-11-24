import { watch } from 'vue';

import { canUseAi } from './ai-access.js';
import { currentUser } from './auth.js';

export const AI_CREDENTIALS_DATABASE = 'MakiMath_AiCredentials';
export const AI_PROVIDERS = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1'
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com'
  },
  other: {
    label: '其他',
    baseUrl: ''
  }
};

const sessions = new Map();
const warnings = new WeakMap();
let configuration = null;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {
  fatal: true
});
const iterations = 600000;
let database;

watch(
  [canUseAi, () => currentUser.value?.id],
  () => {
    sessions.clear();
    configuration = null;
  },
  {
    flush: 'sync'
  }
);

function requireAiAccess() {
  if (!canUseAi.value) {
    throw new Error('当前账号无权使用 AI 凭证');
  }
}

export function resolveAiBaseUrl(provider, value = '') {
  if (!Object.hasOwn(AI_PROVIDERS, provider)) {
    throw new Error('请选择服务商');
  }
  let url;
  try {
    url = new URL(provider === 'other' ? value.trim() : AI_PROVIDERS[provider].baseUrl);
  } catch {
    throw new Error('请输入有效的 HTTPS Base URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Base URL 必须使用 HTTPS，且不能包含凭据、查询参数或片段');
  }
  return url.href.replace(/\/+$/, '');
}

function identity(provider, baseUrl) {
  return `${provider}\n${resolveAiBaseUrl(provider, baseUrl)}`;
}

function ensurePersistenceAllowed(provider, baseUrl) {
  const host = new URL(resolveAiBaseUrl(provider, baseUrl)).hostname.toLowerCase();
  if (host === 'openrouter.ai' || host.endsWith('.openrouter.ai')) {
    throw new Error('OpenRouter 凭证仅支持本次会话');
  }
}

function openDatabase() {
  if (!globalThis.isSecureContext || !globalThis.crypto?.subtle || !globalThis.indexedDB) {
    throw new Error('加密保存需要安全的浏览器环境');
  }
  if (!database) {
    database = new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open(AI_CREDENTIALS_DATABASE, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('credentials', {
          keyPath: 'id'
        });
      request.onsuccess = () => {
        if (blocked) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => {
          request.result.close();
          database = null;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error('凭证数据库被其他标签页占用'));
      };
    }).catch((error) => {
      database = null;
      throw error;
    });
  }
  return database;
}

async function transact(mode, operation) {
  requireAiAccess();
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('credentials', mode);
    const request = operation(tx.objectStore('credentials'));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error || new Error('凭证操作已取消'));
    tx.onerror = () => reject(tx.error || new Error('凭证操作失败'));
  });
}

async function deriveKey(passphrase, salt, count) {
  if (typeof passphrase !== 'string' || !passphrase.length) {
    throw new Error('请输入独立口令');
  }
  const bytes = encoder.encode(passphrase);
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations: count
      },
      material,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
  } finally {
    bytes.fill(0);
  }
}

export function beginCredentialWarning(provider, baseUrl) {
  ensurePersistenceAllowed(provider, baseUrl);
  if (document.visibilityState !== 'visible') {
    throw new Error('请在当前页面阅读提示');
  }
  const token = Object.freeze({});
  const state = {
    id: identity(provider, baseUrl),
    since: performance.now(),
    listener: null
  };
  state.listener = () => {
    state.since = document.visibilityState === 'visible' ? performance.now() : null;
  };
  document.addEventListener('visibilitychange', state.listener);
  warnings.set(token, state);
  return token;
}

export function warningRemaining(token) {
  const state = warnings.get(token);
  return !state || state.since === null || document.visibilityState !== 'visible'
    ? 5000
    : Math.max(0, 5000 - (performance.now() - state.since));
}

export function cancelCredentialWarning(token) {
  const state = warnings.get(token);
  if (state) {
    document.removeEventListener('visibilitychange', state.listener);
    warnings.delete(token);
  }
}

export function setSessionCredential(provider, baseUrl, credential) {
  requireAiAccess();
  if (
    typeof credential !== 'string' ||
    !credential ||
    credential.length > 16384 ||
    /[\r\n]/.test(credential)
  ) {
    throw new Error('请输入有效的 API Key');
  }
  sessions.set(identity(provider, baseUrl), credential);
}

export function hasSessionCredential(provider, baseUrl) {
  try {
    return sessions.has(identity(provider, baseUrl));
  } catch {
    return false;
  }
}

export function useSessionCredential(provider, baseUrl, callback) {
  requireAiAccess();
  const credential = sessions.get(identity(provider, baseUrl));
  if (!credential) {
    throw new Error('请输入 API Key 或解锁已保存的凭证');
  }
  return callback(credential);
}

export function clearSessionCredential(provider, baseUrl) {
  sessions.delete(identity(provider, baseUrl));
}

export function setAiConfiguration(provider, baseUrl, models) {
  requireAiAccess();
  const normalized = resolveAiBaseUrl(provider, baseUrl);
  if (
    !Array.isArray(models) ||
    !models.length ||
    models.some(
      (item) =>
        typeof item.id !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,255}$/.test(item.id) ||
        typeof item.name !== 'string' ||
        item.name.length > 128
    )
  ) {
    throw new Error('请选择有效的模型');
  }
  configuration = {
    provider,
    baseUrl: normalized,
    models: models.map((item) => ({
      id: item.id,
      name: item.name.trim() || item.id
    }))
  };
}

export function getAiConfiguration() {
  return configuration
    ? {
        ...configuration,
        models: configuration.models.map((item) => ({
          ...item
        }))
      }
    : null;
}

export async function getSavedAiConfiguration() {
  const records = await transact('readonly', (store) => store.getAll());
  const record = records
    .filter((item) => typeof item.id === 'string' && item.id.includes('\n'))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  if (!record) {
    return null;
  }
  if (record.configuration && Array.isArray(record.configuration.models)) {
    return record.configuration;
  }
  const [provider, baseUrl] = record.id.split('\n');
  return {
    provider,
    baseUrl,
    models: []
  };
}

export async function updateSavedAiConfiguration(provider, baseUrl, models) {
  const id = identity(provider, baseUrl);
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('credentials', 'readwrite');
    const store = tx.objectStore('credentials');
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) {
        return;
      }
      store.put({
        ...request.result,
        configuration: {
          provider,
          baseUrl: resolveAiBaseUrl(provider, baseUrl),
          models: models.map((item) => ({
            id: item.id,
            name: item.name
          }))
        },
        updatedAt: Date.now()
      });
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('保存设置失败'));
    tx.onerror = () => reject(tx.error || new Error('保存设置失败'));
  });
}

export async function saveAiCredential({
  provider,
  baseUrl,
  credential,
  passphrase,
  warning,
  models
}) {
  ensurePersistenceAllowed(provider, baseUrl);
  const id = identity(provider, baseUrl);
  const consent = warnings.get(warning);
  if (!consent || consent.id !== id || warningRemaining(warning) > 0) {
    throw new Error('请先阅读风险提示');
  }
  cancelCredentialWarning(warning);
  if (
    typeof credential !== 'string' ||
    !credential ||
    credential.length > 16384 ||
    /[\r\n]/.test(credential)
  ) {
    throw new Error('请输入有效的 API Key');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = encoder.encode(credential);
  try {
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: encoder.encode(JSON.stringify([1, id])),
        tagLength: 128
      },
      key,
      plaintext
    );
    await transact('readwrite', (store) =>
      store.put({
        id,
        schemaVersion: 1,
        provider,
        configuration: {
          provider,
          baseUrl: resolveAiBaseUrl(provider, baseUrl),
          models: models.map((item) => ({
            id: item.id,
            name: item.name
          }))
        },
        updatedAt: Date.now(),
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations
        },
        salt,
        iv,
        ciphertext
      })
    );
  } finally {
    plaintext.fill(0);
  }
}

export async function hasSavedAiCredential(provider, baseUrl) {
  ensurePersistenceAllowed(provider, baseUrl);
  return (
    (await transact('readonly', (store) => store.getKey(identity(provider, baseUrl)))) !== undefined
  );
}

export async function unlockAiCredential(provider, baseUrl, passphrase) {
  ensurePersistenceAllowed(provider, baseUrl);
  const id = identity(provider, baseUrl);
  const record = await transact('readonly', (store) => store.get(id));
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record.id !== id ||
    record.provider !== provider ||
    record.kdf?.name !== 'PBKDF2' ||
    record.kdf?.hash !== 'SHA-256' ||
    !Number.isSafeInteger(record.kdf?.iterations) ||
    record.kdf.iterations < 1 ||
    record.kdf.iterations > 2000000 ||
    !(record.salt instanceof Uint8Array) ||
    record.salt.length !== 16 ||
    !(record.iv instanceof Uint8Array) ||
    record.iv.length !== 12 ||
    !(record.ciphertext instanceof ArrayBuffer) ||
    record.ciphertext.byteLength < 16 ||
    record.ciphertext.byteLength > 65552
  ) {
    throw new Error('凭证记录不存在或格式不受支持');
  }
  const key = await deriveKey(passphrase, record.salt, record.kdf.iterations);
  let plaintext;
  try {
    plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: record.iv,
          additionalData: encoder.encode(JSON.stringify([1, id])),
          tagLength: 128
        },
        key,
        record.ciphertext
      )
    );
    setSessionCredential(provider, baseUrl, decoder.decode(plaintext));
  } catch {
    throw new Error('口令错误或凭证数据已损坏');
  } finally {
    plaintext?.fill(0);
  }
}

export async function deleteAiCredential(provider, baseUrl) {
  await transact('readwrite', (store) => store.delete(identity(provider, baseUrl)));
  clearSessionCredential(provider, baseUrl);
}
