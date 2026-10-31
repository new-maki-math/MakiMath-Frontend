const DB_NAME = 'MakiMath_UpdateLog';
const STORE = 'read_versions';
let database;

function openDatabase() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore(STORE, {
          keyPath: 'version'
        });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('更新日志数据库被占用'));
    }).catch((error) => {
      database = null;
      throw error;
    });
  }
  return database;
}

export async function readUpdateVersions() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).getAllKeys();
    request.onsuccess = () => resolve(new Set(request.result));
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error || new Error('读取已读状态失败'));
  });
}

export async function markUpdateRead(version) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({
      version
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('保存已读状态失败'));
  });
}
