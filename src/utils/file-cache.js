import { getAuthToken } from './auth-storage.js';

// 可丢弃的缓存不进入用户数据备份。
export const FILE_CACHE_DATABASE = 'MakiMath_FileCache';
export const FILE_CACHE_LIMIT = 128 * 1024 * 1024;
const ENTRY_STORE = 'entries';
const META_STORE = 'meta';
let databasePromise;
let legacyCleanupStarted = false;
let contextGeneration = 0;
let unidentifiedToken = '';
let unidentifiedScope = '';

export function invalidateFileCacheContext() {
  contextGeneration++;
}

export function getFileCacheContextGeneration() {
  return contextGeneration;
}

export function fileCacheScope() {
  try {
    const token = getAuthToken();
    const user = JSON.parse(localStorage.getItem('maki_auth_user') || 'null');
    const backend = import.meta.env.VITE_API_BASE || window.location.origin;
    if (!token) {
      return `${backend}:anonymous`;
    }
    if (user?.id != null) {
      return `${backend}:user:${user.id}`;
    }
    if (unidentifiedToken !== token) {
      unidentifiedToken = token;
      unidentifiedScope = crypto.randomUUID();
    }
    return `${backend}:session:${unidentifiedScope}`;
  } catch {
    return 'anonymous';
  }
}

function openDatabase() {
  if (!legacyCleanupStarted && typeof indexedDB !== 'undefined') {
    legacyCleanupStarted = true;
    // 旧封面缓存已被统一缓存替代；删除不影响任何用户数据。
    try {
      indexedDB.deleteDatabase('maki-lecture-covers');
    } catch {
      // 缓存清理失败不影响使用
    }
  }
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(FILE_CACHE_DATABASE, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(ENTRY_STORE, {
          keyPath: 'key'
        });
        store.createIndex('lastUsed', 'lastUsed');
        request.result.createObjectStore(META_STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          databasePromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('缓存数据库被占用'));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function hashCacheValue(value) {
  let bytes;
  if (value instanceof Blob) {
    bytes = await value.arrayBuffer();
  } else {
    bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sizeOf(value) {
  if (value instanceof Blob) {
    return value.size;
  }
  return new Blob([typeof value === 'string' ? value : JSON.stringify(value)]).size;
}

export async function getCachedFile(key, { maxAge } = {}) {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(ENTRY_STORE, 'readwrite');
      const store = transaction.objectStore(ENTRY_STORE);
      let entry = null;
      const request = store.get(key);
      request.onsuccess = () => {
        entry = request.result || null;
        if (entry && maxAge != null && (!entry.cachedAt || Date.now() - entry.cachedAt > maxAge)) {
          entry = null;
        }
        if (entry) {
          entry.lastUsed = Date.now();
          store.put(entry);
        }
      };
      transaction.oncomplete = () => {
        if (entry) {
          console.info(`缓存命中：${entry.name} ${entry.hash}`);
        }
        resolve(entry);
      };
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    return null;
  }
}

export async function getCachedFiles(keys, { maxAge } = {}) {
  if (!keys.length) {
    return new Map();
  }
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(ENTRY_STORE, 'readwrite');
      const store = transaction.objectStore(ENTRY_STORE);
      const result = new Map();
      for (const key of keys) {
        const request = store.get(key);
        request.onsuccess = () => {
          const entry = request.result;
          if (
            !entry ||
            (maxAge != null && (!entry.cachedAt || Date.now() - entry.cachedAt > maxAge))
          ) {
            return;
          }
          entry.lastUsed = Date.now();
          store.put(entry);
          result.set(key, entry);
        };
      }
      transaction.oncomplete = () => {
        for (const entry of result.values()) {
          console.info(`缓存命中：${entry.name} ${entry.hash}`);
        }
        resolve(result);
      };
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    return new Map();
  }
}

export async function putCachedFile({ key, name, hash, value }) {
  try {
    if (!key || !name || !/^[a-f0-9]{64}$/.test(hash)) {
      return;
    }
    const size = sizeOf(value);
    if (size > FILE_CACHE_LIMIT) {
      return;
    }
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([ENTRY_STORE, META_STORE], 'readwrite');
      const store = transaction.objectStore(ENTRY_STORE);
      const meta = transaction.objectStore(META_STORE);
      const oldRequest = store.get(key);
      const totalRequest = meta.get('totalBytes');
      let oldReady = false;
      let totalReady = false;
      function update() {
        if (!oldReady || !totalReady) {
          return;
        }
        let total =
          Math.max(0, Number(totalRequest.result) || 0) - (oldRequest.result?.size || 0) + size;
        store.put({
          key,
          name,
          hash,
          value,
          size,
          lastUsed: Date.now(),
          cachedAt: Date.now()
        });
        if (total <= FILE_CACHE_LIMIT) {
          meta.put(total, 'totalBytes');
          return;
        }
        const cursorRequest = store.index('lastUsed').openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor || total <= FILE_CACHE_LIMIT) {
            meta.put(Math.max(0, total), 'totalBytes');
            return;
          }
          if (cursor.primaryKey !== key) {
            total -= cursor.value.size || 0;
            cursor.delete();
          }
          cursor.continue();
        };
      }
      oldRequest.onsuccess = () => {
        oldReady = true;
        update();
      };
      totalRequest.onsuccess = () => {
        totalReady = true;
        update();
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // 浏览器禁止存储或空间不足时直接使用网络结果。
  }
}
