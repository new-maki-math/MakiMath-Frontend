import { withStorageWrite } from './storage-write-lock.js';

export const AI_CONVERSATIONS_DATABASE = 'MakiMath_AiConversations';
const STORE = 'conversations';
let database;

function openDatabase() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(AI_CONVERSATIONS_DATABASE, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, {
          keyPath: 'id'
        });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          database = null;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('对话数据库被其他页面占用'));
    }).catch((error) => {
      database = null;
      throw error;
    });
  }
  return database;
}

export async function listAiConversations() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error);
  });
}

export async function saveAiConversation(conversation) {
  const record = {
    id: conversation.id,
    title: conversation.title,
    titleIsPreset: conversation.titleIsPreset !== false,
    updatedAt: Date.now(),
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      images: message.images ? [...message.images] : [],
      favorite: Boolean(message.favorite),
      pending: Boolean(message.pending),
      failed: Boolean(message.failed),
      error: typeof message.error === 'string' ? message.error : ''
    }))
  };
  return withStorageWrite(async () => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('保存对话失败'));
    });
  });
}

export async function deleteAiConversation(id) {
  return withStorageWrite(async () => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('删除对话失败'));
    });
  });
}
