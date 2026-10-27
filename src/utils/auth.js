// 用户认证与权限状态管理
import { ref, computed } from 'vue';
import { request, setUnauthorizedHandler } from '../api/client.js';
import { invalidateCourseCaches } from '../api/courses.js';

// 当前登录用户对象响应式
export const currentUser = ref(null);
export const authStatus = ref('initializing');
let initialization = null;
let authVersion = 0;
const REFRESH_TOKEN_KEY = 'maki_refresh_token';

export function getAuthToken() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('maki_auth_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
}

// 读取本地存储的用户信息
export function getStoredUser() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('maki_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 归一化用户信息对象
export function normalizeUser(rawUser) {
  if (!rawUser) return null;
  return {
    ...rawUser,
    displayName: rawUser.displayName || rawUser.display_name || '',
    display_name: rawUser.display_name || rawUser.displayName || '',
    lastLoginAt: rawUser.lastLoginAt || rawUser.last_login_at || null,
    last_login_at: rawUser.last_login_at || rawUser.lastLoginAt || null,
    createdAt: rawUser.createdAt || rawUser.created_at || null,
    created_at: rawUser.created_at || rawUser.createdAt || null
  };
}

// 设置认证凭据与用户信息
export function setAuth(token, user) {
  if (typeof localStorage === 'undefined') return;
  const previousToken = getAuthToken();
  authVersion++;
  if (previousToken !== token || currentUser.value?.id !== user?.id || currentUser.value?.role !== user?.role) invalidateCourseCaches();

  localStorage.removeItem('token');
  localStorage.removeItem('auth_token');
  if (token) {
    localStorage.setItem('maki_auth_token', token);
  } else {
    localStorage.removeItem('maki_auth_token');
    localStorage.removeItem('token');
  }

  if (user) {
    const normalized = normalizeUser(user);
    localStorage.setItem('maki_auth_user', JSON.stringify(normalized));
    currentUser.value = normalized;
  } else {
    localStorage.removeItem('maki_auth_user');
    currentUser.value = null;
  }
  authStatus.value = token && user ? 'authenticated' : 'anonymous';
}

// 清除登录态
export function clearAuth() {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  setAuth(null, null);
}

export async function authenticate(path, credentials, requiredRole = '') {
  const result = await request(path, { method: 'POST', body: credentials });
  if (!result?.token || !result?.user) throw new Error('登录响应不完整');
  if (authStatus.value === 'expired' && currentUser.value && String(result.user.id) !== String(currentUser.value.id)) {
    throw new Error('请使用原账号重新登录，以继续当前编辑');
  }
  if (requiredRole && result.user.role !== requiredRole) throw new Error('当前账号无权访问平台管理控制台');
  if (typeof sessionStorage !== 'undefined') {
    if (result.refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
    else sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  setAuth(result.token, result.user);
  return result.user;
}

export async function logout() {
  const refreshToken = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(REFRESH_TOKEN_KEY);
  let revoked = false;
  try {
    if (refreshToken && getAuthToken()) {
      await request('/api/auth/logout', { method: 'POST', body: { refreshToken } });
      revoked = true;
    }
  } finally {
    clearAuth();
  }
  return revoked;
}

setUnauthorizedHandler((token) => {
  if (token !== getAuthToken()) return;
  if (!currentUser.value) {
    clearAuth();
    return;
  }
  authVersion++;
  localStorage.removeItem('maki_auth_token');
  localStorage.removeItem('token');
  localStorage.removeItem('auth_token');
  invalidateCourseCaches();
  authStatus.value = 'expired';
});

// 是否已登录
export const isLoggedIn = computed(() => {
  return Boolean(currentUser.value && currentUser.value.id);
});

// 是否为超级管理员
export const isSuperAdmin = computed(() => {
  return Boolean(currentUser.value && currentUser.value.role === 'super_admin');
});

// 初始化鉴权信息
export function initAuth() {
  if (initialization) return initialization;
  if (authStatus.value === 'authenticated' || authStatus.value === 'anonymous') return Promise.resolve(currentUser.value);
  const token = getAuthToken();
  if (!token) {
    authStatus.value = 'anonymous';
    return Promise.resolve(null);
  }
  const version = authVersion;
  authStatus.value = 'initializing';
  initialization = (async () => {
    try {
      const res = await request('/api/auth/me');
      if (version !== authVersion) return currentUser.value;
      if (res?.ok && res?.user) setAuth(token, res.user);
      else authStatus.value = 'error';
    } catch (err) {
      if (version !== authVersion) return currentUser.value;
      if (err.status === 401) clearAuth();
      else authStatus.value = 'error';
    }
    return currentUser.value;
  })().finally(() => { initialization = null; });
  return initialization;
}
