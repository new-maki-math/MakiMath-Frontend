// 用户认证与权限状态管理
import { ref, computed } from 'vue';
import { request } from '../api/client.js';

// 当前登录用户对象（响应式）
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
    localStorage.setItem('maki_auth_user', JSON.stringify(user));
    currentUser.value = user;
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
    currentUser.value = stored;
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
