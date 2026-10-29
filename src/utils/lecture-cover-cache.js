// 讲义封面按内容哈希缓存
const covers = new Map();
const requests = new Map();
const versions = new Map();
const limit = 48;
const hashPattern = /^[a-f0-9]{64}$/;
let generation = 0;
let databasePromise;

function cacheScope() {
  try {
    const token = localStorage.getItem('maki_auth_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('maki_auth_user') || 'null');
    return token && user?.id != null ? `user:${user.id}` : 'anonymous';
  } catch {
    return 'anonymous';
  }
}

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('maki-lecture-covers', 2);
      request.onupgradeneeded = () => {
        if (request.result.objectStoreNames.contains('covers')) request.result.deleteObjectStore('covers');
        request.result.createObjectStore('covers');
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); databasePromise = null; };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('封面缓存数据库被占用'));
    }).catch((error) => { databasePromise = null; throw error; });
  }
  return databasePromise;
}

async function readCover(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('covers', 'readonly').objectStore('covers').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeCover(key, cover) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('covers', 'readwrite');
    transaction.objectStore('covers').put(cover, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function clearLectureCoverCache() {
  generation++;
  covers.clear();
  requests.clear();
  versions.clear();
}

export function invalidateLectureCover(id) {
  const key = String(id);
  versions.set(key, (versions.get(key) || 0) + 1);
  for (const entry of requests.keys()) if (entry.startsWith(`${cacheScope()}:${key}:`)) requests.delete(entry);
}

export function getCachedLectureCover(id, hash, load) {
  const revisionId = String(id);
  const scope = cacheScope();
  const cacheKey = typeof hash === 'string' && hashPattern.test(hash) ? `${scope}:${hash}` : '';
  const requestKey = `${scope}:${revisionId}:${hash || ''}`;
  const cached = cacheKey && covers.get(cacheKey);
  if (cached) return Promise.resolve({ revision_id: id, cover: cached, cover_hash: hash });
  if (requests.has(requestKey)) return requests.get(requestKey);

  const current = generation;
  const version = versions.get(revisionId) || 0;
  const valid = () => current === generation && version === (versions.get(revisionId) || 0) && scope === cacheScope();
  const pending = Promise.resolve().then(async () => {
    if (cacheKey) {
      const stored = await readCover(cacheKey).catch(() => null);
      if (!valid()) throw new Error('封面状态已变化，请重新读取');
      if (typeof stored === 'string') return { revision_id: id, cover: stored, cover_hash: hash };
    }
    const result = await load();
    if (!valid()) throw new Error('封面状态已变化，请重新读取');
    if (String(result?.revision_id) !== revisionId || typeof result.cover !== 'string') throw new Error('封面数据不完整');
    if (typeof result.cover_hash === 'string' && hashPattern.test(result.cover_hash)) {
      const resultKey = `${scope}:${result.cover_hash}`;
      await writeCover(resultKey, result.cover).catch(() => {});
      if (!valid()) throw new Error('封面状态已变化，请重新读取');
      covers.set(resultKey, result.cover);
      if (covers.size > limit) covers.delete(covers.keys().next().value);
    }
    return result;
  }).finally(() => {
    if (requests.get(requestKey) === pending) requests.delete(requestKey);
  });
  requests.set(requestKey, pending);
  return pending;
}
