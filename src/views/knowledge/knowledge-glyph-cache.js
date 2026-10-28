const databaseName = 'maki-knowledge-glyphs';
const storeName = 'glyphs';
const cacheVersion = `${__KNOWLEDGE_GLYPH_CACHE_VERSION__}:64:8`;
let databasePromise;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); databasePromise = null; };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('字形缓存数据库被占用'));
    }).catch((error) => { databasePromise = null; throw error; });
  }
  return databasePromise;
}

export async function readGlyphCache(codepoints) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const results = new Map();
    for (const codepoint of codepoints) {
      const request = store.get(`${cacheVersion}:${codepoint}`);
      request.onsuccess = () => { if (request.result !== undefined) results.set(codepoint, request.result); };
    }
    transaction.oncomplete = () => resolve(results);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('读取字形缓存失败'));
  });
}

export async function writeGlyphCache(entries) {
  if (!entries.length) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    for (const [codepoint, glyph] of entries) store.put(glyph, `${cacheVersion}:${codepoint}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('写入字形缓存失败'));
  });
}
