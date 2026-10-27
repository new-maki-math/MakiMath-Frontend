const DB_NAME = 'MakiMath_KnowledgeMastery';
const STORE_NAME = 'mastered';
let dbPromise;

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
    request.onsuccess = () => resolve(new Set(request.result));
    request.onerror = () => reject(request.error);
  });
}

export async function setMastered(id, mastered) {
  const db = await openMasteryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    if (mastered) store.put({ id });
    else store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('保存掌握状态失败'));
  });
}

export async function setMasteredBatch(changes) {
  const db = await openMasteryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('保存掌握状态失败'));
    transaction.onabort = () => reject(transaction.error || new Error('保存掌握状态失败'));
    try {
      for (const [id, mastered] of changes) {
        if (mastered) store.put({ id });
        else store.delete(id);
      }
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}
