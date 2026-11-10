const FORMAT = 'maki-math-indexeddb-backup';
const FORMAT_VERSION = 1;
const LOCK_NAME = 'maki-user-data';
const RECOVERY_FILE = 'maki-math-recovery.json';
const DISPOSABLE_DATABASES = new Set(['MakiMath_FileCache', 'maki-lecture-covers']);
const SCHEMAS = {
  MakiMath_LocalLectures: {
    version: 1,
    stores: {
      lectures: {
        keyPath: 'id',
        indexes: []
      }
    }
  },
  MakiMath_KnowledgeMastery: {
    version: 1,
    stores: {
      mastered: {
        keyPath: 'id',
        indexes: []
      }
    }
  },
  MakiMath_UpdateLog: {
    version: 1,
    stores: {
      read_versions: {
        keyPath: 'version',
        indexes: []
      }
    }
  },
  'maki-lecture-covers': {
    version: 2,
    stores: {
      covers: {
        keyPath: null,
        indexes: []
      }
    }
  },
  'maki-knowledge-glyphs': {
    version: 1,
    legacy: true,
    stores: {
      glyphs: {
        keyPath: null,
        indexes: []
      }
    }
  },
  MakiMath_UserData: {
    version: 1,
    legacy: true,
    stores: {
      notebooks: {
        keyPath: 'id',
        indexes: [
          {
            name: 'updatedAt',
            keyPath: 'updatedAt'
          }
        ]
      },
      notebook_items: {
        keyPath: 'id',
        indexes: [
          {
            name: 'notebookId',
            keyPath: 'notebookId'
          },
          {
            name: 'targetRef',
            keyPath: ['notebookId', 'targetRef']
          },
          {
            name: 'sectionRef',
            keyPath: ['notebookId', 'courseId', 'sectionId']
          }
        ]
      }
    }
  }
};
const typedArrays = {
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
  DataView
};

function encodeBytes(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  return btoa(binary);
}

