import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { getAuthToken, setAuthToken } from '../src/utils/auth-storage.js';

let originalStorage;
let values;

beforeEach(() => {
  originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    }
  });
});

afterEach(() => {
  if (originalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalStorage);
  } else {
    delete globalThis.localStorage;
  }
});

test('优先读取当前凭据并兼容旧存储键', () => {
  values.set('auth_token', 'oldest');
  assert.equal(getAuthToken(), 'oldest');
  values.set('token', 'legacy');
  assert.equal(getAuthToken(), 'legacy');
  values.set('maki_auth_token', 'current');
  assert.equal(getAuthToken(), 'current');
});

test('更新凭据时清除旧存储键并保留其他本地数据', () => {
  values.set('token', 'legacy');
  values.set('auth_token', 'oldest');
  values.set('maki-theme', 'light');
  setAuthToken('current');
  assert.deepEqual(
    [...values],
    [
      ['maki-theme', 'light'],
      ['maki_auth_token', 'current']
    ]
  );
});

test('退出后不会重新读取残留的旧凭据', () => {
  for (const key of ['maki_auth_token', 'token', 'auth_token']) {
    values.set(key, 'stale');
  }
  setAuthToken(null);
  assert.equal(getAuthToken(), null);
  assert.equal(values.size, 0);
});

test('没有浏览器存储时可以安全读取和清除凭据', () => {
  delete globalThis.localStorage;
  assert.equal(getAuthToken(), null);
  assert.doesNotThrow(() => setAuthToken(null));
});
