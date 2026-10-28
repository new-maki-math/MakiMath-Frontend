// 我的书架 IndexedDB 本地持久化存储与合并引擎
// 严格遵循原生 IndexedDB 规范，体积为 0KB 外部依赖

const DB_NAME = 'MakiMath_UserData';
const DB_VERSION = 1;
const STORE_NOTEBOOKS = 'notebooks';
const STORE_ITEMS = 'notebook_items';

export const DEFAULT_NOTEBOOK_ID = 'default';

let dbInstance = null;

/**
 * 打开或初始化 IndexedDB
 */
export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. 讲义笔记本集合表
      if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
        const nbStore = db.createObjectStore(STORE_NOTEBOOKS, { keyPath: 'id' });
        nbStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 2. 讲义切片条目表
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        itemStore.createIndex('notebookId', 'notebookId', { unique: false });
        itemStore.createIndex('targetRef', ['notebookId', 'targetRef'], { unique: false });
        itemStore.createIndex('sectionRef', ['notebookId', 'courseId', 'sectionId'], { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      // 确保默认讲义册存在
      ensureDefaultNotebook(dbInstance)
        .then(() => resolve(dbInstance))
        .catch(() => resolve(dbInstance));
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] 打开数据库失败:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * 保证默认笔记本存在
 */
function ensureDefaultNotebook(db) {
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NOTEBOOKS], 'readwrite');
    const store = tx.objectStore(STORE_NOTEBOOKS);
    const getReq = store.get(DEFAULT_NOTEBOOK_ID);

    getReq.onsuccess = () => {
      if (!getReq.result) {
        store.put({
          id: DEFAULT_NOTEBOOK_ID,
          title: '我的默认讲义',
          description: '系统默认自定义知识考点与真题合集',
          coverTag: 'DEFAULT // 核心装订册',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      resolve();
    };

    getReq.onerror = () => resolve();
  });
}

/**
 * 获取所有笔记本
 */
export async function getNotebooks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NOTEBOOKS], 'readonly');
    const store = tx.objectStore(STORE_NOTEBOOKS);
    const req = store.getAll();

    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => {
        if (a.id === DEFAULT_NOTEBOOK_ID) return -1;
        if (b.id === DEFAULT_NOTEBOOK_ID) return 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 创建新讲义笔记本
 */
export async function createNotebook(title, description = '') {
  const db = await openDB();
  const id = 'nb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const now = Date.now();
  const item = {
    id,
    title: title.trim() || '新建讲义册',
    description: description.trim(),
    coverTag: 'CUSTOM // 自定义专题',
    createdAt: now,
    updatedAt: now
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NOTEBOOKS], 'readwrite');
    const store = tx.objectStore(STORE_NOTEBOOKS);
    const req = store.add(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取某个笔记本内的全部条目
 */
export async function getNotebookItems(notebookId = DEFAULT_NOTEBOOK_ID) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ITEMS], 'readonly');
    const store = tx.objectStore(STORE_ITEMS);
    const idx = store.index('notebookId');
    const req = idx.getAll(notebookId);

    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.addedAt - b.addedAt);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 检查当前节点在讲义中的收录状态
 * 返回: { collected: boolean, isAbsorbedByParent: boolean, parentTitle?: string, itemId?: string }
 */