function decodeBytes(value) {
  if (
    typeof value !== 'string' ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error('备份中的二进制数据无效');
  }
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encode(value, parents = new Set()) {
  if (value === null) {
    return ['null'];
  }
  if (value === undefined) {
    return ['undefined'];
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return [typeof value, value];
  }
  if (typeof value === 'number') {
    return ['number', Object.is(value, -0) ? '-0' : Number.isFinite(value) ? value : String(value)];
  }
  if (typeof value === 'bigint') {
    return ['bigint', String(value)];
  }
  if (typeof value !== 'object') {
    throw new Error('数据包含不支持备份的类型');
  }
  if (parents.has(value)) {
    throw new Error('数据存在循环或共享引用，无法安全导出');
  }
  parents.add(value);
  if (value instanceof Date) {
    return ['date', value.toISOString()];
  }
  if (value instanceof ArrayBuffer) {
    return ['buffer', encodeBytes(new Uint8Array(value))];
  }
  if (ArrayBuffer.isView(value)) {
    const name = value.constructor.name;
    if (!Object.hasOwn(typedArrays, name)) {
      throw new Error('数据包含不支持的二进制类型');
    }
    if (parents.has(value.buffer)) {
      throw new Error('数据存在共享二进制引用，无法安全导出');
    }
    parents.add(value.buffer);
    return [
      'typed',
      name,
      encodeBytes(new Uint8Array(value.buffer)),
      value.byteOffset,
      value.byteLength
    ];
  }
  if (value instanceof Blob) {
    const kind = value instanceof File ? 'file' : 'blob';
    return [
      kind,
      value.type,
      encodeBytes(new Uint8Array(await value.arrayBuffer())),
      ...(kind === 'file' ? [value.name, value.lastModified] : [])
    ];
  }
  if (Array.isArray(value)) {
    if (
      Array.from(
        {
          length: value.length
        },
        (_, index) => index
      ).some((index) => !(index in value))
    ) {
      throw new Error('数据包含稀疏数组，无法安全导出');
    }
    return ['array', await Promise.all(value.map((entry) => encode(entry, parents)))];
  }
  if (value instanceof Map) {
    return [
      'map',
      await Promise.all(
        [...value].map(async ([key, entry]) => [
          await encode(key, parents),
          await encode(entry, parents)
        ])
      )
    ];
  }
  if (value instanceof Set) {
    return ['set', await Promise.all([...value].map((entry) => encode(entry, parents)))];
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error('数据包含不支持的对象类型');
  }
  const entries = [];
  for (const [key, entry] of Object.entries(value)) {
    entries.push([key, await encode(entry, parents)]);
  }
  return ['object', entries];
}

function decode(encoded, depth = 0) {
  if (depth > 100 || !Array.isArray(encoded) || typeof encoded[0] !== 'string') {
    throw new Error('备份数据格式无效');
  }
  const [kind, value, extra, name, modified] = encoded;
  if (kind === 'null' && encoded.length === 1) {
    return null;
  }
  if (kind === 'undefined' && encoded.length === 1) {
    return undefined;
  }
  if (kind === 'string' && typeof value === 'string') {
    return value;
  }
  if (kind === 'boolean' && typeof value === 'boolean') {
    return value;
  }
  if (
    kind === 'number' &&
    (typeof value === 'number' || ['NaN', 'Infinity', '-Infinity', '-0'].includes(value))
  ) {
    return Number(value);
  }
  if (kind === 'bigint' && typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  if (kind === 'date' && typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value);
  }
  if (kind === 'buffer') {
    return decodeBytes(value).buffer;
  }
  if (
    kind === 'typed' &&
    Object.hasOwn(typedArrays, value) &&
    Number.isSafeInteger(name) &&
    Number.isSafeInteger(modified) &&
    name >= 0 &&
    modified >= 0
  ) {
    const buffer = decodeBytes(extra).buffer;
    const Type = typedArrays[value];
    if (value === 'DataView') {
      return new DataView(buffer, name, modified);
    }
    if (modified % Type.BYTES_PER_ELEMENT !== 0) {
      throw new Error('备份中的二进制数据无效');
    }
    return new Type(buffer, name, modified / Type.BYTES_PER_ELEMENT);
  }
  if (kind === 'blob' && typeof value === 'string') {
    return new Blob([decodeBytes(extra)], {
      type: value
    });
  }
  if (
    kind === 'file' &&
    typeof value === 'string' &&
    typeof name === 'string' &&
    Number.isFinite(modified)
  ) {
    return new File([decodeBytes(extra)], name, {
      type: value,
      lastModified: modified
    });
  }
  if (kind === 'array' && Array.isArray(value)) {
    return value.map((entry) => decode(entry, depth + 1));
  }
  if (kind === 'set' && Array.isArray(value)) {
    return new Set(value.map((entry) => decode(entry, depth + 1)));
  }
  if (kind === 'map' && Array.isArray(value)) {
    return new Map(
      value.map((pair) => {
        if (!Array.isArray(pair) || pair.length !== 2) {
          throw new Error('备份映射格式无效');
        }
        return [decode(pair[0], depth + 1), decode(pair[1], depth + 1)];
      })
    );
  }
  if (kind === 'object' && Array.isArray(value)) {
    const result = Object.create(null);
    for (const pair of value) {
      if (
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        typeof pair[0] !== 'string' ||
        Object.hasOwn(result, pair[0])
      ) {
        throw new Error('备份对象格式无效');
      }
      result[pair[0]] = decode(pair[1], depth + 1);
    }
    return result;
  }
  throw new Error('备份包含不支持的数据类型');
}

async function listDatabases() {
  if (!indexedDB.databases) {
    throw new Error('当前浏览器无法检查全部本地数据库，请使用支持该功能的浏览器');
  }
  const databases = (await indexedDB.databases()).filter((item) => !DISPOSABLE_DATABASES.has(item.name));
  const unknown = databases.filter((item) => !Object.hasOwn(SCHEMAS, item.name));
  if (unknown.length) {
    throw new Error(
      `发现未支持的本地数据库：${unknown.map((item) => item.name).join('、')}，无法安全备份或恢复`
    );
  }
  return databases;
}

function openDatabase(name, create = false) {
  const schema = SCHEMAS[name];
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, schema.version);
    let blocked = false;
    request.onupgradeneeded = (event) => {
      if (!create || event.oldVersion > 0) {
        request.transaction.abort();
        return;
      }
      for (const [storeName, definition] of Object.entries(schema.stores)) {
        const store = request.result.createObjectStore(
          storeName,
          definition.keyPath
            ? {
                keyPath: definition.keyPath
              }
            : undefined
        );
        for (const index of definition.indexes) {
          store.createIndex(index.name, index.keyPath, {
            unique: false,
            multiEntry: false
          });
        }
      }
    };
    request.onerror = () => reject(request.error || new Error(`${name} 打开失败`));
    request.onblocked = () => {
      blocked = true;
      reject(new Error(`${name} 被其他页面占用，请关闭其他页面后重试`));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      if (
        db.version !== schema.version ||
        db.objectStoreNames.length !== Object.keys(schema.stores).length ||
        Object.keys(schema.stores).some((storeName) => !db.objectStoreNames.contains(storeName))
      ) {
        db.close();
        reject(new Error(`${name} 数据库结构不受支持`));
        return;
      }
      for (const [storeName, definition] of Object.entries(schema.stores)) {
        const store = db.transaction(storeName, 'readonly').objectStore(storeName);
        const invalid =
          store.keyPath !== definition.keyPath ||
          store.autoIncrement ||
          store.indexNames.length !== definition.indexes.length ||
          definition.indexes.some((expected) => {
            if (!store.indexNames.contains(expected.name)) {
              return true;
            }
            const actual = store.index(expected.name);
            return (
              JSON.stringify(actual.keyPath) !== JSON.stringify(expected.keyPath) ||
              actual.unique ||
              actual.multiEntry
            );
          });
        if (invalid) {
          db.close();
          reject(new Error(`${name} 数据仓库结构不受支持`));
          return;
        }
      }
      resolve(db);
    };
  });
}

