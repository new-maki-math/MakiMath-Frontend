// 用户认证与权限状态管理
import { ref, computed } from 'vue';
import { request } from '../api/client.js';

// 当前登录用户对象响应式
export const currentUser = ref(null);
const isInitialized = ref(false);

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
}

// 清除登录态
export function clearAuth() {
  setAuth(null, null);
}

// 是否已登录
export const isLoggedIn = computed(() => {
  return Boolean(currentUser.value && currentUser.value.id);
});

// 是否为超级管理员
export const isSuperAdmin = computed(() => {
  return Boolean(currentUser.value && currentUser.value.role === 'super_admin');
});

// 初始化鉴权信息
export async function initAuth() {
  if (typeof localStorage === 'undefined') return null;
  if (isInitialized.value) return currentUser.value;
  isInitialized.value = true;

  const stored = getStoredUser();
  if (stored) {
    currentUser.value = normalizeUser(stored);
  }

  const token = localStorage.getItem('maki_auth_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
  if (token) {
    try {
      const res = await request('/api/auth/me');
      if (res?.ok && res?.user) {
        setAuth(token, res.user);
        return res.user;
      }
    } catch (err) {
      if (err.status === 401) {
        clearAuth();
      }
    }
  }

  return currentUser.value;
}
