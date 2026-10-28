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

export function validateLocalLectureSlug(slug) {
  if (typeof slug !== 'string' || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('讲义标识须使用小写字母、数字和连字符，长度不超过 100');
  }
}

export async function findLocalLectureBySlug(slug) {
  validateLocalLectureSlug(slug);
  const matches = (await listLocalLectures()).filter((item) => item.slug === slug);
  if (matches.length > 1) throw new Error('本地讲义标识重复，请先在讲义工作台处理冲突');
  if (!matches.length) { const error = new Error('本地讲义不存在'); error.status = 404; throw error; }
  return matches[0];
}

export async function createLocalLecture(record) {
  validateLocalLectureSlug(record.slug);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.getAll();
    let issue = '';
    request.onsuccess = () => {
      if (request.result.some((item) => item.slug === record.slug)) {
        issue = '本地讲义标识已存在，请修改标识后重试';
        tx.abort();
        return;
      }
      try {
        store.add(record);
      } catch (error) {
        issue = error?.name === 'DataCloneError' ? '讲义数据无法写入本地，请检查文件内容' : error?.message || '创建本地讲义失败';
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(record);
    tx.onabort = () => reject(new Error(issue || tx.error?.message || '创建本地讲义失败'));
  });
}

export async function saveLocalLecture(record, expectedVersion) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.getAll();
    let issue = '';
    request.onsuccess = () => {
      const current = request.result.find((item) => item.id === record.id);
      if (!current || current.editVersion !== expectedVersion) {
        issue = '本地讲义已在其他页面修改或删除，请先备份当前内容';
        tx.abort();
        return;
      }
      if (current.slug !== record.slug) {
        try { validateLocalLectureSlug(record.slug); }
        catch (error) { issue = error.message; tx.abort(); return; }
        if (request.result.some((item) => item.id !== record.id && item.slug === record.slug)) {
          issue = '本地讲义标识已存在，请修改标识后重试';
          tx.abort();
          return;
        }
      }
      store.put({ ...record, editVersion: expectedVersion + 1 });
    };
    tx.oncomplete = () => resolve(expectedVersion + 1);
    tx.onabort = () => reject(new Error(issue || tx.error?.message || '保存本地讲义失败'));
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

export async function updateLocalLectureCover(id, cover) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.get(id);
    let missing = false;
    request.onsuccess = () => {
      if (!request.result) { missing = true; tx.abort(); return; }
      store.put({ ...request.result, cover, editVersion: request.result.editVersion + 1 });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error(missing ? '本地讲义不存在' : '保存封面失败'));
  });
}