function readRecords(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const keys = store.getAllKeys();
    const values = store.getAll();
    transaction.oncomplete = () =>
      resolve(
        keys.result.map((key, index) => ({
          key,
          value: values.result[index]
        }))
      );
    transaction.onabort = () => reject(transaction.error || new Error('读取本地数据失败'));
    transaction.onerror = () => {};
  });
}

async function snapshot() {
  const existing = await listDatabases();
  const databases = [];
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    const info = existing.find((item) => item.name === name);
    if (!info) {
      databases.push({
        name,
        version: schema.version,
        present: false,
        stores: []
      });
      continue;
    }
    if (info.version !== schema.version) {
      throw new Error(`${name} 数据库版本不受支持`);
    }
    const db = await openDatabase(name);
    try {
      const stores = [];
      for (const [storeName, definition] of Object.entries(schema.stores)) {
        const records = await readRecords(db, storeName);
        const entries = [];
        for (const record of records) {
          entries.push({
            key: await encode(record.key),
            value: await encode(record.value)
          });
        }
        stores.push({
          name: storeName,
          keyPath: definition.keyPath,
          autoIncrement: false,
          indexes: definition.indexes,
          entries
        });
      }
      databases.push({
        name,
        version: schema.version,
        present: true,
        stores
      });
    } finally {
      db.close();
    }
  }
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    databases
  };
}

