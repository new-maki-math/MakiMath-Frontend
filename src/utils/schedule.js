import { withStorageWrite } from './storage-write-lock.js';

let database;

function openDatabase() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('MakiMath_Schedule', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('events', { keyPath: 'id' });
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          database = null;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('日程数据库被占用'));
    }).catch((error) => {
      database = null;
      throw error;
    });
  }
  return database;
}

export async function listSchedule() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('events', 'readonly').objectStore('events').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function saveSchedule(event) {
  return withStorageWrite(async () => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').put(event);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('保存日程失败'));
      tx.onerror = () => reject(tx.error);
    });
  });
}

export function deleteSchedule(id) {
  return withStorageWrite(async () => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').delete(id);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('删除日程失败'));
      tx.onerror = () => reject(tx.error);
    });
  });
}
