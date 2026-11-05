import { withStorageWrite } from './storage-write-lock.js';

const DB_NAME = 'MakiMath_KnowledgeMastery';
const STORE_NAME = 'mastered';
let dbPromise;
const listeners = new Set();
let channel;
function masteryChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel('maki-knowledge-mastery');
      channel.onmessage = () => {
        for (const listener of listeners) {
          listener();
        }
      };
    } catch {
      channel = null;
    }
  }
  return channel;
}
function notifyMasteryChanged() {
  for (const listener of listeners) {
    listener();
  }
  try {
    masteryChannel()?.postMessage('changed');
  } catch {
    // 跨页通知失败不影响当前页面更新
  }
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
      request.onupgradeneeded = () =>
        request.result.createObjectStore(STORE_NAME, {
          keyPath: 'id'
        });
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          dbPromise = null;
        };
        resolve(request.result);
      };
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
    request.onsuccess = () =>
      resolve(new Set(request.result.filter((id) => typeof id === 'string' && id.length > 0)));
    request.onerror = () => reject(request.error);
  });
}

async function setMasteredUnlocked(id, mastered) {
  if (typeof id !== 'string' || !id) {
    throw new Error('知识点标识无效');
  }
  const db = await openMasteryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    if (mastered) {
      store.put({
        id
      });
    } else {
      store.delete(id);
    }
    transaction.oncomplete = () => {
      notifyMasteryChanged();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('保存掌握状态失败'));
  });
}

async function setMasteredBatchUnlocked(changes) {
  const db = await openMasteryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    transaction.oncomplete = () => {
      notifyMasteryChanged();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error || new Error('保存掌握状态失败'));
    transaction.onabort = () => reject(transaction.error || new Error('保存掌握状态失败'));
    try {
      for (const [id, mastered] of changes) {
        if (typeof id !== 'string' || !id) {
          throw new Error('知识点标识无效');
        }
        if (mastered) {
          store.put({
            id
          });
        } else {
          store.delete(id);
        }
      }
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

async function toggleMasteredUnlocked(id) {
  if (typeof id !== 'string' || !id) {
    throw new Error('知识点标识无效');
  }
  const db = await openMasteryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let mastered = false;
    const request = store.get(id);
    request.onsuccess = () => {
      mastered = !request.result;
      if (mastered) {
        store.put({
          id
        });
      } else {
        store.delete(id);
      }
    };
    transaction.oncomplete = () => {
      notifyMasteryChanged();
      resolve(mastered);
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('保存掌握状态失败'));
  });
}

export function setMastered(id, mastered) {
  return withStorageWrite(() => setMasteredUnlocked(id, mastered));
}

export function setMasteredBatch(changes) {
  return withStorageWrite(() => setMasteredBatchUnlocked(changes));
}

export function toggleMastered(id) {
  return withStorageWrite(() => toggleMasteredUnlocked(id));
}