function validateBackup(data) {
  if (
    !data ||
    data.format !== FORMAT ||
    data.formatVersion !== FORMAT_VERSION ||
    typeof data.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(data.exportedAt)) ||
    !Array.isArray(data.databases)
  ) {
    throw new Error('备份格式或版本不受支持');
  }
  const names = new Set();
  const plan = [];
  for (const database of data.databases) {
    const schema = Object.hasOwn(SCHEMAS, database?.name) ? SCHEMAS[database.name] : null;
    if (!schema || names.has(database.name)) {
      throw new Error('备份包含未知或重复数据库');
    }
    names.add(database.name);
    if (
      database.version !== schema.version ||
      typeof database.present !== 'boolean' ||
      !Array.isArray(database.stores)
    ) {
      throw new Error(`${database.name} 数据库结构不受支持`);
    }
    if (!database.present) {
      if (database.stores.length) {
        throw new Error(`${database.name} 数据仓库格式无效`);
      }
      continue;
    }
    const storeNames = new Set();
    if (database.stores.length !== Object.keys(schema.stores).length) {
      throw new Error(`${database.name} 数据仓库结构不受支持`);
    }
    const stores = database.stores.map((store) => {
      const definition = Object.hasOwn(schema.stores, store?.name)
        ? schema.stores[store.name]
        : null;
      if (
        !definition ||
        storeNames.has(store.name) ||
        store.keyPath !== definition.keyPath ||
        store.autoIncrement !== false ||
        !Array.isArray(store.indexes) ||
        JSON.stringify(store.indexes) !== JSON.stringify(definition.indexes) ||
        !Array.isArray(store.entries)
      ) {
        throw new Error(`${database.name} 数据仓库结构不受支持`);
      }
      storeNames.add(store.name);
      const records = store.entries.map((entry) => {
        const key = decode(entry.key);
        const value = decode(entry.value);
        try {
          indexedDB.cmp(key, key);
          if (
            definition.keyPath &&
            (value === null ||
              typeof value !== 'object' ||
              indexedDB.cmp(value[definition.keyPath], key) !== 0)
          ) {
            throw new Error();
          }
        } catch {
          throw new Error(`${database.name} 包含无效主键或主键与记录不一致`);
        }
        return {
          key,
          value
        };
      });
      const sorted = records.map((record) => record.key).sort((a, b) => indexedDB.cmp(a, b));
      if (sorted.some((key, index) => index > 0 && indexedDB.cmp(key, sorted[index - 1]) === 0)) {
        throw new Error(`${database.name} 存在重复主键`);
      }
      if (database.name === 'MakiMath_LocalLectures') {
        const slugs = new Set();
        for (const { value } of records) {
          if (
            typeof value.slug !== 'string' ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) ||
            value.slug.length > 100 ||
            slugs.has(value.slug) ||
            !Number.isSafeInteger(value.editVersion) ||
            value.editVersion < 1 ||
            !value.revision ||
            typeof value.revision !== 'object' ||
            !Array.isArray(value.chapters) ||
            value.chapters.some(
              (chapter) =>
                !chapter?.occurrence_id ||
                !Array.isArray(chapter.sections) ||
                chapter.sections.some(
                  (section) => !section?.occurrence_id || typeof section.source !== 'string'
                )
            )
          ) {
            throw new Error('本地讲义数据不完整或标识重复');
          }
          slugs.add(value.slug);
        }
      }
      if (
        database.name === 'MakiMath_KnowledgeMastery' &&
        records.some(({ key }) => typeof key !== 'string' || !key)
      ) {
        throw new Error('知识点掌握记录格式不受支持');
      }
      if (
        database.name === 'MakiMath_UpdateLog' &&
        records.some(({ key }) => typeof key !== 'string' || !key)
      ) {
        throw new Error('更新日志已读记录格式不受支持');
      }
      if (
        database.name === 'maki-lecture-covers' &&
        records.some(({ key, value }) => typeof key !== 'string' || typeof value !== 'string')
      ) {
        throw new Error('讲义封面缓存格式不受支持');
      }
      return {
        name: store.name,
        records
      };
    });
    plan.push({
      name: database.name,
      stores
    });
  }
  if (names.size !== Object.keys(SCHEMAS).length) {
    throw new Error('备份缺少数据库清单，不能安全恢复');
  }
  return plan;
}

function writeRecords(db, name, stores) {
  const schema = SCHEMAS[name];
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(Object.keys(schema.stores), 'readwrite');
    try {
      for (const entry of stores) {
        const store = transaction.objectStore(entry.name);
        store.clear();
        for (const record of entry.records) {
          if (schema.stores[entry.name].keyPath) {
            store.add(record.value);
          } else {
            store.add(record.value, record.key);
          }
        }
      }
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error(`${name} 恢复失败`));
    transaction.onerror = () => {};
  });
}

function requireLocks() {
  if (!navigator.locks) {
    throw new Error('当前浏览器不支持安全协调本地数据，请使用支持 Web Locks 的浏览器');
  }
}

export async function exportUserData() {
  requireLocks();
  return navigator.locks.request(
    LOCK_NAME,
    {
      mode: 'exclusive'
    },
    async () => {
      const data = await snapshot();
      validateBackup(data);
      return JSON.stringify(data);
    }
  );
}

export async function inspectUserBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('无法读取备份文件，请选择有效的 JSON 文件');
  }
  const plan = validateBackup(data);
  const existing = await listDatabases();
  for (const entry of existing) {
    if (entry.version !== SCHEMAS[entry.name].version) {
      throw new Error(`${entry.name} 数据库版本不受支持`);
    }
    const db = await openDatabase(entry.name);
    db.close();
  }
  return {
    data,
    exportedAt: data.exportedAt,
    summary: plan.map((item) => ({
      name: item.name,
      count: item.stores.reduce((sum, store) => sum + store.records.length, 0)
    }))
  };
}