export async function checkItemCollectionStatus({
  notebookId = DEFAULT_NOTEBOOK_ID,
  courseId,
  sectionId,
  scope,
  scopeId,
  outlineAnchor
}) {
  const items = await getNotebookItems(notebookId);
  const cId = String(courseId || '');
  const sId = String(sectionId || '');

  // 1. 是否整节已被收录
  const sectionItem = items.find(
    (it) => it.courseId === cId && it.sectionId === sId && it.scope === 'section'
  );
  if (sectionItem) {
    if (scope === 'section') {
      return { collected: true, isAbsorbedByParent: false, itemId: sectionItem.id };
    }
    // 当前项为大纲考点或卡片，但其父小节已被收录
    return {
      collected: true,
      isAbsorbedByParent: true,
      parentScope: 'section',
      parentTitle: sectionItem.title,
      itemId: sectionItem.id
    };
  }

  // 2. 如果当前项是卡片，检查其所属的大纲考点是否已被收录
  if (scope === 'card' && outlineAnchor) {
    const outlineItem = items.find(
      (it) =>
        it.courseId === cId &&
        it.sectionId === sId &&
        it.scope === 'outline' &&
        it.scopeId === outlineAnchor
    );
    if (outlineItem) {
      return {
        collected: true,
        isAbsorbedByParent: true,
        parentScope: 'outline',
        parentTitle: outlineItem.title,
        itemId: outlineItem.id
      };
    }
  }

  // 3. 检查当前节点自身是否已精确收录
  const exactItem = items.find(
    (it) =>
      it.courseId === cId &&
      it.sectionId === sId &&
      it.scope === scope &&
      it.scopeId === String(scopeId)
  );

  if (exactItem) {
    return { collected: true, isAbsorbedByParent: false, itemId: exactItem.id };
  }

  return { collected: false, isAbsorbedByParent: false };
}

/**
 * 添加或智能合并升级讲义条目
 * 
 * 核心升级与吸收逻辑：
 * 1. 若添加 scope === 'section'（整小节）：
 *    - 自动查找该小节下已存在的所有 outline 与 card 碎片，批量移除（被整小节吸收）。
 * 2. 若添加 scope === 'outline'（大纲考点）：
 *    - 若整小节已存在，则拒绝重复添加；
 *    - 自动查找归属于该 outline 的所有独立 card 卡片，批量移除（被考点节吸收）。
 * 3. 若添加 scope === 'card'（卡片）：
 *    - 若整小节或其所属 outline 已存在，则无需重复添加。
 */
