const DB_NAME = 'MakiMath_KnowledgeMastery';
const STORE_NAME = 'mastered';
let dbPromise;
const listeners = new Set();
let channel;
function masteryChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel('maki-knowledge-mastery');
      channel.onmessage = () => { for (const listener of listeners) listener(); };
    } catch { channel = null; }
  }
  return channel;
}
function notifyMasteryChanged() {
  for (const listener of listeners) listener();
  try { masteryChannel()?.postMessage('changed'); } catch {}
}
export function subscribeMasteryChanges(listener) {
  listeners.add(listener);
  masteryChannel();
  return () => listeners.delete(listener);
}

function openMasteryDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('本地掌握记录数据库被占用'));
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export async function getMasteredIds() {
  const db = await openMasteryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAllKeys();
    request.onsuccess = () => resolve(new Set(request.result.filter((id) => typeof id === 'string' && id.length > 0)));
    request.onerror = () => reject(request.error);
  });
}

export async function setMastered(id, mastered) {
  if (typeof id !== 'string' || !id) throw new Error('知识点标识无效');
  const db = await openMasteryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    if (mastered) store.put({ id });
    else store.delete(id);
    transaction.oncomplete = () => { notifyMasteryChanged(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('保存掌握状态失败'));
  });
}

export async function setMasteredBatch(changes) {
  const db = await openMasteryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    transaction.oncomplete = () => { notifyMasteryChanged(); resolve(); };
    transaction.onerror = () => reject(transaction.error || new Error('保存掌握状态失败'));
    transaction.onabort = () => reject(transaction.error || new Error('保存掌握状态失败'));
    try {
      for (const [id, mastered] of changes) {
        if (typeof id !== 'string' || !id) throw new Error('知识点标识无效');
        if (mastered) store.put({ id });
        else store.delete(id);
      }
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

export async function toggleMastered(id) {
  if (typeof id !== 'string' || !id) throw new Error('知识点标识无效');
  const db = await openMasteryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let mastered = false;
    const request = store.get(id);
    request.onsuccess = () => {
      mastered = !request.result;
      if (mastered) store.put({ id });
      else store.delete(id);
    };
    transaction.oncomplete = () => { notifyMasteryChanged(); resolve(mastered); };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('保存掌握状态失败'));
  });
}