export async function restoreUserData(inspection, onIncomplete) {
  requireLocks();
  if (!navigator.storage?.getDirectory) {
    throw new Error('当前浏览器不支持安全保存恢复副本，无法导入');
  }
  return navigator.locks.request(
    LOCK_NAME,
    {
      mode: 'exclusive'
    },
    async () => {
      const plan = validateBackup(inspection.data);
      const original = await snapshot();
      const originalPlan = validateBackup(original);
      const directory = await navigator.storage.getDirectory();
      try {
        await directory.getFileHandle(RECOVERY_FILE);
        throw new Error('存在上次导入的恢复副本，请先下载并确认清除后再导入');
      } catch (error) {
        if (error.name !== 'NotFoundError') {
          throw error;
        }
      }
      const recoveryHandle = await directory.getFileHandle(RECOVERY_FILE, {
        create: true
      });
      const writable = await recoveryHandle.createWritable();
      try {
        await writable.write(JSON.stringify(original));
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => {});
        throw new Error(`无法保存恢复副本，导入未开始：${error.message}`);
      }
      const existing = await listDatabases();
      const opened = [];
      const changed = [];
      try {
        for (const item of plan) {
          const db = await openDatabase(
            item.name,
            !existing.some((entry) => entry.name === item.name)
          );
          opened.push(db);
          await writeRecords(db, item.name, item.stores);
          changed.push(item.name);
        }
      } catch (error) {
        const rollbackFailures = [];
        for (const name of changed.reverse()) {
          const previous = originalPlan.find((entry) => entry.name === name);
          try {
            const db = opened.find((entry) => entry.name === name);
            const stores =
              previous?.stores ||
              Object.keys(SCHEMAS[name].stores).map((storeName) => ({
                name: storeName,
                records: []
              }));
            await writeRecords(db, name, stores);
          } catch {
            rollbackFailures.push(name);
          }
        }
        if (rollbackFailures.length) {
          onIncomplete(
            `导入失败，部分数据库回滚失败：${rollbackFailures.join('、')}。原数据已保留在浏览器恢复副本中，请下载后刷新页面并重新导入。`
          );
          await new Promise(() => {});
        }
        throw new Error(`导入失败，已恢复原有数据：${error.message}`);
      } finally {
        opened.forEach((db) => db.close());
      }
      await directory.removeEntry(RECOVERY_FILE).catch(() => {});
      window.location.reload();
      await new Promise(() => {});
    }
  );
}

export async function getRecoveryBackup() {
  if (!navigator.storage?.getDirectory) {
    return null;
  }
  try {
    const directory = await navigator.storage.getDirectory();
    const handle = await directory.getFileHandle(RECOVERY_FILE);
    return await handle.getFile();
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return null;
    }
    throw error;
  }
}

export async function clearRecoveryBackup() {
  const directory = await navigator.storage.getDirectory();
  await directory.removeEntry(RECOVERY_FILE);
}

export async function listClearableDatabases() {
  if (!indexedDB.databases) {
    throw new Error('当前浏览器无法列出全部本地数据库');
  }
  const databases = await indexedDB.databases();
  return databases.map((item) => ({
    name: item.name,
    version: item.version,
    known: Object.hasOwn(SCHEMAS, item.name) || DISPOSABLE_DATABASES.has(item.name),
    legacy: Boolean(SCHEMAS[item.name]?.legacy)
  }));
}

export async function deleteSelectedDatabases(selected, progress, onIncomplete) {
  requireLocks();
  if (
    !Array.isArray(selected) ||
    !selected.length ||
    selected.some((item) => typeof item.name !== 'string' || !item.name)
  ) {
    throw new Error('请选择要删除的数据库');
  }
  return navigator.locks.request(
    LOCK_NAME,
    {
      mode: 'exclusive'
    },
    async () => {
      const existing = await indexedDB.databases();
      for (const item of selected) {
        const current = existing.find((entry) => entry.name === item.name);
        if (!current || current.version !== item.version) {
          throw new Error(`数据库 ${item.name} 已变化，请重新选择`);
        }
      }
      const deleted = [];
      try {
        for (const item of selected) {
          progress(`正在删除 ${item.name}`);
          await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(item.name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error(`${item.name} 删除失败`));
            request.onblocked = () => progress(`数据库 ${item.name} 被占用，请关闭其他本站标签页`);
          });
          deleted.push(item.name);
        }
      } catch (error) {
        if (deleted.length) {
          onIncomplete(
            `部分数据库已永久删除：${deleted.join('、')}。后续删除失败：${error.message}。请刷新页面后重新选择。`
          );
          await new Promise(() => {});
        }
        throw error;
      }
      window.location.reload();
      await new Promise(() => {});
    }
  );
}
