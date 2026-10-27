const DB_NAME = 'MakiMath_LocalLectures';
const STORE = 'lectures';
let database;

function openDatabase() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('本地讲义数据库被占用'));
    }).catch((error) => { database = null; throw error; });
  }
  return database;
}

export async function listLocalLectures() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function createLocalLecture(record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('创建本地讲义失败'));
  });
}

export async function saveLocalLecture(record, expectedVersion) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.get(record.id);
    let conflict = false;
    request.onsuccess = () => {
      if (!request.result || request.result.editVersion !== expectedVersion) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put({ ...record, editVersion: expectedVersion + 1 });
    };
    tx.oncomplete = () => resolve(expectedVersion + 1);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error(conflict ? '本地讲义已在其他页面修改或删除，请先备份当前内容' : '保存本地讲义失败'));
  });
}

export async function deleteLocalLecture(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('删除本地讲义失败'));
  });
}
