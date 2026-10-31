const TOKEN_KEY = 'maki_auth_token';
const LEGACY_TOKEN_KEYS = ['token', 'auth_token'];

export function getAuthToken() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return (
    [TOKEN_KEY, ...LEGACY_TOKEN_KEYS].map((key) => localStorage.getItem(key)).find(Boolean) || null
  );
}

export function setAuthToken(token) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  for (const key of LEGACY_TOKEN_KEYS) {
    localStorage.removeItem(key);
  }
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}