export async function addOrUpgradeNotebookItem({
  notebookId = DEFAULT_NOTEBOOK_ID,
  courseId,
  courseTitle = '',
  sectionId,
  sectionTitle = '',
  scope, // 'section' | 'outline' | 'card'
  scopeId, // 'all' | 'doc-h1' | 'zt_xxx'
  title,
  badge = '',
  outlineAnchor = '',
  subordinateCardIds = [], // 若添加 outline，可传入属于该 outline 的卡片 ID 列表
  breadcrumb = []
}) {
  const db = await openDB();
  const cId = String(courseId || '');
  const sId = String(sectionId || '');
  const scId = String(scopeId || 'all');
  const targetRef = `${cId}:${sId}:${scope}:${scId}`;

  // 1. 获取当前小节在该笔记本的所有已收录项
  const allCurrentItems = await getNotebookItems(notebookId);
  const sectionItems = allCurrentItems.filter((it) => it.courseId === cId && it.sectionId === sId);

  // 2. 检查由大到小的包含关系
  if (scope === 'card') {
    // 检查整节是否已收录
    const hasSection = sectionItems.find((it) => it.scope === 'section');
    if (hasSection) {
      return {
        success: false,
        action: 'already_covered',
        message: `该卡片已在已收录的小节《${hasSection.title}》中包含，无需重复添加`
      };
    }
    // 检查父大纲节是否已收录
    if (outlineAnchor) {
      const hasOutline = sectionItems.find(
        (it) => it.scope === 'outline' && it.scopeId === outlineAnchor
      );
      if (hasOutline) {
        return {
          success: false,
          action: 'already_covered',
          message: `该卡片已在已收录的考点节《${hasOutline.title}》中包含，无需重复添加`
        };
      }
    }
    // 检查卡片自身是否已收录
    const existing = sectionItems.find((it) => it.scope === 'card' && it.scopeId === scId);
    if (existing) {
      return {
        success: false,
        action: 'duplicate',
        message: '该卡片已在讲义中'
      };
    }
  }

  if (scope === 'outline') {
    // 检查整节是否已收录
    const hasSection = sectionItems.find((it) => it.scope === 'section');
    if (hasSection) {
      return {
        success: false,
        action: 'already_covered',
        message: `该考点已在已收录的小节《${hasSection.title}》中包含，无需重复添加`
      };
    }
    // 检查大纲考点自身是否已收录
    const existing = sectionItems.find((it) => it.scope === 'outline' && it.scopeId === scId);
    if (existing) {
      return {
        success: false,
        action: 'duplicate',
        message: '该考点大纲节已在讲义中'
      };
    }
  }

  if (scope === 'section') {
    const existing = sectionItems.find((it) => it.scope === 'section');
    if (existing) {
      return {
        success: false,
        action: 'duplicate',
        message: '该小节已在讲义中'
      };
    }
  }

  // 3. 执行吸收合并（由小到大）：计算待清理的从属细粒度碎片 ID
  const idsToDelete = [];
  let absorbedCount = 0;

  if (scope === 'section') {
    // 整小节吸收该小节下的全部 outline 与 card
    sectionItems.forEach((it) => {
      if (it.scope === 'outline' || it.scope === 'card') {
        idsToDelete.push(it.id);
        absorbedCount++;
      }
    });
  } else if (scope === 'outline') {
    // 大纲节吸收其下属的所有 card
    sectionItems.forEach((it) => {
      if (it.scope === 'card') {
        const belongsToThisOutline =
          it.outlineAnchor === scId ||
          (subordinateCardIds && subordinateCardIds.includes(it.scopeId));
        if (belongsToThisOutline) {
          idsToDelete.push(it.id);
          absorbedCount++;
        }
      }
    });
  }

  // 4. 构建新增条目
  const maxOrder = allCurrentItems.reduce((max, it) => Math.max(max, it.order ?? 0), 0);
  const newItem = {
    id: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    notebookId,
    courseId: cId,
    courseTitle: courseTitle || '未命名课程',
    sectionId: sId,
    sectionTitle: sectionTitle || '未命名小节',
    scope,
    scopeId: scId,
    targetRef,
    title: (title || sectionTitle || '未命名节点').trim(),
    badge: badge || (scope === 'section' ? '整节' : scope === 'outline' ? '考点' : '卡片'),
    outlineAnchor: outlineAnchor || '',
    breadcrumb: Array.isArray(breadcrumb) ? breadcrumb : [],
    order: maxOrder + 1,
    addedAt: Date.now()
  };

  // 5. 在单一事务中执行：删除被吸收项 + 写入新项
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ITEMS, STORE_NOTEBOOKS], 'readwrite');
    const itemStore = tx.objectStore(STORE_ITEMS);
    const nbStore = tx.objectStore(STORE_NOTEBOOKS);

    idsToDelete.forEach((id) => itemStore.delete(id));
    itemStore.add(newItem);

    // 更新笔记本最后修改时间
    const nbReq = nbStore.get(notebookId);
    nbReq.onsuccess = () => {
      if (nbReq.result) {
        nbReq.result.updatedAt = Date.now();
        nbStore.put(nbReq.result);
      }
    };

    tx.oncomplete = () => {
      let message = `已收入《我的书架》`;
      if (absorbedCount > 0) {
        message = `已收录${scope === 'section' ? '整小节' : '考点'}《${newItem.title}》，并自动合并 ${absorbedCount} 个已收录碎片`;
      }
      resolve({
        success: true,
        action: absorbedCount > 0 ? 'absorbed' : 'added',
        item: newItem,
        absorbedCount,
        message
      });
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 移除讲义中的单个条目
 */
export async function removeNotebookItem(itemId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ITEMS], 'readwrite');
    const store = tx.objectStore(STORE_ITEMS);
    const req = store.delete(itemId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 清空指定讲义笔记本
 */
export async function clearNotebook(notebookId = DEFAULT_NOTEBOOK_ID) {
  const db = await openDB();
  const items = await getNotebookItems(notebookId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ITEMS], 'readwrite');
    const store = tx.objectStore(STORE_ITEMS);
    items.forEach((it) => store.delete(it.id));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 重新排序讲义条目
 */
export async function reorderNotebookItems(notebookId, orderedItemIds) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ITEMS], 'readwrite');
    const store = tx.objectStore(STORE_ITEMS);

    orderedItemIds.forEach((id, index) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (getReq.result && getReq.result.notebookId === notebookId) {
          getReq.result.order = index + 1;
          store.put(getReq.result);
        } else {
          tx.abort();
        }
      };
    });

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('调整顺序失败'));
  });
}
